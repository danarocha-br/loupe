// The browser side's build (ADR 0004): `mount`, `runtime/` and `toolbar/`, one
// output file per source module. tsc6 has already built the whole package and
// every `.d.ts` into `dist`; this step rewrites the browser side's `.js` over it.
//
// What it must keep true, each with a test in `src/build.test.ts`:
// - `"use client"` and `"use server"` stay first in their own files;
// - the toolbar and `@danarocha/loupe/runtime` reach the same runtime files;
// - `process.env.NODE_ENV` is left for the host's bundler to fold;
// - the Node side (`next.cjs`, `bin`, the loader, ...) is tsc6's output, untouched;
// - `@loupe/ui` and `@loupe/patterns`, private, are shipped inside `dist/ui` and
//   `dist/patterns` and named nowhere in `dist` (ADR 0010, 0012).
//
// Vitest loads this file too (`vitest.config.ts`), so a `.css?inline` import and
// React Compiler behave the same in tests as in `dist`.

import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import { defineConfig, type Plugin, type PluginOption, type UserConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");

/**
 * The private workspace packages Loupe ships inside its `dist` (ADR 0010, 0012): `@loupe/ui`, the
 * design system, in `dist/ui`; `@loupe/patterns`, the Toolbar's patterns on it, in `dist/patterns`.
 * `package.json` names neither: each is reached by path, and each builds itself first.
 */
const PACKAGES = { "@loupe/ui": "ui", "@loupe/patterns": "patterns" } as const;
type Package = keyof typeof PACKAGES;
/** A package's folder beside this one, which is also its folder in `dist`: `ui`, `patterns`. */
const folder = (name: Package) => join(root, "..", PACKAGES[name]);
const ui = folder("@loupe/ui");
const uiSrc = join(ui, "src");
const patterns = folder("@loupe/patterns");
const patternsSrc = join(patterns, "src");
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A folder's source files, as a pattern that matches whichever separator the id uses (Vite's `/`, or Windows' `\`). */
const sourceIn = (dir: string) => new RegExp(`^${dir.split(/[\\/]/).map(escaped).join("[\\\\/]")}[\\\\/][^?]*\\.tsx?$`);

/**
 * A package's entries, each to its source file: `@loupe/ui/surface` → `…/ui/src/surface/index.tsx`.
 * Only those in its `src`: one outside it is for its own development (`@loupe/ui/workbench`),
 * never built, and never Loupe's.
 */
function packageEntries(name: Package): Record<string, string> {
  const manifest = JSON.parse(readFileSync(join(folder(name), "package.json"), "utf8")) as { exports: Record<string, string> };
  const found: Record<string, string> = {};
  for (const [entry, target] of Object.entries(manifest.exports)) {
    if (entry === "./package.json" || !target.startsWith("./src/")) continue;
    found[entry === "." ? name : `${name}/${entry.slice(2)}`] = join(folder(name), target);
  }
  return found;
}

/** `@loupe/ui`'s entries, each to its source file. */
export const uiEntries = (): Record<string, string> => packageEntries("@loupe/ui");
/** `@loupe/patterns`' entries, each to its source file: `@loupe/patterns/tokens` → `…/patterns/src/tokens.ts`. */
export const patternsEntries = (): Record<string, string> => packageEntries("@loupe/patterns");
/** Both packages' entries. */
export const workspaceEntries = (): Record<string, string> => ({ ...uiEntries(), ...patternsEntries() });

/** An entry only tests may import: its target is a `.fixture` file, which no build ships. */
export const isTestEntry = (target: string) => /\.fixture\.tsx?$/.test(target);

/**
 * Where a package's source module is built, in `dist` (relative to it): `…/ui/src/tokens.ts` →
 * `ui/tokens.js`, `…/patterns/src/footer/footer.tsx` → `patterns/footer/footer.js`.
 */
export function vendoredPath(source: string): string {
  for (const name of Object.keys(PACKAGES) as Package[]) {
    const src = join(folder(name), "src");
    if (source.startsWith(src + sep)) return `${PACKAGES[name]}/${relative(src, source).split(sep).join("/").replace(/\.tsx?$/, ".js")}`;
  }
  throw new Error(`${source} is in neither @loupe/ui nor @loupe/patterns`);
}

const WORKSPACE_SPECIFIER = /^@loupe\/(?:ui|patterns)(?:\/[\w-]+)?$/;

/**
 * `@loupe/ui` and `@loupe/patterns`, reached by path, since `package.json` names neither
 * (ADR 0010, 0012). In tests and in a dev server, an entry is its source, which Vite
 * transforms with Loupe's own; so is an import of `@loupe/ui` from inside `@loupe/patterns`.
 * In the build each stays external, rendered as a relative path into `dist/ui` or
 * `dist/patterns`, as `nodeSideExternal` renders the Node side: `dist` mirrors `src`, and
 * `dist/ui` sits where a `src/ui` would. A test-only entry in a shipped module fails the build.
 */
function loupeWorkspace(): Plugin {
  let building = false;
  return {
    name: "loupe:workspace",
    enforce: "pre",
    configResolved(config) {
      building = config.command === "build";
    },
    resolveId(source) {
      if (!WORKSPACE_SPECIFIER.test(source)) return null;
      const target = workspaceEntries()[source];
      if (!target) return null;
      if (!building) return target;
      if (isTestEntry(target)) this.error(`${source} is for tests, and is never shipped.`);
      return { id: join(src, vendoredPath(target)), external: "relative" };
    },
  };
}

/**
 * Points each `@loupe/ui` or `@loupe/patterns` specifier in a built file at the module it
 * names in `dist`, relative to the file: in `dist/toolbar/panel.d.ts`, `"@loupe/patterns"` →
 * `"../patterns/index.js"`; in `dist/patterns/footer/footer.js`, `"@loupe/ui"` →
 * `"../../ui/index.js"`. `file` is the file's path in `dist`, with `/`. A specifier no entry
 * names is left as it is, for `src/build.test.ts` to catch.
 */
export function pointIntoDist(code: string, file: string): string {
  const entries = workspaceEntries();
  return code.replace(/(["'])(@loupe\/(?:ui|patterns)(?:\/[\w-]+)?)\1/g, (whole, quote: string, specifier: string) => {
    const entry = entries[specifier];
    if (!entry) return whole;
    const path = posix.relative(posix.dirname(file), vendoredPath(entry));
    return `${quote}${path.startsWith(".") ? path : `./${path}`}${quote}`;
  });
}

/**
 * Ships both packages: copies each one's `dist` (its own build, ADR 0010, 0012) into
 * `dist/ui` and `dist/patterns`, then points what still names them at those copies: the
 * `.d.ts` tsc6 wrote (`@loupe/ui/tokens` → `../ui/tokens.js`), and `dist/patterns`' own
 * modules, which import `@loupe/ui` (→ `../ui/index.js`). Nothing in `dist` names a private
 * package; `src/build.test.ts` checks it, and that each copy is its package's build but for that.
 */
function vendorWorkspace(): Plugin {
  let out = "";
  return {
    name: "loupe:vendor-workspace",
    apply: "build",
    configResolved(config) {
      out = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      for (const name of Object.keys(PACKAGES) as Package[]) {
        const target = join(out, PACKAGES[name]);
        rmSync(target, { recursive: true, force: true });
        cpSync(join(folder(name), "dist"), target, { recursive: true });
      }
      for (const file of readdirSync(out, { recursive: true, encoding: "utf8" })) {
        const path = file.split(sep).join("/");
        // dist/ui imports nothing of either; Loupe's own `.js` reach them by relative paths already.
        const named = /\.d\.c?ts$/.test(path) ? !path.startsWith("ui/") : path.startsWith("patterns/") && path.endsWith(".js");
        if (!named) continue;
        const full = join(out, file);
        const code = readFileSync(full, "utf8");
        const rewritten = pointIntoDist(code, path);
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
 * And on `@loupe/ui`'s and `@loupe/patterns`' source, which tests and a dev server load as it
 * is: their own builds compile what `dist/ui` and `dist/patterns` ship (ADR 0010, 0012).
 */
export function reactCompiler(): PluginOption {
  return babel({
    include: [/[\\/]src[\\/]toolbar[\\/][^?]*\.tsx?$/, sourceIn(uiSrc), sourceIn(patternsSrc)],
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

/** A package the host installs, left as it is written. Not `@loupe/ui` nor `@loupe/patterns`: `loupeWorkspace()` points them into `dist`. */
const isBare = (id: string) => !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id) && !WORKSPACE_SPECIFIER.test(id);

/** The build, for any set of entries: `dist` gets the browser side; a test builds a probe. */
export function browserConfig(entry: Record<string, string>, outDir: string): UserConfig {
  return {
    root,
    plugins: [loupeWorkspace(), nodeSideExternal(), reactCompiler(), sourceMark()],
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
export default defineConfig({ ...dist, plugins: [...(dist.plugins ?? []), vendorWorkspace()] });
