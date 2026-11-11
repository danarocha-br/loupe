import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { run } from "../cli.js";
import { extract } from "../meta/command.js";
import { collectSources } from "../meta/sources.js";
import type { ComponentExport, ModuleMeta } from "../meta/types.js";
import { diff } from "./apply.js";
import { runGenerate } from "./command.js";
import { readHeader, stampJson, stampModule } from "./header.js";
import { adapterModule, coverageOf, plan } from "./plan.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const edgeShapes = path.resolve(here, "../../test/fixtures/edge-shapes/tsconfig.json");
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/**
 * A copy of the fixture repo at a fresh path: sources copied, `node_modules`
 * linked back to the workspace's. The stand-in Product layer is dropped, so
 * `fixture/app/loupe` starts empty.
 */
function fixtureRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "loupe-generate-"));
  temps.push(root);
  mkdirSync(path.join(root, ".git"));
  cpSync(path.join(repo, "tsconfig.base.json"), path.join(root, "tsconfig.base.json"));
  for (const pkg of ["fixture/design-system", "fixture/app"]) {
    cpSync(path.join(repo, pkg), path.join(root, pkg), {
      recursive: true,
      filter: (source) => !/[/\\](node_modules|\.next|loupe)$/.test(source),
    });
    symlinkSync(path.join(repo, pkg, "node_modules"), path.join(root, pkg, "node_modules"));
  }
  symlinkSync(path.join(repo, "node_modules"), path.join(root, "node_modules"));
  return root;
}

const FIRST_RUN = ["--out", "fixture/app/loupe", "--design-system", "fixture/design-system", "--app", "fixture/app", "--specifier", "@/loupe"];
const OUT = "fixture/app/loupe";

function generate(root: string, args: string[] = [], check = false) {
  return runGenerate(
    {
      out: OUT,
      ...(args.length > 0 ? { designSystem: "fixture/design-system", app: "fixture/app", specifier: "@/loupe" } : {}),
      check,
      verbose: false,
    },
    root,
  );
}

/** Every file under the Product layer: relative path → bytes and mtime. */
function snapshot(root: string): Map<string, { bytes: string; mtimeMs: number }> {
  const result = new Map<string, { bytes: string; mtimeMs: number }>();
  const base = path.join(root, OUT);
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else result.set(path.relative(base, full), { bytes: readFileSync(full, "utf8"), mtimeMs: statSync(full).mtimeMs });
    }
  };
  walk(base);
  return result;
}

const bytesOf = (snap: ReturnType<typeof snapshot>) => new Map([...snap].map(([file, { bytes }]) => [file, bytes]));

describe("the generated header", () => {
  it("verifies a module and a JSON file and catches any edit", () => {
    const module = stampModule(`"use client";\n\nexport const a = 1;\n`);
    expect(readHeader(module)).toEqual({ kind: "intact", formatVersion: 1 });
    expect(readHeader(module.replace("a = 1", "a = 2"))).toEqual({ kind: "edited" });

    const json = stampJson(`{\n  "a": 1\n}\n`);
    expect(JSON.parse(json)).toMatchObject({ a: 1 });
    expect(readHeader(json)).toEqual({ kind: "intact", formatVersion: 1 });
    expect(readHeader(json.replace('"a": 1', '"a": 2'))).toEqual({ kind: "edited" });
    expect(readHeader(`{\n  "a": 1\n}\n`)).toEqual({ kind: "foreign" });
  });

  it("rewrites a file from another formatVersion rather than refusing it", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "loupe-format-"));
    temps.push(dir);
    const current = stampJson(`{\n  "a": 1\n}\n`);
    writeFileSync(path.join(dir, "adapt-list.json"), current.replace("formatVersion 1", "formatVersion 0"));
    const result = diff(dir, new Map([["adapt-list.json", current]]));
    expect(result.refusals).toEqual([]);
    expect(result.changes).toEqual([{ file: "adapt-list.json", action: "write", why: "formatVersion" }]);
  });
});

