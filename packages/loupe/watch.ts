// `pnpm --filter @danarocha/loupe watch`: the Toolbar's edit loop, on the fixture's `next dev`.
//
// An edit to Loupe's browser side (`src/toolbar/**`, `src/runtime/**`, `src/mount.ts`), to a
// pattern or to a primitive reaches the open page in a second or two, by Fast Refresh, with
// the panel's state kept; a build takes about 27 s and breaks the page while it runs. Each of
// the build's steps runs in watch mode, with its own config:
// - `@loupe/ui`'s Vite build, for `dist/ui`;
// - `@loupe/patterns`' Vite build, for `dist/patterns`, its `@loupe/ui` pointed into `dist/ui`;
// - Loupe's browser side, Vite's build, for `mount.js`, `runtime/` and `toolbar/`;
// - tsc6, for the Node side the browser side imports (`call-site.js`, `writes.js`, ...).
//
// Why a build breaks `next dev`: Turbopack watches `packages/loupe/dist` through the fixture's
// workspace link and compiles whatever is there at each change. The build deletes `dist`;
// then tsc6 writes every `.js`, the browser side's among them still naming `@loupe/ui` and
// `@loupe/patterns`, which the host can't resolve; Vite only then writes the browser side over
// them. For the seconds between, the page has "Module not found" errors, and then it reloads.
// So the watch never writes into `dist` as it builds: each step writes into its own folder in
// `node_modules/.cache/loupe-watch`, and after each rebuild only the files whose bytes changed
// move into `dist`, each by a rename. Next sees one whole file at a time, and only those.
//
// It writes the build's bytes (`src/watch.test.ts`), but for one addition (`watched`). The
// Toolbar adopts its stylesheet once, in an effect, and under Next's Strict Mode a Fast Refresh
// doesn't run an effect again whose dependencies haven't changed (React renders twice, and the
// second render compares them as usual): a pattern's or a primitive's `.css` would reach the
// page and never the Toolbar's shadow root. So the watch's `toolbar/surface/index.js`, which
// Fast Refresh runs again whenever the stylesheet changes, swaps it into that root in place
// (`SWAP`), as the workbenches swap theirs. The page's own surfaces take it already.
//
// React Compiler's caches need nothing: React empties a component's cache when Fast Refresh
// gives it new code. An edit to a primitive's `.css` or to a token remounts the Toolbar rather
// than refreshing it: it runs `@loupe/ui`'s surface module again, whose `SurfaceBoundary` is a
// class, and Fast Refresh always remounts a class.
//
// What it leaves to the build:
// - `.d.ts`, which `next dev` never reads;
// - the Node side Next itself loads (`next.cjs`, `loader.cjs`): the watch rewrites it, but
//   Next reads it when it starts; restart `next dev` after an edit there;
// - code that runs once, as the Toolbar mounts (an effect with constant dependencies), which
//   shows its edit after a reload, for the same reason as the stylesheet;
// - a module deleted from `src`, which stays in `dist` until the next build.
//
// The build owns `dist`, and starts by deleting it. A `dist` with the swap in it, or a watch
// still running, fails `src/build.test.ts`, which ends every build and so every `npm pack`: no
// watch output reaches a tarball.

import { spawn } from "node:child_process";
import { existsSync, type FSWatcher, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type InlineConfig, runnerImport, type Rolldown, type UserConfig } from "vite";
import type * as PatternsConfig from "../patterns/vite.config.js";
import type * as UiConfig from "../ui/vite.config.js";
import type * as LoupeConfig from "./vite.config.js";

const root = dirname(fileURLToPath(import.meta.url));

/** Where each step writes before its changed files move into `dist`. */
export const WATCH_DIR = join(root, "node_modules", ".cache", "loupe-watch");
/** The running watch's pid, which `src/build.test.ts` looks for. */
export const PID_FILE = join(WATCH_DIR, "pid");

/** The module the swap goes in, and the line that starts it: what `src/build.test.ts` looks for. */
export const SWAPPED = "toolbar/surface/index.js";
export const SWAP_MARK = "// Added by `pnpm watch` (watch.ts), never by the build:";

