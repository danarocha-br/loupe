// The browser side's build (ADR 0004): `mount`, `runtime/` and `toolbar/`, one
// output file per source module. tsc6 has already built the whole package and
// every `.d.ts` into `dist`; this step rewrites the browser side's `.js` over it.
//
// What it must keep true, each with a test in `src/build.test.ts`:
// - `"use client"` and `"use server"` stay first in their own files;
// - the toolbar and `@danarocha/loupe/runtime` reach the same runtime files;
// - `process.env.NODE_ENV` is left for the host's bundler to fold;
// - the Node side (`next.cjs`, `bin`, the loader, ...) is tsc6's output, untouched;
// - `@loupe/ui`, private, is shipped inside `dist/ui` and named nowhere in `dist` (ADR 0010).
//
// Vitest loads this file too (`vitest.config.ts`), so a `.css?inline` import and
// React Compiler behave the same in tests as in `dist`.

import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import { defineConfig, type Plugin, type PluginOption, type UserConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");

/** `@loupe/ui`, the design system (ADR 0010): a private workspace package, bundled into `dist/ui`. */
const ui = join(root, "..", "ui");
const uiSrc = join(ui, "src");
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `@loupe/ui`'s entries, each to its source file: `@loupe/ui/surface` → `…/ui/src/surface/index.tsx`. */
export function uiEntries(): Record<string, string> {
  const manifest = JSON.parse(readFileSync(join(ui, "package.json"), "utf8")) as { exports: Record<string, string> };
  const found: Record<string, string> = {};
  for (const [entry, target] of Object.entries(manifest.exports)) {
    if (entry === "./package.json") continue;
    found[entry === "." ? "@loupe/ui" : `@loupe/ui/${entry.slice(2)}`] = join(ui, target);
  }
  return found;
}

/** Where a `@loupe/ui` source module is built, in `dist/ui` (relative to `dist`): `…/ui/src/tokens.ts` → `ui/tokens.js`. */
export const uiDistPath = (source: string) => `ui/${relative(uiSrc, source).split(sep).join("/").replace(/\.tsx?$/, ".js")}`;

const UI_SPECIFIER = /^@loupe\/ui(?:\/[\w-]+)?$/;

/**
 * `@loupe/ui`, reached by path, since `package.json` never names it (ADR 0010). In tests
 * and in a dev server, an entry is its source, which Vite transforms with Loupe's own.
 * In the build it stays external, rendered as a relative path into `dist/ui`, as
 * `nodeSideExternal` renders the Node side: `dist` mirrors `src`, and `dist/ui` sits
 * where a `src/ui` would. A test-only entry in a shipped module fails the build.
 */
function loupeUi(): Plugin {
  let building = false;
  return {
    name: "loupe:ui",
    enforce: "pre",
    configResolved(config) {
      building = config.command === "build";
    },
    resolveId(source) {
      if (!UI_SPECIFIER.test(source)) return null;
      const target = uiEntries()[source];
      if (!target) return null;
      if (!building) return target;
      if (/\.fixture\.tsx?$/.test(target)) this.error(`${source} is for tests, and is never shipped.`);
      return { id: join(src, uiDistPath(target)), external: "relative" };
    },
  };
}

/**
 * Ships `@loupe/ui`: copies its `dist` (its own build, ADR 0010) into `dist/ui`, then points
 * the `.d.ts` tsc6 wrote at it, `@loupe/ui/tokens` → `../ui/tokens.js`, so nothing in
 * `dist` names the private package. `src/build.test.ts` checks both.
 */
function vendorUi(outDir: string): Plugin {
  return {
    name: "loupe:vendor-ui",
    apply: "build",
    writeBundle() {
      const out = resolve(root, outDir);
      const target = join(out, "ui");
      rmSync(target, { recursive: true, force: true });
      cpSync(join(ui, "dist"), target, { recursive: true });
      const entries = uiEntries();
      for (const file of readdirSync(out, { recursive: true, encoding: "utf8" })) {
        if (!/\.d\.c?ts$/.test(file) || file.startsWith(`ui${sep}`)) continue;
        const full = join(out, file);
        const code = readFileSync(full, "utf8");
        const rewritten = code.replace(/(["'])(@loupe\/ui(?:\/[\w-]+)?)\1/g, (whole, quote: string, specifier: string) => {
          const entry = entries[specifier];
          if (!entry) return whole;
          const path = relative(dirname(full), join(out, uiDistPath(entry))).split(sep).join("/");
          return `${quote}${path.startsWith(".") ? path : `./${path}`}${quote}`;
        });
        if (rewritten !== code) writeFileSync(full, rewritten);
      }
    },
  };
}

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

/**
 * React Compiler, on `toolbar/` only. `runtime/` reads React internals while it renders.
 * And on `@loupe/ui`'s source, which tests and a dev server load as it is: its own build
 * compiles what `dist/ui` ships (ADR 0010).
 */
export function reactCompiler(): PluginOption {
  return babel({
    include: [/[\\/]src[\\/]toolbar[\\/][^?]*\.tsx?$/, new RegExp(`^${escaped(uiSrc)}[\\\\/][^?]*\\.tsx?$`)],
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

/** A package the host installs, left as it is written. Not `@loupe/ui`: `loupeUi()` points it into `dist/ui`. */
const isBare = (id: string) => !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id) && !UI_SPECIFIER.test(id);

/** The build, for any set of entries: `dist` gets the browser side; a test builds a probe. */
export function browserConfig(entry: Record<string, string>, outDir: string): UserConfig {
  return {
    root,
    plugins: [loupeUi(), nodeSideExternal(), reactCompiler(), sourceMark()],
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

const dist = browserConfig(browserEntries(), "dist");
export default defineConfig({ ...dist, plugins: [...(dist.plugins ?? []), vendorUi("dist")] });