describe("what gets an Adapter", () => {
  const module = (client: boolean, entry: ComponentExport): ModuleMeta => ({
    formatVersion: 1,
    engine: "ts-morph",
    source: "apps/app/x.tsx",
    client,
    files: {},
    exports: { X: entry },
  });
  const editable: ComponentExport = { kind: "component", shape: "function", props: { open: { editable: true, kind: "options", status: "type-only", options: [false, true], from: "repo" } } };

  it("adapts a client product component with an Editable prop, and nothing else", () => {
    expect(coverageOf(module(true, editable), editable, "app")).toEqual({ outcome: "adapter" });
    expect(coverageOf(module(false, editable), editable, "app")).toEqual({ outcome: "inspect-only", reason: "server component" });
    // Design-system modules need no directive: the loader swaps them from client files.
    expect(coverageOf(module(false, editable), editable, "ds")).toEqual({ outcome: "adapter" });
    const none: ComponentExport = { ...editable, props: { onClick: { editable: false, reason: "FUNCTION", from: "repo" } } };
    expect(coverageOf(module(true, none), none, "app")).toEqual({ outcome: "inspect-only", reason: "no Editable prop" });
  });

  it("skips every shape createAdapter does not wrap and keeps the rest", () => {
    const { modules } = extract(collectSources(edgeShapes, ["components"]), "ts-morph");
    const rebased = modules.map((m) => ({ ...m, source: `edge/${m.source}` }));
    const result = plan({ outDir: "out", specifier: "@x/loupe", designSystem: { root: "edge" }, app: { root: "app" }, modules: rebased });
    const outcome = (name: string) => result.coverage.find((c) => c.name === name)?.coverage;
    expect(outcome("Fwd")).toEqual({ outcome: "adapter" });
    expect(outcome("Memo")).toEqual({ outcome: "adapter" });
    expect(outcome("Klass")).toEqual({ outcome: "skipped-by-shape", reason: "class" });
    expect(outcome("Lazy")).toEqual({ outcome: "skipped-by-shape", reason: "lazy" });
    expect(outcome("AliasedMemo")).toEqual({ outcome: "skipped-by-shape", reason: "alias" });
    expect(result.coverage.filter((c) => c.source === "edge/components/nested/reexport.tsx" && c.name === "Alert")[0]?.coverage)
      .toEqual({ outcome: "skipped-by-shape", reason: "re-export" });
    // No package.json: the Adapter imports its original by relative path.
    expect(result.files.get("adapters/ds/shapes.tsx")).toContain('from "../../../edge/components/shapes"');
  });
});

describe("the Adapter module", () => {
  it("re-exports every other name explicitly, values and types apart, never export *", () => {
    const module: ModuleMeta = {
      formatVersion: 1,
      engine: "ts-morph",
      source: "ds/components/ui/button.tsx",
      client: false,
      files: {},
      exports: {
        Button: { kind: "component", shape: "function", props: {} },
        ButtonProps: { kind: "type" },
        buttonVariants: { kind: "other" },
      },
    };
    expect(adapterModule(module, ["Button"], "@x/ds/components/ui/button")).toBe(
      [
        `"use client";`,
        "",
        `import { createAdapter } from "@danarocha/loupe/runtime";`,
        `import { Button as Button$original } from "@x/ds/components/ui/button";`,
        "",
        `export { buttonVariants } from "@x/ds/components/ui/button";`,
        `export type { ButtonProps } from "@x/ds/components/ui/button";`,
        "",
        `export const Button = createAdapter("Button", Button$original);`,
        "",
      ].join("\n"),
    );
  });
});