/**
 * The swap: when Fast Refresh runs the surface's module again, with the new `STYLESHEET`, the
 * Toolbar's root adopts it in place of the old one. `adoptStylesheet` replaces the sheet it put
 * there itself; a fresh copy of `@loupe/ui`'s surface module, which an edit to a primitive's
 * `.css` or a token makes, knows none and adds its own. So the root keeps one of Loupe's sheets,
 * known by the stylesheet's first rule, its layers: the one this adopt put there. At the first
 * run there is no root yet, and on the server no document.
 */
const SWAP = `
${SWAP_MARK} a stylesheet edit reaches the Toolbar's root.
import { adoptStylesheet as loupeWatchAdopt } from "../../ui/surface/index.js";
if (typeof document !== "undefined") {
  const layers = STYLESHEET.slice(0, STYLESHEET.indexOf(";") + 1);
  const isLoupe = (sheet) => sheet.cssRules[0]?.cssText === layers;
  for (const host of document.querySelectorAll(\`[\${HOST_ATTRIBUTE}]\`)) {
    const root = host.shadowRoot;
    if (!root) continue;
    const before = new Set(root.adoptedStyleSheets ?? []);
    loupeWatchAdopt(root, STYLESHEET);
    // Where the browser constructs no sheet, it replaced its own \`<style>\`: nothing to drop.
    if (!root.adoptedStyleSheets) continue;
    const added = root.adoptedStyleSheets.find((sheet) => !before.has(sheet));
    if (added) root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet === added || !isLoupe(sheet));
  }
}
`;

/** `toolbar/surface/index.js` with the swap. It throws if the module no longer imports what the swap uses. */
export function withSwap(code: string): string {
  if (!/\bimport \{[^}]*\bHOST_ATTRIBUTE\b/.test(code) || !/\bimport \{[^}]*\bSTYLESHEET\b/.test(code)) {
    throw new Error(`${SWAPPED} no longer imports HOST_ATTRIBUTE and STYLESHEET: the watch's stylesheet swap needs both.`);
  }
  return code + SWAP;
}

/** Every file under `dir`, relative to it, with `/` separators. */
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => statSync(join(dir, file)).isFile())
    .map((file) => file.split(sep).join("/"));
}

/** How a step's output reaches `dist`: rewritten, if it must be, and only the files it owns. */
export type Delivery = {
  rewrite?: (code: string, file: string) => string;
  only?: (file: string) => boolean;
};

/** The files of `from`, as `to` would have them, whose bytes differ from `to`'s: each with its new code. */
export function changes(from: string, to: string, { rewrite = (code) => code, only = () => true }: Delivery = {}): Map<string, string> {
  const changed = new Map<string, string>();
  for (const file of filesUnder(from)) {
    if (file.endsWith(".loupe-watch") || !only(file)) continue;
    const code = rewrite(readFileSync(join(from, file), "utf8"), file);
    const target = join(to, file);
    if (!existsSync(target) || readFileSync(target, "utf8") !== code) changed.set(file, code);
  }
  return changed;
}

/**
 * Moves into `to` each file of `from` whose bytes differ from `to`'s: written beside `from`'s,
 * then renamed over `to`'s, so a reader never sees half a file. The files `to` doesn't have
 * yet go first: a module renamed or added is in place before the module that now imports it.
 * Returns those files, in the order they moved.
 */
export function syncInto(from: string, to: string, delivery: Delivery = {}): string[] {
  const there = (file: string) => (existsSync(join(to, file)) ? 1 : 0);
  const moved = [...changes(from, to, delivery)].sort(([a], [b]) => there(a) - there(b));
  for (const [file, code] of moved) {
    const staged = join(from, `${file}.loupe-watch`);
    writeFileSync(staged, code);
    mkdirSync(dirname(join(to, file)), { recursive: true });
    renameSync(staged, join(to, file));
  }
  return moved.map(([file]) => file);
}

/** The browser side's modules, as paths in `dist`: Vite's to write, never tsc6's. */
export const isBrowserSide = (file: string) => file === "mount.js" || /^(runtime|toolbar)\//.test(file);
/** What tsc6 writes that the watch takes into `dist`: the Node side's modules, no `.d.ts`. */
export const isNodeSideModule = (file: string) => /\.c?js$/.test(file) && !isBrowserSide(file);

