// The build (ADR 0004): tsc6 builds the Node side and every `.d.ts`, then Vite
// rewrites the browser side's `.js`, one file per module, and ships `@loupe/ui`'s own
// build in `dist/ui` (ADR 0010). These tests read `dist`, so they run after a build:
// `pnpm build` ends with them, and CI builds first.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, type Rolldown } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserConfig, browserEntries } from "../vite.config.js";
import probeCss from "../test/fixtures/css-inline/probe.css?inline";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(pkg, "dist");
const read = (file: string) => readFileSync(path.join(dist, file), "utf8");

/** Every file under `dir`, relative to `dist`, with `/` separators. */
function filesUnder(dir: string): string[] {
  return readdirSync(path.join(dist, dir), { recursive: true, encoding: "utf8" })
    .map((file) => path.posix.join(dir, file.split(path.sep).join("/")))
    .filter((file) => statSync(path.join(dist, file)).isFile());
}

const jsFiles = () => filesUnder(".").filter((file) => file.endsWith(".js") || file.endsWith(".cjs"));
const isBrowserSide = (file: string) => file === "mount.js" || /^(runtime|toolbar)\//.test(file);
/** `@loupe/ui`, shipped as its own build made it (ADR 0010). */
const isUi = (file: string) => file.startsWith("ui/");
const uiDist = path.resolve(pkg, "..", "ui", "dist");

/**
 * The packages a built module imports, by name: what a host has to install. Statements
 * and `import()` or `require()` of a literal; a specifier written inside a template is
 * code Loupe writes into the host's files, not an import of its own.
 */
function packagesImported(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*"([^"./][^"]*)";|^\s*import\s*"([^"./][^"]*)";|\b(?:import|require)\(\s*"([^"./$][^"]*)"\s*\)/gm)) {
    const specifier = (match[1] ?? match[2] ?? match[3]) as string;
    if (specifier.startsWith("node:")) continue;
    found.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : (specifier.split("/")[0] as string));
  }
  return [...found];
}

/** The relative specifiers a built module imports, statically or dynamically. */
function relativeImports(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)["'](\.{1,2}\/[^"']+)["']/gm)) {
    found.add(match[1]!);
  }
  return [...found];
}

/** The relative specifiers a built module imports statically: what loads with it. */
function staticImports(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(/(?:\bfrom\s*|^\s*import\s*)["'](\.{1,2}\/[^"']+)["']/gm)) {
    found.add(match[1]!);
  }
  return [...found];
}

/** Every `dist` file reachable from `entry`, following relative imports (static ones only, if `only` says so). */
function closure(entry: string, only: (code: string) => string[] = relativeImports): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of only(read(file))) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      expect(existsSync(path.join(dist, target)), `${file} imports ${specifier}, missing from dist`).toBe(true);
      queue.push(target);
    }
  }
  return seen;
}

