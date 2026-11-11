// Module resolution for the dev loader, close enough to TypeScript's `Bundler`
// mode to find the files a product imports: relative specifiers, tsconfig
// `paths` (`@/…`, `@repo/…`), `baseUrl`, and workspace packages in node_modules.
// It only has to answer "which source file is this?"; anything it cannot place
// is simply not anchored.

import { readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { hasUseClientDirective } from "./transform.js";

export type Resolver = {
  resolve: (specifier: string, fromFile: string) => string | null;
  isClientModule: (file: string) => boolean;
};

type PathsConfig = {
  /** Directory `paths` targets are relative to. */
  pathsBase: string | null;
  paths: Record<string, string[]> | null;
  baseUrl: string | null;
};

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"];
const JS_TO_TS: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};
const EXPORT_CONDITIONS = ["development", "import", "module", "default", "require", "node"];

export function createResolver(): Resolver {
  const configByDir = new Map<string, PathsConfig>();
  const clientByFile = new Map<string, { mtimeMs: number; client: boolean }>();

  function configFor(dir: string): PathsConfig {
    const cached = configByDir.get(dir);
    if (cached) return cached;
    const file = path.join(dir, "tsconfig.json");
    const parent = path.dirname(dir);
    const config = isFile(file)
      ? readTsconfig(file, new Set())
      : parent === dir
        ? { pathsBase: null, paths: null, baseUrl: null }
        : configFor(parent);
    configByDir.set(dir, config);
    return config;
  }

  function resolve(specifier: string, fromFile: string): string | null {
    const found = resolveUnreal(specifier, fromFile);
    if (found === null) return null;
    try {
      return realpathSync(found);
    } catch {
      return null;
    }
  }

  function resolveUnreal(specifier: string, fromFile: string): string | null {
    const fromDir = path.dirname(fromFile);
    if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
      return probe(path.resolve(fromDir, specifier));
    }
    const config = configFor(fromDir);
    if (config.paths && config.pathsBase) {
      for (const target of matchPaths(config.paths, specifier)) {
        const hit = probe(path.resolve(config.pathsBase, target));
        if (hit) return hit;
      }
    }
    if (config.baseUrl) {
      const hit = probe(path.resolve(config.baseUrl, specifier));
      if (hit) return hit;
    }
    return resolvePackage(specifier, fromDir);
  }

  function isClientModule(file: string): boolean {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(file).mtimeMs;
    } catch {
      return false;
    }
    const cached = clientByFile.get(file);
    if (cached?.mtimeMs === mtimeMs) return cached.client;
    let client = false;
    try {
      client = hasUseClientDirective(readFileSync(file, "utf8").slice(0, 4096));
    } catch {
      client = false;
    }
    clientByFile.set(file, { mtimeMs, client });
    return client;
  }

  return { resolve, isClientModule };
}

/** Targets for `specifier`, from the most specific matching `paths` key. */
export function matchPaths(paths: Record<string, string[]>, specifier: string): string[] {
  let best: { prefixLength: number; targets: string[]; captured: string } | null = null;
  for (const [pattern, targets] of Object.entries(paths)) {
    const star = pattern.indexOf("*");
    if (star === -1) {
      if (pattern === specifier) return targets;
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (
      specifier.length >= prefix.length + suffix.length &&
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix) &&
      (best === null || prefix.length > best.prefixLength)
    ) {
      best = {
        prefixLength: prefix.length,
        targets,
        captured: specifier.slice(prefix.length, specifier.length - suffix.length),
      };
    }
  }
  if (!best) return [];
  const { targets, captured } = best;
  return targets.map((target) => target.replace("*", () => captured));
}