/**
 * One of the build's Vite steps: its config, and where and how its output goes in `dist`. The
 * config is made again each time it is asked for, with the entries as `src` has them then.
 */
export type ViteStep = Delivery & { name: string; into: string; config: () => UserConfig };

/** The build's three Vite steps, each from its package's own config, as the build runs them. */
export function viteSteps({ loupe, ui, patterns }: Configs): ViteStep[] {
  return [
    { name: "@loupe/ui", into: "ui", config: () => ui.config(ui.entries(), "dist") },
    {
      name: "@loupe/patterns",
      into: "patterns",
      config: () => patterns.config(patterns.entries(), "dist"),
      // `dist/patterns` imports `@loupe/ui` from `dist/ui`, as the build points it (`vendorWorkspace`).
      rewrite: (code, file) => (file.endsWith(".js") ? loupe.pointIntoDist(code, `patterns/${file}`) : code),
    },
    { name: "browser side", into: "", config: () => loupe.browserConfig(loupe.browserEntries(), "dist") },
  ];
}

/** The three packages' Vite configs. */
export type Configs = { loupe: typeof LoupeConfig; ui: typeof UiConfig; patterns: typeof PatternsConfig };

/**
 * Each package's own config, through Vite's module runner: they are TypeScript, and
 * `@loupe/patterns`' finds `@loupe/ui` by its name, as its own build does.
 */
export async function loadConfigs(): Promise<Configs> {
  const [loupe, ui, patterns] = await Promise.all([
    runnerImport<typeof LoupeConfig>(join(root, "vite.config.ts")),
    runnerImport<typeof UiConfig>(join(root, "../ui/vite.config.ts")),
    runnerImport<typeof PatternsConfig>(join(root, "../patterns/vite.config.ts")),
  ]);
  return { loupe: loupe.module, ui: ui.module, patterns: patterns.module };
}

/** A step as the watch delivers it: the build's bytes, and the swap in the surface's module. */
export function watched(step: ViteStep): ViteStep {
  return {
    ...step,
    rewrite: (code, file) => {
      const built = step.rewrite ? step.rewrite(code, file) : code;
      return (step.into ? `${step.into}/${file}` : file) === SWAPPED ? withSwap(built) : built;
    },
  };
}

/** A step's config as Vite builds it into `out`, once or (`watch`) at each change. */
export function buildOptions(config: UserConfig, out: string, watch: boolean): InlineConfig {
  return {
    ...config,
    configFile: false,
    logLevel: "warn",
    clearScreen: false,
    // Rolldown heads each module with its path from the cwd (`// src/enter.ts`): the package's,
    // where its build runs.
    build: { ...config.build, outDir: out, watch: watch ? {} : null, rolldownOptions: { ...config.build?.rolldownOptions, cwd: config.root } },
  };
}

const log = (line: string) => process.stdout.write(`[loupe watch] ${line}\n`);
const time = () => new Date().toTimeString().slice(0, 8);

function report(name: string, moved: string[], ms: number) {
  if (moved.length === 0) return log(`${time()} ${name}: rebuilt in ${ms} ms, nothing changed`);
  const shown = moved.slice(0, 3).join(", ") + (moved.length > 3 ? `, and ${moved.length - 3} more` : "");
  log(`${time()} ${name}: ${moved.length} file${moved.length === 1 ? "" : "s"} in ${ms} ms (${shown})`);
}

/** A config's entries, as a key that changes when one is added, removed or renamed. */
export function entriesKey(config: UserConfig): string {
  const lib = config.build?.lib;
  return JSON.stringify(lib && typeof lib.entry === "object" ? Object.entries(lib.entry).sort() : lib ? lib.entry : null);
}

/**
 * A Vite step in watch mode; after each rebuild, its changed files move into `dist`. Its entries
 * are every shipped module of its `src`, read as it starts: when they change (a module added,
 * removed or renamed), a rebuild would still look for the old ones, and fail at each change
 * from then on. So after each rebuild, or each failed one, it reads them again and, if they
 * differ, starts again with the new ones. `dist` keeps what it had meanwhile.
 */