describe("dist", () => {
  beforeAll(() => {
    if (!existsSync(path.join(dist, "toolbar", "index.js"))) {
      throw new Error("No dist/toolbar/index.js: run `pnpm --filter @danarocha/loupe build` first.");
    }
  });

  it("is built by Vite on the browser side, one file per source module", () => {
    const built = new Set(jsFiles().filter(isBrowserSide));
    expect(jsFiles().filter((file) => !isBrowserSide(file) && !isUi(file) && /^\/\/ src\//m.test(read(file)))).toEqual([]);
    // A `.css` file imported as a string is a module of its own too: `chip-group.css.js`.
    const stylesheets = readdirSync(path.join(pkg, "src", "toolbar"), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".css"))
      .map((file) => `toolbar/${file.split(path.sep).join("/")}.js`);
    const expected = [...Object.keys(browserEntries()).map((name) => `${name}.js`), ...stylesheets];
    expect([...built].sort()).toEqual(expected.sort());
    // Rolldown marks each module it emits with its source path (`vite.config.ts`'s
    // `sourceMark` puts back a mark its DCE pass drops); tsc6 never does.
    // A type-only module comes out empty.
    for (const file of built) {
      if (read(file).trim() !== "") expect(read(file), file).toMatch(/^\/\/ src\//m);
    }
  });

  // Invariant 1: Next reads the markers per file.
  it.each([
    ["mount.js", "use client"],
    ["toolbar/index.js", "use client"],
    ["toolbar/workbench.js", "use client"],
    ["toolbar/flags-server.js", "use server"],
    ["toolbar/layer-server.js", "use server"],
    ["toolbar/meta-server.js", "use server"],
    ["toolbar/project-server.js", "use server"],
  ])("keeps %s's %j as its first statement", (file, directive) => {
    expect(read(file).trimStart().split("\n")[0]).toBe(`"${directive}";`);
  });

  it("puts no directive on a file whose source has none", () => {
    for (const [name, source] of Object.entries(browserEntries())) {
      const marked = /^\s*["']use (client|server)["']/.test(readFileSync(source, "utf8"));
      expect(/^\s*"use (client|server)"/.test(read(`${name}.js`)), name).toBe(marked);
    }
  });

  // Invariant 2: a second copy of the runtime would hold a registry of its own.
  it("gives the toolbar and @danarocha/loupe/runtime one runtime", () => {
    const resolved = createRequire(path.join(pkg, "package.json")).resolve("@danarocha/loupe/runtime");
    expect(resolved).toBe(path.join(dist, "runtime", "index.js"));

    const fromRuntime = closure("runtime/index.js");
    const fromToolbar = closure("toolbar/index.js");
    expect(fromRuntime).toContain("runtime/registry.js");
    expect(fromToolbar).toContain("runtime/registry.js");

    // The registry is made in exactly one file, the one both sides reach.
    const makers = jsFiles().filter((file) => read(file).includes("function createRegistry("));
    expect(makers).toEqual(["runtime/registry.js"]);
    // Nothing the toolbar reaches holds runtime code outside `runtime/`.
    for (const file of fromToolbar) {
      if (file.startsWith("runtime/")) continue;
      expect(read(file), file).not.toMatch(/^\/\/ src\/runtime\//m);
    }
  });

  // The collapsed pill costs the page little (2026-11-23): the open panel is a chunk of
  // its own, which the host's bundler splits off at `start.js`'s dynamic import.
  it("loads the open panel only through a dynamic import, never with the pill", () => {
    const pill = closure("toolbar/index.js", staticImports);
    for (const panel of ["toolbar/open.js", "toolbar/panel.js", "toolbar/highlight.js", "toolbar/proposal.js", "proposal/text.js"]) {
      expect(pill, panel).not.toContain(panel);
    }
    // The primitives and UI SDK are the panel's: the pill adopts the stylesheet's strings alone (ui/styles.js).
    for (const primitive of ["ui/index.js", "ui/chip-group/chip-group.js"]) expect(pill, primitive).not.toContain(primitive);
    expect(pill).toContain("ui/styles.js");
    expect(pill).toContain("ui/chip-group/chip-group.css.js");
    for (const file of pill) expect(read(file), file).not.toMatch(/from\s*"@ui-sdk\//);
    expect(read("toolbar/start.js")).toMatch(/\bimport\(\s*"\.\/open\.js"\s*\)/);
    expect(closure("toolbar/index.js")).toContain("toolbar/panel.js");
  });

  // Invariant 3: the host's production bundler folds the condition to the null stub (PER-127).
  it("leaves process.env.NODE_ENV around the toolbar's dynamic import in mount.js", () => {
    const mount = read("mount.js");
    expect(mount).toMatch(
      /process\.env\.NODE_ENV\s*===\s*"development"\s*\?\s*devMount\(\s*lazy\(\s*\(\)\s*=>\s*import\(\s*"\.\/toolbar\/index\.js"\s*\)\s*\)\s*\)/,
    );
    expect(mount).not.toMatch(/^\s*import\s[^(]*["']\.\/toolbar\//m);
    for (const file of jsFiles().filter(isBrowserSide)) {
      expect(read(file), file).not.toMatch(/["']production["']\s*===\s*["']development["']/);
    }
  });

  // Invariant 4: the Node side is tsc6's, at the paths it always had.
  it("keeps next.cjs, bin and the exports at their paths, as tsc6 built them", () => {
    const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
    expect(manifest.bin).toEqual({ loupe: "dist/bin.js" });
    expect(manifest.exports).toEqual({
      "./mount": { types: "./dist/mount.d.ts", default: "./dist/mount.js" },
      "./next": { types: "./dist/next.d.cts", default: "./dist/next.cjs" },
      "./runtime": { types: "./dist/runtime/index.d.ts", default: "./dist/runtime/index.js" },
      // The fixture's workbench page (ADR 0003), loaded in development only; not for hosts.
      "./workbench": { types: "./dist/toolbar/workbench.d.ts", default: "./dist/toolbar/workbench.js" },
      "./proposal.schema.json": "./proposal.schema.json",
      "./package.json": "./package.json",
    });
    for (const target of ["dist/bin.js", "dist/mount.d.ts", "dist/next.d.cts", "dist/runtime/index.d.ts"]) {
      expect(existsSync(path.join(pkg, target)), target).toBe(true);
    }

    const next = read("next.cjs");
    expect(next.startsWith('"use strict";')).toBe(true);
    expect(next).toMatch(/\bexports\.withLoupe\s*=|module\.exports\s*=/);
    expect(next).not.toMatch(/^\s*(import|export)\s/m);
    expect(read("bin.js").startsWith("#!/usr/bin/env node\n")).toBe(true);

    for (const file of jsFiles().filter((file) => !isBrowserSide(file) && !isUi(file))) {
      expect(read(file), file).not.toMatch(/^\/\/ src\//m);
    }
  });

  it("runs React Compiler on the toolbar and never on the runtime", () => {
    const compiled = (file: string) => /from\s*"react\/compiler-runtime"/.test(read(file));
    expect(compiled("toolbar/panel.js")).toBe(true);
    expect(compiled("toolbar/launcher.js")).toBe(true);
    // ToolbarOpen and usePicker: compiled, a hover leaves the Panel alone (hover-render.test.tsx).
    expect(compiled("toolbar/index.js")).toBe(true);
    expect(compiled("toolbar/open.js")).toBe(true);
    expect(compiled("toolbar/picker.js")).toBe(true);
    // @loupe/ui's own build compiled it (ADR 0010).
    expect(compiled("ui/chip-group/chip-group.js")).toBe(true);
    expect(compiled("ui/surface/index.js")).toBe(true);
    for (const file of jsFiles().filter((file) => file.startsWith("runtime/") || file === "mount.js")) {
      expect(compiled(file), file).toBe(false);
    }
  });
});

// ADR 0010: @loupe/ui is private. A published package must never depend on an unpublished one.
describe("@loupe/ui, inside dist", () => {
  it("is @loupe/ui's own build, copied whole into dist/ui", () => {
    const theirs = readdirSync(uiDist, { recursive: true, encoding: "utf8" })
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => statSync(path.join(uiDist, file)).isFile());
    expect(filesUnder("ui").sort()).toEqual(theirs.map((file) => `ui/${file}`).sort());
    for (const file of theirs) expect(read(`ui/${file}`), file).toBe(readFileSync(path.join(uiDist, file), "utf8"));
  });

  it("is reached by relative paths: nothing in dist names @loupe/ui, nor the package's folder", () => {
    for (const file of filesUnder(".")) expect(read(file), file).not.toMatch(/@loupe\/ui|packages\/ui|\/ui\/(src|dist)\//);
    // The toolbar reaches it: the panel's primitives, the pill's stylesheet, the tokens.
    expect(read("toolbar/patterns/footer/footer.js")).toContain('from "../../../ui/index.js"');
    expect(read("toolbar/surface/index.js")).toContain('from "../../ui/surface/index.js"');
    expect(read("toolbar/patterns/marks/marks.d.ts")).toContain('from "../../../ui/index.js"');
  });

  it("imports only packages @danarocha/loupe depends on, so a host's install has them", () => {
    const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
    const declared = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.peerDependencies)]);
    const imported = new Set(filesUnder(".").filter((file) => /\.(c?js|d\.c?ts)$/.test(file)).flatMap((file) => packagesImported(read(file))));
    expect([...imported].filter((name) => !declared.has(name))).toEqual([]);
    // dist/ui brings UI SDK with it: Loupe repeats @loupe/ui's pin (ADR 0010).
    expect(imported).toContain("@ui-sdk/react");
    expect(JSON.stringify(manifest)).not.toContain("@loupe/ui");
  });

  it("would catch a package imported and not declared", () => {
    const code = ['import { x } from "@loupe/ui/tokens";', 'import {\n  a,\n  b,\n} from "lodash/fp";', 'const t = await import("typescript");', "const m = `require(\"${NPM_PACKAGE}\")`;"].join("\n");
    expect(packagesImported(code)).toEqual(["@loupe/ui", "lodash", "typescript"]);
  });
});

describe("the config Vitest runs on", () => {
  it("compiles the toolbar with React Compiler, and not the runtime", async () => {
    const server = await createServer({
      configFile: path.join(pkg, "vite.config.ts"),
      logLevel: "silent",
      server: { middlewareMode: true, ws: false },
    });
    try {
      const code = async (file: string) => (await server.transformRequest(path.join(pkg, "src", file)))?.code ?? "";
      expect(await code("toolbar/launcher.tsx")).toMatch(/react[/_]compiler[-_]runtime/);
      expect(await code("runtime/adapter.ts")).not.toMatch(/react[/_]compiler[-_]runtime/);
    } finally {
      await server.close();
    }
  });
});

describe("a .css file imported as a string", () => {
  it("is the file's text in Vitest", () => {
    expect(probeCss).toContain("--probe: 1px;");
  });

  let out: string;
  beforeAll(() => {
    out = mkdtempSync(path.join(tmpdir(), "loupe-css-"));
  });
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it("is the file's text in the build", async () => {
    const entry = path.join(pkg, "test", "fixtures", "css-inline", "entry.ts");
    const config = browserConfig({ probe: entry }, out);
    const result = (await build({
      ...config,
      configFile: false,
      logLevel: "silent",
      build: { ...config.build, write: false },
    })) as Rolldown.RolldownOutput[] | Rolldown.RolldownOutput;
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    const chunks = outputs.filter((o): o is Rolldown.OutputChunk => o.type === "chunk");
    // One module per file holds for a stylesheet too: the entry imports it.
    expect(chunks.find((c) => c.isEntry)?.code).toContain('from "./probe.css.js"');
    expect(chunks.find((c) => c.fileName === "probe.css.js")?.code).toContain("--probe: 1px;");
    expect(outputs.some((o) => o.fileName.endsWith(".css"))).toBe(false);
  });
});
