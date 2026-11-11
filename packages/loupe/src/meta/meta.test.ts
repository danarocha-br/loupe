import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run } from "../cli.js";
import { extract } from "./command.js";
import { collectSources, hashFile } from "./sources.js";
import type { ComponentExport, InspectReason, ModuleMeta, PropMeta } from "./types.js";
import { metaPath, stableJson, writeMeta } from "./write.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const designSystem = path.resolve(here, "../../../../fixture/design-system/tsconfig.json");
const edgeShapes = path.resolve(here, "../../test/fixtures/edge-shapes/tsconfig.json");
const REASONS: InspectReason[] = ["FUNCTION", "CONTENT", "OPEN TEXT", "OBJECT", "STRUCTURAL", "LINKED PROPS", "UNVERIFIED"];

function component(modules: ModuleMeta[], source: string, name: string): ComponentExport {
  const entry = modules.find((m) => m.source === source)?.exports[name];
  if (entry?.kind !== "component") throw new Error(`${name} is not a component in ${source}`);
  return entry;
}

function prop(entry: ComponentExport, name: string): PropMeta {
  const found = entry.props[name];
  if (!found) throw new Error(`no prop ${name}`);
  return found;
}

function everyProp(modules: ModuleMeta[]): [string, PropMeta][] {
  return modules.flatMap((m) =>
    Object.entries(m.exports).flatMap(([name, e]) =>
      e.kind === "component" ? Object.entries(e.props).map(([p, v]) => [`${m.source}#${name}.${p}`, v] as [string, PropMeta]) : [],
    ),
  );
}

function expectWellFormed(modules: ModuleMeta[]) {
  const props = everyProp(modules);
  expect(props.length).toBeGreaterThan(0);
  for (const [where, p] of props) {
    if (p.editable && p.kind === "options") {
      expect(p.options.length, where).toBeGreaterThan(0);
      expect(["verified", "verified-partial", "type-only"], where).toContain(p.status);
    } else if (!p.editable) {
      expect(REASONS, where).toContain(p.reason);
    }
  }
}

describe("ts-morph engine on the fixture design system", () => {
  let modules: ModuleMeta[];
  beforeAll(() => {
    ({ modules } = extract(collectSources(designSystem, ["components"]), "ts-morph"));
  });

  it("reads Button's variant and size as verified closed sets, in cva order", () => {
    const button = component(modules, "components/ui/button.tsx", "Button");
    expect(prop(button, "variant")).toEqual({
      editable: true,
      kind: "options",
      status: "verified",
      from: "repo",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
      default: { source: "destructure", value: "default" },
    });
    expect(prop(button, "size")).toMatchObject({
      status: "verified",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm"],
    });
  });

  it("lists Base UI props, filters DOM attributes, and keeps children and disabled", () => {
    const button = component(modules, "components/ui/button.tsx", "Button");
    expect(Object.keys(button.props)).toEqual([
      "children",
      "className",
      "disabled",
      "focusableWhenDisabled",
      "nativeButton",
      "render",
      "size",
      "style",
      "variant",
    ]);
    expect(prop(button, "children")).toEqual({ editable: true, kind: "text", from: "@types/react" });
    expect(prop(button, "disabled")).toMatchObject({ editable: true, status: "type-only", options: [false, true] });
    expect(prop(button, "render")).toMatchObject({ editable: false, reason: "STRUCTURAL", default: { source: "unknown" } });
    expect(prop(button, "nativeButton")).toMatchObject({ editable: false, reason: "STRUCTURAL" });
  });

  it("gives every inspect-only prop a reason", () => {
    expectWellFormed(modules);
  });

  it("marks State props and reads destructured defaults of Base UI props", () => {
    const menu = component(modules, "components/ui/dropdown-menu.tsx", "DropdownMenu");
    expect(prop(menu, "open")).toMatchObject({ editable: true, state: true });
    expect(prop(menu, "onOpenChange")).toMatchObject({ editable: false, reason: "FUNCTION" });
    const content = component(modules, "components/ui/dropdown-menu.tsx", "DropdownMenuContent");
    expect(prop(content, "side")).toMatchObject({ status: "type-only", default: { source: "destructure", value: "bottom" } });
    const item = component(modules, "components/ui/dropdown-menu.tsx", "DropdownMenuItem");
    expect(prop(item, "variant")).toMatchObject({ status: "type-only", options: ["default", "destructive"] });
  });

  it("records the module's directive, helpers, and a hash per file read", () => {
    const button = modules.find((m) => m.source === "components/ui/button.tsx");
    expect(button?.client).toBe(false);
    expect(button?.exports.buttonVariants).toEqual({ kind: "other" });
    expect(button?.files).toEqual({
      "components/ui/button.tsx": hashFile(path.resolve(path.dirname(designSystem), "components/ui/button.tsx")),
    });
    expect(modules.find((m) => m.source === "components/ui/dropdown-menu.tsx")?.client).toBe(true);
  });

  it("writes inspect-only components too (Badge renders on the server)", () => {
    const badge = component(modules, "components/ui/badge.tsx", "Badge");
    expect(prop(badge, "variant")).toMatchObject({ status: "verified", options: ["default", "secondary", "muted", "outline"] });
    expect(prop(badge, "render")).toMatchObject({ reason: "STRUCTURAL" });
  });
});

