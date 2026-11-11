// Compares a plan with the Product layer on disk and writes the difference.
// Any hand-edited or foreign file in the way stops the whole run before a byte
// is written (PER-100 §6): there is no `--force`, deleting the file is the consent.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { compare } from "../meta/sources.js";
import { GENERATE_FORMAT_VERSION, readHeader } from "./header.js";

/** Everything `generate` owns inside the Product layer. Other files there are left alone. */
const OWNED_DIRS = ["adapters", "meta"];
const OWNED_FILES = ["adapt-list.json"];
const TEMP = ".loupe-tmp";

export type Change = {
  /** Relative to the Product layer, POSIX. */
  file: string;
  action: "write" | "delete";
  why: "missing" | "changed" | "formatVersion" | "stale" | "leftover";
};

export type Refusal = { file: string; why: "edited" | "foreign" };

export type Diff = { changes: Change[]; refusals: Refusal[]; unchanged: number };

export function diff(outDir: string, desired: ReadonlyMap<string, string>): Diff {
  const changes: Change[] = [];
  const refusals: Refusal[] = [];
  let unchanged = 0;
  const existing = ownedFiles(outDir);

  for (const file of existing) {
    // Staged bytes from a run that was interrupted between staging and renaming.
    if (file.endsWith(TEMP)) {
      changes.push({ file, action: "delete", why: "leftover" });
      continue;
    }
    const content = readFileSync(path.join(outDir, file), "utf8");
    const want = desired.get(file);
    if (want === content) {
      unchanged += 1;
      continue;
    }
    const header = readHeader(content);
    if (header.kind === "edited") refusals.push({ file, why: "edited" });
    // A file we did not write is ours to leave alone, unless we need its path.
    else if (header.kind === "foreign") {
      if (want !== undefined) refusals.push({ file, why: "foreign" });
    } else if (want === undefined) changes.push({ file, action: "delete", why: "stale" });
    else {
      const why = header.formatVersion === GENERATE_FORMAT_VERSION ? "changed" : "formatVersion";
      changes.push({ file, action: "write", why });
    }
  }
  const present = new Set(existing);
  for (const file of desired.keys()) {
    if (!present.has(file)) changes.push({ file, action: "write", why: "missing" });
  }
  changes.sort((a, b) => compare(a.file, b.file));
  refusals.sort((a, b) => compare(a.file, b.file));
  return { changes, refusals, unchanged };
}

/**
 * Writes every change, or none. New bytes are staged next to their targets first,
 * so a failed write leaves the Product layer as it was; the renames that follow
 * do not fail on a local disk in practice.
 */
export function apply(outDir: string, desired: ReadonlyMap<string, string>, changes: readonly Change[]): void {
  const staged: [string, string][] = [];
  try {
    for (const change of changes) {
      if (change.action !== "write") continue;
      const target = path.join(outDir, change.file);
      const temp = `${target}${TEMP}`;
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(temp, desired.get(change.file) ?? "");
      staged.push([temp, target]);
    }
  } catch (error) {
    for (const [temp] of staged) rmSync(temp, { force: true });
    throw error;
  }
  // Deletes before renames: on a case-insensitive disk, `Badge.tsx` replacing a
  // stale `badge.tsx` is the same file, and deleting after would remove the new one.
  for (const change of changes) {
    if (change.action !== "delete") continue;
    rmSync(path.join(outDir, change.file));
    pruneEmptyDirs(outDir, path.dirname(change.file));
  }
  for (const [temp, target] of staged) renameSync(temp, target);
}

function ownedFiles(outDir: string): string[] {
  const found: string[] = [];
  const walk = (relative: string) => {
    for (const entry of readdirSync(path.join(outDir, relative), { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) found.push(child);
    }
  };
  for (const dir of OWNED_DIRS) if (existsSync(path.join(outDir, dir))) walk(dir);
  for (const file of OWNED_FILES) if (existsSync(path.join(outDir, file))) found.push(file);
  return found.sort(compare);
}

function pruneEmptyDirs(outDir: string, relative: string): void {
  let dir = relative;
  while (dir !== "." && dir !== "" && !OWNED_DIRS.includes(dir)) {
    const full = path.join(outDir, dir);
    if (!existsSync(full) || readdirSync(full).length > 0) return;
    rmdirSync(full);
    dir = path.posix.dirname(dir);
  }
}
