// The package's build (ADR 0012), as `@loupe/ui` builds itself (ADR 0010) and ADR 0004
// builds Loupe's browser side: one output file per source module, a `.css` file imported as
// a string as a module of its own, React Compiler on every component, nothing minified.
// tsc6 has already written every `.d.ts` into `dist`. `@loupe/ui` stays a bare import here;
// `@danarocha/loupe` ships this `dist` as its own `dist/patterns`, and points those imports
// at the `dist/ui` it ships beside it.
//
// Vitest and the workbench load this file too (`vitest.config.ts`, `workbench/vite.config.ts`),
// so a `.css?inline` import and React Compiler behave the same there as in `dist`.

import { readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import { defineConfig, type PluginOption, type UserConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");

const SOURCE = /\.tsx?$/;
/** What `dist` leaves out: the tests, the fixtures (the test host among them) and the type declarations. */
const NOT_SHIPPED = /\.(test|fixture)\.tsx?$|\.d\.ts$/;

/** Every shipped module, keyed by its path in `dist` without `.js`. */
export function entries(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const file of readdirSync(src, { recursive: true, encoding: "utf8" })) {
    const name = file.split(sep).join("/");
    if (!SOURCE.test(name) || NOT_SHIPPED.test(name)) continue;
    found[name.replace(SOURCE, "")] = join(src, file);
  }
  return found;
}

/** React Compiler's options, as `@loupe/ui`'s and Loupe's. */
export const REACT_COMPILER_OPTIONS = { target: "19" } as const;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A folder's source files, matched whichever separator the id uses (Vite's `/`, or Windows' `\`). */
const sourceIn = (dir: string) => new RegExp(`^${dir.split(/[\\/]/).map(escaped).join("[\\\\/]")}[\\\\/][^?]*\\.tsx?$`);

/**
 * `@loupe/ui`'s source, where the workspace links it: tests and the workbench draw its
 * primitives from it, compiled as its own build compiles them. Found by the package's own
 * name, never by a path out of this one.
 */
const uiSrc = join(dirname(realpathSync(createRequire(import.meta.url).resolve("@loupe/ui/package.json"))), "src");

/**
 * React Compiler, on every component of the package, and on `@loupe/ui`'s where tests and
 * the workbench load its source: none reads React internals. The build leaves `@loupe/ui`
 * external, so there it compiles this package alone.
 */
export function reactCompiler(): PluginOption {
  return babel({
    include: [sourceIn(src), sourceIn(uiSrc)],
    exclude: [/[\\/]node_modules[\\/]/, /\.test\.tsx?$/, /\0/],
    plugins: [["babel-plugin-react-compiler", REACT_COMPILER_OPTIONS]],
  });
}

/** React, and `@loupe/ui` by its entries: left as they are written. */
const isBare = (id: string) => !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id);

export function config(entry: Record<string, string>, outDir: string): UserConfig {
  return {
    root,
    plugins: [reactCompiler()],
    oxc: { include: /\.[cm]?tsx?$/, jsx: { runtime: "automatic" } },
    build: {
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      target: "es2022",
      reportCompressedSize: false,
      lib: { entry, formats: ["es"] },
      rolldownOptions: {
        external: isBare,
        output: {
          preserveModules: true,
          preserveModulesRoot: "src",
          // `footer.css` → `footer.css.js`, the stylesheet as a string.
          entryFileNames: (chunk) => (/\.css(?:$|\?)/.test(chunk.facadeModuleId ?? "") ? "[name].css.js" : "[name].js"),
        },
      },
    },
  };
}

export default defineConfig(config(entries(), "dist"));