describe("loupe generate on the fixture", () => {
  const root = fixtureRepo();
  const first = generate(root, FIRST_RUN);
  const after = snapshot(root);

  it("adapts Button, DropdownMenuItem, AlertDialog and MemberRowMenu from metadata alone", () => {
    expect(first.ok).toBe(true);
    const list = JSON.parse(after.get("adapt-list.json")?.bytes ?? "{}");
    expect(list.modules["fixture/design-system/components/ui/button.tsx"]).toEqual({
      adapter: "@/loupe/adapters/ds/ui/button",
      adapted: ["Button"],
    });
    expect(list.modules["fixture/design-system/components/ui/dropdown-menu.tsx"].adapted).toContain("DropdownMenuItem");
    expect(list.modules["fixture/design-system/components/ui/alert-dialog.tsx"].adapted).toContain("AlertDialog");
    expect(list.modules["fixture/app/components/product/member-row-menu.tsx"]).toEqual({
      adapter: "@/loupe/adapters/app/components/product/member-row-menu",
      adapted: ["MemberRowMenu"],
    });
    expect(after.get("adapters/ds/ui/button.tsx")?.bytes).toContain(
      `export { buttonVariants } from "@fixture/design-system/components/ui/button";`,
    );
    expect(after.get("adapters/app/components/product/member-row-menu.tsx")?.bytes).toContain(
      `from "../../../../../components/product/member-row-menu";`,
    );
    // Metadata for every component module, Adapter or not, mirroring the source tree.
    expect(after.has("meta/app/app/page.tsx.json")).toBe(true);
    expect(JSON.parse(after.get("meta/ds/ui/button.tsx.json")?.bytes ?? "{}").source).toBe("fixture/design-system/components/ui/button.tsx");
    expect(first.lines.join("\n")).toMatch(/Coverage: 14 Adapters · 0 Inspect only · \d+ skipped by shape/);
    for (const [file, { bytes }] of after) expect(readHeader(bytes).kind, file).toBe("intact");
  });

  it("writes zero bytes on a rerun and on --check, reading the roots back from adapt-list.json", () => {
    const again = generate(root);
    expect(again.ok).toBe(true);
    expect(again.changes).toEqual([]);
    const check = generate(root, [], true);
    expect(check.ok).toBe(true);
    expect(check.changes).toEqual([]);
    expect(snapshot(root)).toEqual(after);
  });

  it("is byte-identical from a second copy at another path", () => {
    const other = fixtureRepo();
    expect(generate(other, FIRST_RUN).ok).toBe(true);
    expect(bytesOf(snapshot(other))).toEqual(bytesOf(after));
  });

  it("refuses a hand-edited Adapter, writing nothing, until it is deleted", async () => {
    const edited = path.join(root, OUT, "adapters/ds/ui/button.tsx");
    const original = readFileSync(edited, "utf8");
    writeFileSync(edited, original.replace(`"Button", Button$original`, `"Button", Button$original /* mine */`));
    // A missing file the run would otherwise restore shows that nothing is written.
    unlinkSync(path.join(root, OUT, "meta/ds/ui/badge.tsx.json"));

    for (const check of [false, true]) {
      const refused = generate(root, [], check);
      expect(refused.ok).toBe(false);
      expect(refused.refusals).toEqual([{ file: "adapters/ds/ui/button.tsx", why: "edited" }]);
      expect(refused.lines.join("\n")).toContain("fixture/app/loupe/adapters/ds/ui/button.tsx: edited by hand");
      expect(readFileSync(edited, "utf8")).toContain("/* mine */");
      expect(snapshot(root).has("meta/ds/ui/badge.tsx.json")).toBe(false);
    }
    const errors: string[] = [];
    const code = await run(["generate", "--check", "--out", OUT], { out: () => {}, err: (l) => errors.push(l), cwd: root });
    expect(code).toBe(1);
    expect(errors.join("\n")).toContain("adapters/ds/ui/button.tsx: edited by hand");

    unlinkSync(edited);
    expect(generate(root).ok).toBe(true);
    expect(bytesOf(snapshot(root))).toEqual(bytesOf(after));
  });

  it("refuses a file it did not write at a path it needs", () => {
    const other = fixtureRepo();
    mkdirSync(path.join(other, OUT), { recursive: true });
    writeFileSync(path.join(other, OUT, "adapt-list.json"), `{"formatVersion":1,"designSystem":[],"app":[],"modules":{}}\n`);
    const refused = generate(other, FIRST_RUN);
    expect(refused.refusals).toEqual([{ file: "adapt-list.json", why: "foreign" }]);
    expect(readdirSync(path.join(other, OUT))).toEqual(["adapt-list.json"]);
  });

  it("deletes the Adapter of a component that left the set", () => {
    const other = fixtureRepo();
    expect(generate(other, FIRST_RUN).ok).toBe(true);
    const menu = path.join(other, "fixture/app/components/product/member-row-menu.tsx");
    writeFileSync(menu, readFileSync(menu, "utf8").replace(`"use client";\n`, ""));
    const second = generate(other);
    expect(second.changes).toContainEqual({ file: "adapters/app/components/product/member-row-menu.tsx", action: "delete", why: "stale" });
    const files = snapshot(other);
    expect(files.has("adapters/app/components/product/member-row-menu.tsx")).toBe(false);
    expect([...files.keys()].some((f) => f.startsWith("adapters/app/"))).toBe(false);
    expect(JSON.parse(files.get("adapt-list.json")?.bytes ?? "{}").modules).not.toHaveProperty(
      "fixture/app/components/product/member-row-menu.tsx",
    );
  });
});
