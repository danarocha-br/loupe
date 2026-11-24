// The browser side's build (ADR 0004): `mount`, `runtime/` and `toolbar/`, one
// output file per source module. tsc6 has already built the whole package and
// every `.d.ts` into `dist`; this step rewrites the browser side's `.js` over it.
//
// What it must keep true, each with a test in `src/build.test.ts`:
// - `"use client"` and `"use server"` stay first in their own files;
// - the toolbar and `@danarocha/loupe/runtime` reach the same runtime files;
// - `process.env.NODE_ENV` is left for the host's bundler to fold;
// - the Node side (`next.cjs`, `bin`, the loader, ...) is tsc6's output, untouched.
//
// Vitest loads this file too (`vitest.config.ts`), so a `.css?inline` import and
// React Compiler behave the same in tests as in `dist`.

import { readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import { defineConfig, type Plugin, type PluginOption, type UserConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");

/** The browser side, as `src`-relative directories and files. */
const BROWSER = ["mount.ts", "runtime", "toolbar"];

const SOURCE = /\.tsx?$/;
const NOT_SHIPPED = /\.(test|fixture)\.tsx?$|\.d\.ts$/;

function isBrowserSide(file: string): boolean {
  const rel = relative(src, file).split(sep).join("/");
  return BROWSER.some((entry) => rel === entry || rel.startsWith(`${entry}/`));
}

/** Every shipped module of the browser side, keyed by its path in `dist` without `.js`. */
export function browserEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const entry of BROWSER) {
    const full = join(src, entry);
    const files = SOURCE.test(entry)
      ? [full]
      : readdirSync(full, { recursive: true, encoding: "utf8" }).map((file) => join(full, file));
    for (const file of files) {
      if (!SOURCE.test(file) || NOT_SHIPPED.test(file)) continue;
      const name = relative(src, file).split(sep).join("/").replace(SOURCE, "");
      entries[name] = file;
    }
  }
  return entries;
}

/**
 * A browser-side module that imports a Node-side one (`../call-site.js`,
 * `../writes.js`, ...) keeps importing tsc6's file in `dist` rather than taking a
 * copy of it. Build only: tests import the sources.
 */
function nodeSideExternal(): Plugin {
  return {
    name: "loupe:node-side-external",
    apply: "build",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer || !source.startsWith(".") || source.includes("?")) return null;
      const target = resolve(dirname(importer), source);
      if (!target.startsWith(src + sep) || isBrowserSide(target)) return null;
      // Rendered relative to the importing chunk: `dist` mirrors `src`.
      const js = extname(target) === ".js" ? target : target.replace(/\.[cm]?tsx?$/, ".js");
      return { id: js, external: true };
    },
  };
}

/** React Compiler's options, here and in `toolbar/compiled.test.ts`, which checks what it compiles. */
export const REACT_COMPILER_OPTIONS = { target: "19" } as const;

/** React Compiler, on `toolbar/` only. `runtime/` reads React internals while it renders. */
export function reactCompiler(): PluginOption {
  return babel({
    include: [/[\\/]src[\\/]toolbar[\\/][^?]*\.tsx?$/],
    exclude: [/[\\/]node_modules[\\/]/, /\.test\.tsx?$/, /\0/],
    plugins: [["babel-plugin-react-compiler", REACT_COMPILER_OPTIONS]],
  });
}

/**
 * Every built module keeps the `// src/...` line Rolldown heads it with, the mark
 * `src/build.test.ts` tells Vite's output from tsc6's by. Rolldown attaches it to the
 * module's first statement, and `build.minify: false` still runs its `"dce-only"` pass,
 * which folds a `const` used once into its one use and loses the line with it:
 * `tokens.ts` opens with `LIGHT_COLOR`, folded into `COLOR`. Where the line is lost, this
 * writes it back after the pass, where Rolldown puts it: after the directive and imports.
 * Turning the pass off instead would leave the imports of every inlined constant behind.
 */
function sourceMark(): Plugin {
  return {
    name: "loupe:source-mark",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        const id = chunk.type === "chunk" ? chunk.facadeModuleId : null;
        if (chunk.type !== "chunk" || !id?.startsWith(src + sep)) continue;
        if (chunk.code.trim() === "" || /^\/\/ src\//m.test(chunk.code)) continue;
        const lines = chunk.code.split("\n");
        let at = 0;
        while (/^(?:"use \w+";|import\b.*;)\s*$/.test(lines[at] ?? "")) at++;
        lines.splice(at, 0, `// ${relative(root, id).split(sep).join("/")}`);
        chunk.code = lines.join("\n");
      }
    },
  };
}

const isBare = (id: string) => !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id);

/** The build, for any set of entries: `dist` gets the browser side; a test builds a probe. */
export function browserConfig(entry: Record<string, string>, outDir: string): UserConfig {
  return {
    root,
    plugins: [nodeSideExternal(), reactCompiler(), sourceMark()],
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
        // With one module per file, Rolldown keeps each `"use client"` and
        // `"use server"` first in its own file, which is all Next needs; its
        // warning is about merged chunks. `src/build.test.ts` checks the markers.
        onLog(level, log, handler) {
          if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
          handler(level, log);
        },
        output: {
          preserveModules: true,
          preserveModulesRoot: "src",
          // A `.css?inline` import is a module of its own, the stylesheet as a
          // string, named after its file: `chip-group.css` → `chip-group.css.js`.
          entryFileNames: (chunk) => (/\.css(?:$|\?)/.test(chunk.facadeModuleId ?? "") ? "[name].css.js" : "[name].js"),
        },
      },
    },
  };
}

export default defineConfig(browserConfig(browserEntries(), "dist"));