function readTsconfig(file: string, seen: Set<string>): PathsConfig {
  const empty: PathsConfig = { pathsBase: null, paths: null, baseUrl: null };
  if (seen.has(file)) return empty;
  seen.add(file);
  let json: { extends?: string | string[]; compilerOptions?: Record<string, unknown> };
  try {
    json = JSON.parse(stripJsonc(readFileSync(file, "utf8")));
  } catch {
    return empty;
  }
  const dir = path.dirname(file);

  let inherited = empty;
  const parents = json.extends === undefined ? [] : [json.extends].flat();
  for (const parent of parents) {
    const parentFile = resolveExtends(parent, file);
    if (parentFile) inherited = mergeConfig(inherited, readTsconfig(parentFile, seen));
  }

  const options = json.compilerOptions ?? {};
  const baseUrl =
    typeof options.baseUrl === "string" ? path.resolve(dir, options.baseUrl) : inherited.baseUrl;
  const ownPaths =
    typeof options.paths === "object" && options.paths !== null
      ? (options.paths as Record<string, string[]>)
      : null;
  const paths = ownPaths ?? inherited.paths;
  // TypeScript: `paths` are relative to `baseUrl` when set, otherwise to the
  // tsconfig that declares them.
  const pathsDir = ownPaths ? dir : inherited.pathsBase;
  return { paths, baseUrl, pathsBase: paths ? (baseUrl ?? pathsDir) : null };
}

function mergeConfig(base: PathsConfig, next: PathsConfig): PathsConfig {
  return {
    paths: next.paths ?? base.paths,
    baseUrl: next.baseUrl ?? base.baseUrl,
    pathsBase: next.paths ? next.pathsBase : base.pathsBase,
  };
}

function resolveExtends(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
    const full = path.resolve(path.dirname(fromFile), specifier);
    if (isFile(full)) return full;
    return isFile(`${full}.json`) ? `${full}.json` : null;
  }
  const require = createRequire(fromFile);
  for (const candidate of [specifier, `${specifier}.json`, `${specifier}/tsconfig.json`]) {
    try {
      return require.resolve(candidate);
    } catch {}
  }
  return null;
}

function resolvePackage(specifier: string, fromDir: string): string | null {
  const parts = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  if (parts.length < nameLength) return null;
  const name = parts.slice(0, nameLength).join("/");
  const subpath = parts.slice(nameLength).join("/");

  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const packageDir = path.join(dir, "node_modules", name);
    const manifestFile = path.join(packageDir, "package.json");
    if (isFile(manifestFile)) {
      let manifest: { exports?: unknown; main?: string };
      try {
        manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      } catch {
        return null;
      }
      if (manifest.exports !== undefined) {
        const target = resolveExports(manifest.exports, subpath ? `./${subpath}` : ".");
        return target ? probe(path.join(packageDir, target)) : null;
      }
      if (subpath) return probe(path.join(packageDir, subpath));
      return probe(path.join(packageDir, manifest.main ?? "index"));
    }
    if (path.dirname(dir) === dir) return null;
  }
}

function resolveExports(exports: unknown, key: string): string | null {
  if (typeof exports === "string" || Array.isArray(exports)) {
    return key === "." ? pickTarget(exports) : null;
  }
  if (typeof exports !== "object" || exports === null) return null;
  const map = exports as Record<string, unknown>;
  if (!Object.keys(map).some((entry) => entry.startsWith("."))) {
    return key === "." ? pickTarget(map) : null;
  }
  if (key in map) return pickTarget(map[key]);
  let best: { prefixLength: number; target: string } | null = null;
  for (const [pattern, value] of Object.entries(map)) {
    const star = pattern.indexOf("*");
    if (star === -1) continue;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    if (best && prefix.length <= best.prefixLength) continue;
    const target = pickTarget(value);
    if (target) {
      const captured = key.slice(prefix.length, key.length - suffix.length);
      best = { prefixLength: prefix.length, target: target.replaceAll("*", () => captured) };
    }
  }
  return best?.target ?? null;
}

function pickTarget(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = pickTarget(item);
      if (target) return target;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const conditions = value as Record<string, unknown>;
  for (const condition of EXPORT_CONDITIONS) {
    if (condition in conditions) {
      const target = pickTarget(conditions[condition]);
      if (target) return target;
    }
  }
  return null;
}

function probe(base: string): string | null {
  if (isFile(base)) return base;
  const extension = path.extname(base);
  for (const replacement of JS_TO_TS[extension] ?? []) {
    const candidate = base.slice(0, -extension.length) + replacement;
    if (isFile(candidate)) return candidate;
  }
  for (const ext of EXTENSIONS) {
    if (isFile(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, `index${ext}`);
    if (isFile(index)) return index;
  }
  return null;
}

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/** JSON with comments and trailing commas → JSON. Leaves string contents alone. */
export function stripJsonc(text: string): string {
  let out = "";
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < text.length) {
    const char = text[i] as string;
    if (char === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += char;
      i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}
