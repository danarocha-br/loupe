// The package's build (ADR 0010), as ADR 0004 builds Loupe's browser side: one output
// file per source module, a `.css` file imported as a string as a module of its own,
// React Compiler on every component, nothing minified. tsc6 has already written every
// `.d.ts` into `dist`. `@danarocha/loupe` ships this `dist` as its own `dist/ui`.
//
// Vitest loads this file too (`vitest.config.ts`), so a `.css?inline` import and React
// Compiler behave the same in tests as in `dist`.

import { readdirSync } from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import { defineConfig, type PluginOption, type UserConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");

const SOURCE = /\.tsx?$/;
const NOT_SHIPPED = /\.(test|fixture)\.tsx?$|\.d\.ts$/;

/** Every shipped module, keyed by its path in `dist` without `.js`. */
export function entries(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const file of readdirSync(src, { recursive: true, encoding: "utf8" })) {
    if (!SOURCE.test(file) || NOT_SHIPPED.test(file)) continue;
    found[file.split(sep).join("/").replace(SOURCE, "")] = join(src, file);
  }
  return found;
}

/** React Compiler's options, as Loupe's (`packages/loupe/vite.config.ts`). */
export const REACT_COMPILER_OPTIONS = { target: "19" } as const;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The package's source, matched whichever separator the id uses (Vite's `/`, or Windows' `\`). */
const SOURCE_FILE = new RegExp(`^${src.split(/[\\/]/).map(escaped).join("[\\\\/]")}[\\\\/][^?]*\\.tsx?$`);

/** React Compiler, on every component of the package: none reads React internals. */
export function reactCompiler(): PluginOption {
  return babel({
    include: [SOURCE_FILE],
    exclude: [/[\\/]node_modules[\\/]/, /\.test\.tsx?$/, /\0/],
    plugins: [["babel-plugin-react-compiler", REACT_COMPILER_OPTIONS]],
  });
}

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
          // `chip-group.css` → `chip-group.css.js`, the stylesheet as a string.
          entryFileNames: (chunk) => (/\.css(?:$|\?)/.test(chunk.facadeModuleId ?? "") ? "[name].css.js" : "[name].js"),
        },
      },
    },
  };
}

export default defineConfig(config(entries(), "dist"));
