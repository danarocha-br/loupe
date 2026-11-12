import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type SourceSet = {
  /** Absolute path of the tsconfig the program is built from. */
  tsconfig: string;
  /** Directory every path in the output is relative to (the tsconfig's). */
  root: string;
  /** Absolute paths, ordered by their root-relative POSIX path. */
  files: string[];
  relative: (absolute: string) => string;
  hashes: (absolute: Iterable<string>) => Record<string, string>;
};

const SOURCE = /\.(ts|tsx)$/;
const SKIPPED = /\.d\.ts$|\.(test|spec|stories)\.(ts|tsx)$/;

/** The directory `generate` reads under the design system's root; it reads the whole app (PER-100 §1). */
export const DESIGN_SYSTEM_INCLUDE = "components";

/**
 * Every `.ts`/`.tsx` file `meta` reads under `dirs` (absolute), unordered. Skips
 * declarations, tests, stories, `node_modules`, dot directories, the `exclude`d
 * directories (absolute), and a directory in `dirs` that doesn't exist.
 */
export function sourceFiles(dirs: readonly string[], exclude: readonly string[] = []): string[] {
  const excluded = new Set(exclude.map((dir) => path.resolve(dir)));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(full)) walk(full);
      } else if (SOURCE.test(entry.name) && !SKIPPED.test(entry.name)) files.push(full);
    }
  };
  for (const dir of dirs) {
    const full = path.resolve(dir);
    if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) walk(full);
  }
  return files;
}

/** `exclude`: absolute directories never read, e.g. the Product layer inside an app. */
export function collectSources(
  tsconfig: string,
  include: readonly string[],
  exclude: readonly string[] = [],
): SourceSet {
  const tsconfigPath = path.resolve(tsconfig);
  const root = path.dirname(tsconfigPath);
  const relative = (absolute: string) => path.relative(root, absolute).split(path.sep).join("/");

  const dirs = (include.length > 0 ? include : ["."]).map((dir) => {
    const full = path.resolve(root, dir);
    if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`Not a directory: ${dir} (resolved against ${root})`);
    }
    return full;
  });
  const files = sourceFiles(dirs, exclude);

  const unique = [...new Set(files)].sort((a, b) => compare(relative(a), relative(b)));
  return {
    tsconfig: tsconfigPath,
    root,
    files: unique,
    relative,
    hashes: (absolute) => {
      const entries = [...new Set(absolute)].map((file) => [relative(file), hashFile(file)] as const);
      return Object.fromEntries(entries.sort(([a], [b]) => compare(a, b)));
    },
  };
}

/** Byte order, never locale order, so output is the same on every machine. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `mtime:size` of a file, or null when it isn't one: what the dev server's read caches key on. */
export function statStamp(file: string): string | null {
  const stats = statSync(file, { throwIfNoEntry: false });
  return stats?.isFile() ? `${stats.mtimeMs}:${stats.size}` : null;
}

export function hashFile(file: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
}

/** The npm package a file belongs to, or `undefined` for a repo file. */
export function packageOf(file: string): string | undefined {
  const normalised = file.split(path.sep).join("/");
  const index = normalised.lastIndexOf("/node_modules/");
  if (index === -1) return undefined;
  const [first, second] = normalised.slice(index + "/node_modules/".length).split("/");
  if (!first) return undefined;
  return first.startsWith("@") && second ? `${first}/${second}` : first;
}