export async function watchVite(dist: string, step: ViteStep, out: string, ready: () => void): Promise<{ close(): Promise<void> }> {
  let current: Rolldown.RolldownWatcher | null = null;
  let sources: FSWatcher | null = null;
  let closed = false;
  const start = async (onReady: () => void): Promise<void> => {
    const config = step.config();
    const key = entriesKey(config);
    let first = true;
    let restarting = false;
    let started = Date.now();
    const watcher = (await build(buildOptions(config, out, true))) as Rolldown.RolldownWatcher;
    if (closed) return void (await watcher.close());
    current = watcher;
    const restartIfMoved = () => {
      if (closed || restarting || entriesKey(step.config()) === key) return false;
      restarting = true;
      sources?.close();
      log(`${time()} ${step.name}: a module was added, removed or renamed; starting again with the new ones`);
      void watcher.close().then(() => (closed ? undefined : start(() => {})));
      return true;
    };
    // A module created where the build's graph has nothing, one restored after a rename or not
    // imported yet, starts no rebuild: the step's `src` is watched for it.
    sources = watch(join(config.root ?? root, "src"), { recursive: true }, () => restartIfMoved());
    watcher.on("event", (event) => {
      if (event.code === "BUNDLE_START") started = Date.now();
      // Vite prints the error itself; `dist` keeps the last good build.
      if (event.code === "ERROR" && !restartIfMoved()) log(`${time()} ${step.name}: the build failed (above); dist keeps the last one that built`);
      if (event.code !== "BUNDLE_END") return;
      report(step.name, syncInto(out, join(dist, step.into), step), Date.now() - started);
      if (first) {
        first = false;
        onReady();
      }
      restartIfMoved();
    });
  };
  await start(ready);
  return {
    async close() {
      closed = true;
      sources?.close();
      await current?.close();
    },
  };
}

/** tsc6 in watch mode, as the build runs it; after each emit, the Node side's changed modules move into `dist`. */
function watchTsc(dist: string, ready: () => void): void {
  const out = join(WATCH_DIR, "node");
  const tsc = join(root, "node_modules", ".bin", "tsc6");
  const child = spawn(tsc, ["-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput", "--outDir", out], { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
  process.on("exit", () => child.kill());
  let first = true;
  let started = Date.now();
  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (/File change detected|Starting compilation/.test(line)) started = Date.now();
      if (/error TS\d+/.test(line)) log(`${time()} Node side: ${line.trim()}`);
      if (!/Found \d+ errors?\. Watching for file changes/.test(line)) continue;
      report("Node side", syncInto(out, dist, { only: isNodeSideModule }), Date.now() - started);
      if (first) {
        first = false;
        ready();
      }
    }
  });
}

/** The pid of a watch running on this package, if one is: its pid file names a live process. */
export function watchRunning(): number | null {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null; // A stale pid: that watch has stopped.
  }
}

async function main() {
  const dist = join(root, "dist");
  if (!["toolbar/index.js", "next.cjs", "ui/index.js", "patterns/index.js"].every((file) => existsSync(join(dist, file)))) {
    log("dist isn't built. Run `pnpm --filter @danarocha/loupe build` once, with `next dev` stopped, then start the watch.");
    process.exit(1);
  }
  const running = watchRunning();
  if (running !== null) {
    log(`a watch is already running on this package (pid ${running}). Stop it first.`);
    process.exit(1);
  }
  // As `vite build` has it. Vite's module runner, which loads the configs, would make it
  // "development": Vite would write a development build, and React Compiler its own resets.
  process.env.NODE_ENV = "production";
  rmSync(WATCH_DIR, { recursive: true, force: true });
  mkdirSync(WATCH_DIR, { recursive: true });
  writeFileSync(PID_FILE, String(process.pid));
  process.on("exit", () => rmSync(PID_FILE, { force: true }));
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => process.exit(0));

  const configs = await loadConfigs();
  const started = Date.now();
  let pending = 4;
  const ready = () => {
    if (--pending === 0) log(`${time()} watching, ready in ${Date.now() - started} ms. Ctrl+C stops it.`);
  };
  await Promise.all(viteSteps(configs).map((step) => watchVite(dist, watched(step), join(WATCH_DIR, step.into || "browser"), ready)));
  watchTsc(dist, ready);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
