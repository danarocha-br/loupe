import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

// Reads the facts the compatibility check grades. Nothing here writes.

export type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

export type Pkg = {
  /** Relative to the workspace root, with forward slashes ("apps/app"). */
  dir: string;
  abs: string;
  json: PackageJson;
};

export type Workspace =
  | { kind: "pnpm"; patterns: string[] }
  | { kind: "npm" | "yarn" | "bun"; patterns: string[] }
  | { kind: "none" };

const SKIP = new Set(["node_modules", ".next", ".git", "dist", ".turbo"]);

export function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The nearest directory up from `cwd` that declares a workspace, else `cwd`. */
export function findRoot(cwd: string): string {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    if (readJson<PackageJson>(join(dir, "package.json"))?.workspaces) return dir;
    if (dirname(dir) === dir) return cwd;
  }
}

function pnpmPatterns(yaml: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of yaml.split("\n")) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s*-\s*['"]?([^'"#\s]+)['"]?/.exec(line);
    if (item?.[1]) patterns.push(item[1]);
    else if (/^\S/.test(line)) inPackages = false;
  }
  return patterns;
}

export function readWorkspace(root: string): Workspace {
  const yaml = join(root, "pnpm-workspace.yaml");
  if (existsSync(yaml)) return { kind: "pnpm", patterns: pnpmPatterns(readFileSync(yaml, "utf8")) };
  const ws = readJson<PackageJson>(join(root, "package.json"))?.workspaces;
  if (!ws) return { kind: "none" };
  const patterns = Array.isArray(ws) ? ws : (ws.packages ?? []);
  if (existsSync(join(root, "yarn.lock"))) return { kind: "yarn", patterns };
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) {
    return { kind: "bun", patterns };
  }
  return { kind: "npm", patterns };
}

export function coversPackages(workspace: Workspace): boolean {
  return (
    workspace.kind !== "none" &&
    workspace.patterns.some((p) => p === "packages/*" || p === "packages/**")
  );
}

function toPkg(root: string, abs: string): Pkg | undefined {
  const json = readJson<PackageJson>(join(abs, "package.json"));
  if (!json) return undefined;
  return { dir: relative(root, abs).split(sep).join("/") || ".", abs, json };
}

function subdirs(dir: string): string[] {
  if (!isDir(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP.has(e.name))
    .map((e) => join(dir, e.name));
}

/** Supports the pattern shapes workspaces use: `dir`, `dir/*` and `dir/**`. */
export function workspacePackages(root: string, workspace: Workspace): Pkg[] {
  if (workspace.kind === "none") {
    const self = toPkg(root, root);
    return self ? [self] : [];
  }
  const dirs = new Set<string>();
  for (const pattern of workspace.patterns) {
    if (pattern.startsWith("!")) continue;
    const base = join(root, pattern.replace(/\/\*\*?$/, ""));
    if (pattern.endsWith("/**")) {
      const walk = (dir: string) => {
        for (const sub of subdirs(dir)) {
          dirs.add(sub);
          walk(sub);
        }
      };
      walk(base);
    } else if (pattern.endsWith("/*")) {
      for (const sub of subdirs(base)) dirs.add(sub);
    } else {
      dirs.add(base);
    }
  }
  return [...dirs].flatMap((dir) => toPkg(root, dir) ?? []).sort((a, b) => a.dir.localeCompare(b.dir));
}

export function dependencyNames(json: PackageJson): string[] {
  return Object.keys({ ...json.dependencies, ...json.devDependencies, ...json.peerDependencies });
}

export function routers(appAbs: string): { app: boolean; pages: boolean } {
  return {
    app: isDir(join(appAbs, "app")) || isDir(join(appAbs, "src", "app")),
    pages: isDir(join(appAbs, "pages")) || isDir(join(appAbs, "src", "pages")),
  };
}

export function nextApps(pkgs: Pkg[]): Pkg[] {
  return pkgs.filter((p) => {
    if (!dependencyNames(p.json).includes("next")) return false;
    const r = routers(p.abs);
    return r.app || r.pages;
  });
}

/** The installed `next` the app resolves, walking up `node_modules` as Node does. */
export function nextDir(appAbs: string): string | undefined {
  for (let dir = appAbs; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", "next");
    if (existsSync(join(candidate, "package.json"))) return candidate;
    if (dirname(dir) === dir) return undefined;
  }
}

/** The App Router renders with the React that Next bundles, not the app's own. */
export function bundledReact(next: string): string | undefined {
  for (const file of ["react.development.js", "react.production.js"]) {
    const path = join(next, "dist", "compiled", "react", "cjs", file);
    if (!existsSync(path)) continue;
    const match = /exports\.version\s*=\s*["']([^"']+)["']/.exec(readFileSync(path, "utf8"));
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export type DevCommand = { script: string; runtime: "bun" | "node"; webpack: boolean };

/** Follows the dev script through `npm:x` and `run x` references to the `next dev` call. */
export function devCommand(scripts: Record<string, string> = {}, name = "dev", depth = 0): DevCommand | undefined {
  const script = scripts[name];
  if (script === undefined || depth > 5) return undefined;
  for (const part of script.split(/&&|\|\||;|"|'/)) {
    if (!/\bnext\s+dev\b/.test(part)) continue;
    return {
      script: name,
      runtime: /\bbunx?\s+--bun\b/.test(part) ? "bun" : "node",
      webpack: /\s--webpack\b/.test(part),
    };
  }
  const refs = [
    ...script.matchAll(/\bnpm:([\w:.-]+)/g),
    ...script.matchAll(/\b(?:npm|pnpm|yarn|bun)\s+run\s+([\w:.-]+)/g),
  ].flatMap((m) => m[1] ?? []);
  for (const ref of refs) {
    const found = devCommand(scripts, ref, depth + 1);
    if (found) return found;
  }
  return undefined;
}

const BABEL_FILES = [
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
  ".babelrc.cjs",
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
  "babel.config.json",
];

export function babelConfig(appAbs: string): string | undefined {
  return BABEL_FILES.find((f) => existsSync(join(appAbs, f)));
}

export function usesReactCompiler(appAbs: string): boolean {
  return ["ts", "mts", "mjs", "js", "cjs"].some((ext) => {
    const path = join(appAbs, `next.config.${ext}`);
    return existsSync(path) && /reactCompiler\s*:\s*(true|\{)/.test(readFileSync(path, "utf8"));
  });
}

/** Source files under `dir`, skipping build output and dependencies. */
export function sourceFiles(dir: string, extensions = /\.(tsx?|jsx?|mjs)$/): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    if (!isDir(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.test(entry.name)) files.push(full);
    }
  };
  walk(dir);
  return files;
}

/** How many of the app's source files mention any of `names`. */
export function filesImporting(appAbs: string, names: string[]): number {
  if (names.length === 0) return 0;
  return sourceFiles(appAbs).filter((file) => {
    const text = readFileSync(file, "utf8");
    return names.some((name) => text.includes(`"${name}`) || text.includes(`'${name}`));
  }).length;
}
