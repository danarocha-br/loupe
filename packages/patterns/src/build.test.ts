// The package's build (ADR 0012, as ADR 0010 builds @loupe/ui): tsc6 writes every `.d.ts`, then
// Vite writes the `.js`, one file per source module. These tests read `dist`, so they run after
// a build: `pnpm build` ends with them. Loupe's build copies this `dist` into its own as
// `dist/patterns`, points its `@loupe/ui` imports at `dist/ui`, and its `src/build.test.ts`
// checks the copy.

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

/**
 * The bare specifiers a built module imports, by its statements and `import()` of a literal: the
 * packages a host has to install. Not a string that reads like one: a sample's command does.
 */
const bareImports = (code: string) =>
  [...code.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"'.][^"']*)["'];|^\s*import\s*["']([^"'.][^"']*)["'];|\bimport\(\s*["']([^"'.][^"']*)["']\s*\)/gm)].map(
    (match) => (match[1] ?? match[2] ?? match[3]) as string,
  );

describe("dist", () => {
  beforeAll(() => {
    if (!existsSync(path.join(dist, "index.js"))) throw new Error("No dist/index.js: run `pnpm --filter @loupe/patterns build` first.");
  });

  it("holds one .js and one .d.ts per shipped module, and one .css.js per stylesheet", () => {
    const stylesheets = readdirSync(path.join(pkg, "src"), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".css"))
      .map((file) => `${file.split(path.sep).join("/")}.js`);
    const modules = Object.keys(entries());
    const expected = [...modules.map((name) => `${name}.js`), ...modules.map((name) => `${name}.d.ts`), ...stylesheets];
    expect(files().sort()).toEqual(expected.sort());
    for (const entry of ["index", "launcher/launcher", "stylesheet", "tokens", "view"]) expect(modules).toContain(entry);
    // Neither the tests nor their host, nor the sample data they and the workbench draw.
    expect(modules.some((name) => /\.(test|fixture)$/.test(name) || name === "samples")).toBe(false);
  });

  it("imports only React and @loupe/ui's shipped entries, and names no Loupe package", () => {
    for (const file of files()) {
      for (const specifier of bareImports(read(file))) expect(specifier, file).toMatch(/^(react|react-dom)(\/|$)|^@loupe\/ui(\/(surface|tokens|announcer))?$/);
      expect(read(file), file).not.toMatch(/@danarocha\/loupe|@ui-sdk\/|@loupe\/patterns/);
    }
  });

  it("holds nothing of the workbench's dev server: no React Refresh, no HMR", () => {
    // `workbench/vite.ts` adds them to the workbench alone; the build's config has neither.
    for (const file of files()) expect(read(file), file).not.toMatch(/\$Refresh(Reg|Sig)\$|react-refresh|import\.meta\.hot/);
  });

  it("runs React Compiler on the components", () => {
    const compiled = (file: string) => /from\s*"react\/compiler-runtime"/.test(read(file));
    expect(compiled("footer/footer.js")).toBe(true);
    expect(compiled("launcher/launcher.js")).toBe(true);
    // The stylesheet's strings: no component, no compiler.
    expect(read("styles.js")).not.toMatch(/react/);
    expect(read("stylesheet.js")).not.toMatch(/compiler-runtime/);
  });

  it("keeps the collapsed pill's entries off the components: the stylesheet and the pill load no other pattern", () => {
    const staticImports = (file: string) => [...read(file).matchAll(/(?:\bfrom\s*|^\s*import\s*)["'](\.{1,2}\/[^"']+)["']/gm)].map((match) => match[1] as string);
    const closure = (entry: string) => {
      const seen = new Set<string>();
      const queue = [entry];
      while (queue.length > 0) {
        const file = queue.pop() as string;
        if (seen.has(file)) continue;
        seen.add(file);
        for (const specifier of staticImports(file)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
      }
      return seen;
    };
    expect([...closure("stylesheet.js")].filter((file) => !file.endsWith(".css.js")).sort()).toEqual(["styles.js", "stylesheet.js", "tokens.js"]);
    expect([...closure("launcher/launcher.js")].filter((file) => !file.endsWith(".css.js")).sort()).toEqual(["launcher/launcher.js"]);
  });
});