describe("ts-morph engine on edge shapes", () => {
  let modules: ModuleMeta[];
  const shapes = "components/shapes.tsx";
  beforeAll(() => {
    ({ modules } = extract(collectSources(edgeShapes, []), "ts-morph"));
  });

  it.each([
    ["Kitchen", "onSelect", "FUNCTION"],
    ["Kitchen", "icon", "CONTENT"],
    ["Kitchen", "children", "CONTENT"],
    ["Kitchen", "title", "OPEN TEXT"],
    ["Kitchen", "count", "OPEN TEXT"],
    ["Kitchen", "label", "OPEN TEXT"],
    ["Kitchen", "style", "OBJECT"],
    ["Kitchen", "member", "OBJECT"],
    ["Kitchen", "asChild", "STRUCTURAL"],
    ["Kitchen", "anything", "UNVERIFIED"],
    ["Shape", "shape", "LINKED PROPS"],
    ["Shape", "radius", "LINKED PROPS"],
    ["Text", "as", "STRUCTURAL"],
    ["Text", "payload", "UNVERIFIED"],
    ["Extended", "size", "UNVERIFIED"],
  ] as const)("%s.%s is inspect-only: %s", (name, propName, reason) => {
    expect(prop(component(modules, shapes, name), propName)).toMatchObject({ editable: false, reason });
  });

  it("lets an unreadable config taint only the props it generated", () => {
    expect(prop(component(modules, shapes, "Extended"), "open")).toMatchObject({ status: "type-only" });
  });

  it("offers number unions and enums, sorted when no config backs them", () => {
    const kitchen = component(modules, shapes, "Kitchen");
    expect(prop(kitchen, "columns")).toMatchObject({ status: "type-only", options: [1, 2, 3] });
    expect(prop(kitchen, "density")).toMatchObject({ status: "type-only", options: ["comfortable", "compact"] });
    expect(prop(kitchen, "open")).toMatchObject({ editable: true, state: true });
  });

  it("verifies tailwind-variants configs, booleans included", () => {
    const alert = component(modules, shapes, "Alert");
    expect(prop(alert, "tone")).toMatchObject({
      status: "verified",
      options: ["info", "warn", "error"],
      default: { source: "defaultVariants", value: "info" },
    });
    expect(prop(alert, "elevated")).toMatchObject({ status: "verified", options: [false, true] });
    expect(prop(alert, "children")).toMatchObject({ editable: true, kind: "text" });
  });

  it("offers only the intersection when the type and the config disagree", () => {
    expect(prop(component(modules, shapes, "Mismatch"), "tone")).toMatchObject({
      status: "verified-partial",
      options: ["calm", "loud"],
      mismatch: { onlyInType: ["quiet"], onlyInConfig: ["extra"] },
    });
  });

  it("reports a destructure default that disagrees with defaultVariants", () => {
    const conflict = component(modules, shapes, "Conflict");
    expect(prop(conflict, "tone").default).toEqual({ source: "conflict", value: "loud", defaultVariants: "calm" });
    expect(prop(conflict, "size").default).toEqual({ source: "defaultVariants", value: "sm" });
  });

  it("detects shapes, generics and enum defaults", () => {
    expect(component(modules, shapes, "Fwd")).toMatchObject({ shape: "forwardRef" });
    expect(prop(component(modules, shapes, "Fwd"), "density").default).toEqual({ source: "destructure", value: "comfortable" });
    expect(component(modules, shapes, "Memo").shape).toBe("memo");
    expect(component(modules, shapes, "Lazy").shape).toBe("lazy");
    expect(component(modules, shapes, "AliasedMemo")).toMatchObject({ shape: "alias", props: { on: { status: "type-only" } } });
    expect(component(modules, shapes, "Klass")).toMatchObject({ shape: "class", props: { mode: { status: "type-only" } } });
    expect(component(modules, shapes, "Text").generic).toBe(true);
    expect(component(modules, "components/nested/reexport.tsx", "Alert").shape).toBe("re-export");
    const module = modules.find((m) => m.source === shapes);
    expect(module?.client).toBe(true);
    expect(module?.exports).toMatchObject({ lowercaseHelper: { kind: "other" }, KitchenTone: { kind: "type" }, Density: { kind: "other" } });
  });

  it("hashes every repo file read, the re-exported module included", () => {
    expect(Object.keys(modules.find((m) => m.source === "components/nested/reexport.tsx")?.files ?? {})).toEqual([
      "components/nested/reexport.tsx",
      "components/shapes.tsx",
    ]);
  });

  it("gives every inspect-only prop a reason", () => {
    expectWellFormed(modules);
  });
});

