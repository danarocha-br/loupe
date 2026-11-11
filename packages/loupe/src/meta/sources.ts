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

/** `exclude`: absolute directories never read, e.g. the Product layer inside an app. */
export function collectSources(tsconfig: string, include: readonly string[], exclude: readonly string[] = []): SourceSet {
  const tsconfigPath = path.resolve(tsconfig);
  const root = path.dirname(tsconfigPath);
  const relative = (absolute: string) => path.relative(root, absolute).split(path.sep).join("/");

  const excluded = new Set(exclude.map((dir) => path.resolve(dir)));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(full)) walk(full);
      }
      else if (SOURCE.test(entry.name) && !SKIPPED.test(entry.name)) files.push(full);
    }
  };
  for (const dir of include.length > 0 ? include : ["."]) {
    const full = path.resolve(root, dir);
    if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`Not a directory: ${dir} (resolved against ${root})`);
    }
    walk(full);
  }

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
