// The package's build (ADR 0010): tsc6 writes every `.d.ts`, then Vite writes the `.js`,
// one file per source module, as Loupe's browser side is built (ADR 0004). These tests read
// `dist`, so they run after a build: `pnpm build` ends with them. Loupe's build copies this
// `dist` into its own as `dist/ui`, and its `src/build.test.ts` checks the copy.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { entries } from "../vite.config.js";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(pkg, "dist");
const read = (file: string) => readFileSync(path.join(dist, file), "utf8");
const files = () =>
  readdirSync(dist, { recursive: true, encoding: "utf8" })
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => statSync(path.join(dist, file)).isFile());

/** The bare specifiers a built module imports: the packages a host has to install. */
const bareImports = (code: string) =>
  [...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)["']([^"'.][^"']*)["']/gm)].map((match) => match[1] as string);

describe("dist", () => {
  beforeAll(() => {
    if (!existsSync(path.join(dist, "index.js"))) throw new Error("No dist/index.js: run `pnpm --filter @loupe/ui build` first.");
  });

  it("holds one .js and one .d.ts per shipped module, and one .css.js per stylesheet", () => {
    const stylesheets = readdirSync(path.join(pkg, "src"), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".css"))
      .map((file) => `${file.split(path.sep).join("/")}.js`);
    const modules = Object.keys(entries());
    const expected = [...modules.map((name) => `${name}.js`), ...modules.map((name) => `${name}.d.ts`), ...stylesheets];
    expect(files().sort()).toEqual(expected.sort());
    expect(modules).toContain("index");
    expect(modules.some((name) => /\.(test|fixture)$/.test(name))).toBe(false);
  });

  it("imports only React and UI SDK, and names no Loupe package", () => {
    for (const file of files()) {
      for (const specifier of bareImports(read(file))) expect(specifier, file).toMatch(/^(react|react-dom)(\/|$)|^@ui-sdk\/(react|core)(\/|$)/);
      expect(read(file), file).not.toMatch(/@danarocha\/loupe|@loupe\/ui/);
    }
  });

  it("runs React Compiler on the components", () => {
    const compiled = (file: string) => /from\s*"react\/compiler-runtime"/.test(read(file));
    expect(compiled("chip-group/chip-group.js")).toBe(true);
    expect(compiled("surface/index.js")).toBe(true);
    // The collapsed chrome's strings: no component, no compiler, no UI SDK.
    expect(read("styles.js")).not.toMatch(/react|@ui-sdk/);
  });
});