describe("react-docgen-typescript fallback", () => {
  it("still verifies Button's variant and size against cva", () => {
    const { modules } = extract(collectSources(designSystem, ["components"]), "docgen");
    expect(modules.every((m) => m.engine === "react-docgen-typescript")).toBe(true);
    const button = component(modules, "components/ui/button.tsx", "Button");
    expect(prop(button, "variant")).toMatchObject({
      status: "verified",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
      default: { source: "destructure", value: "default" },
    });
    expect(prop(button, "size")).toMatchObject({ status: "verified" });
    expect(prop(button, "children")).toMatchObject({ editable: true, kind: "text" });
    expectWellFormed(modules);
  });

  it("shares the default rules: a destructure that disagrees with defaultVariants is a conflict", () => {
    const { modules } = extract(collectSources(edgeShapes, []), "docgen");
    expect(prop(component(modules, "components/shapes.tsx", "Conflict"), "tone").default).toEqual({
      source: "conflict",
      value: "loud",
      defaultVariants: "calm",
    });
  });

  it("takes over in auto mode when ts-morph cannot read the tsconfig", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "loupe-broken-"));
    try {
      writeFileSync(path.join(dir, "tsconfig.json"), '{ "compilerOptions": ');
      writeFileSync(path.join(dir, "solo.tsx"), 'export function Solo(p: { size?: "sm" | "lg" }) { return p ? null : null; }\n');
      const { modules, fallbackReason } = extract(collectSources(path.join(dir, "tsconfig.json"), []), "auto");
      expect(fallbackReason).toBeTruthy();
      expect(modules[0]?.engine).toBe("react-docgen-typescript");
      expect(prop(component(modules, "solo.tsx", "Solo"), "size")).toMatchObject({ status: "type-only", options: ["lg", "sm"] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("writing meta files", () => {
  let out: string;
  let modules: ModuleMeta[];
  beforeAll(() => {
    out = mkdtempSync(path.join(tmpdir(), "loupe-meta-"));
    ({ modules } = extract(collectSources(designSystem, ["components"]), "ts-morph"));
  });
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it("writes meta/<source path>.json, then nothing when nothing changed", () => {
    const first = writeMeta(out, modules);
    expect(first.map((f) => path.relative(out, f).split(path.sep).join("/")).sort()).toEqual([
      "components/ui/alert-dialog.tsx.json",
      "components/ui/badge.tsx.json",
      "components/ui/button.tsx.json",
      "components/ui/dropdown-menu.tsx.json",
    ]);
    expect(writeMeta(out, modules)).toEqual([]);
  });

  it("is byte-stable, key-sorted and free of absolute paths", () => {
    const again = extract(collectSources(designSystem, ["components"]), "ts-morph").modules;
    expect(again.map((m) => stableJson(m))).toEqual(modules.map((m) => stableJson(m)));
    const bytes = readFileSync(metaPath(out, "components/ui/button.tsx"), "utf8");
    expect(bytes.endsWith("}\n")).toBe(true);
    expect(bytes).not.toContain(path.dirname(designSystem));
    expect(Object.keys(JSON.parse(bytes))).toEqual(["client", "engine", "exports", "files", "formatVersion", "source"]);
  });
});

describe("loupe meta", () => {
  async function capture(argv: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await run(argv, { out: (l) => out.push(l), err: (l) => err.push(l) });
    return { code, out, err };
  }

  it("runs headless and prints a summary", async () => {
    const out = mkdtempSync(path.join(tmpdir(), "loupe-cli-"));
    try {
      const result = await capture(["meta", "--tsconfig", designSystem, "--include", "components", "--out", out]);
      expect(result.code).toBe(0);
      expect(result.out[0]).toMatch(/^4 modules · \d+ components · \d+ editable props · \d+ inspect only$/);
      expect(result.out[1]).toMatch(/^4 files written · ts-morph · \d+\.\d\d s$/);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it.each([
    [["meta", "--engine", "babel"], "Unknown engine: babel"],
    [["meta", "--out"], "Missing value for --out"],
    [["meta", "--watch"], "Unknown option: --watch"],
    [["meta", "--include", "nowhere", "--tsconfig", designSystem], "Not a directory: nowhere"],
  ])("refuses %j", async (argv, message) => {
    const { code, err } = await capture(argv);
    expect(code).toBe(1);
    expect(err.join("\n")).toContain(message);
  });
});
