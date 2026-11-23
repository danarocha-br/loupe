// The build (ADR 0004): tsc6 builds the Node side and every `.d.ts`, then Vite
// rewrites the browser side's `.js`, one file per module. These tests read `dist`,
// so they run after a build: `pnpm build` ends with them, and CI builds first.

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

/** The relative specifiers a built module imports, statically or dynamically. */
function relativeImports(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)["'](\.{1,2}\/[^"']+)["']/gm)) {
    found.add(match[1]!);
  }
  return [...found];
}

/** Every `dist` file reachable from `entry`, following relative imports. */
function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of relativeImports(read(file))) {
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
    const expected = Object.keys(browserEntries()).map((name) => `${name}.js`);
    expect([...built].sort()).toEqual(expected.sort());
    // Rolldown marks each module it emits with its source path; tsc6 never does.
    // A type-only module comes out empty.
    for (const file of built) {
      if (read(file).trim() !== "") expect(read(file), file).toMatch(/^\/\/ src\//m);
    }
  });

  // Invariant 1: Next reads the markers per file.
  it.each([
    ["mount.js", "use client"],
    ["toolbar/index.js", "use client"],
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

    for (const file of jsFiles().filter((file) => !isBrowserSide(file))) {
      expect(read(file), file).not.toMatch(/^\/\/ src\//m);
    }
  });

  it("runs React Compiler on the toolbar and never on the runtime", () => {
    const compiled = (file: string) => /from\s*"react\/compiler-runtime"/.test(read(file));
    expect(compiled("toolbar/panel.js")).toBe(true);
    expect(compiled("toolbar/launcher.js")).toBe(true);
    for (const file of jsFiles().filter((file) => file.startsWith("runtime/") || file === "mount.js")) {
      expect(compiled(file), file).toBe(false);
    }
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
