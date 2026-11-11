// `packages/loupe/loupe.ledger.json` (PER-93): what `init` wrote, so a rerun,
// `remove` and `doctor` can tell Loupe's edits from anybody else's. Sorted keys
// and arrays, no timestamps, and it never records itself. The compatibility
// check keeps its own `untestedAccepted` field here; it is carried through.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LEDGER_PATH, readLedger } from "../compat/ledger.js";
import { compare } from "../meta/sources.js";
import type { TouchPointId } from "./touch-points.js";

export { LEDGER_PATH };
export const LEDGER_FORMAT_VERSION = 1;

export type TouchPointEntry = {
  id: TouchPointId;
  file: string;
  mode: "auto" | "manual";
  /** Of the AST-normalised insertion; null for a `manual` item not adopted yet. */
  sha256: string | null;
};

/** A file `init` wrote into the Product layer, relative to it. `generate`'s files carry their own hash. */
export type FileEntry = { path: string; sha256: string };

export type InitLedger = {
  formatVersion?: number;
  loupe?: { package: string; version: string };
  productLayer?: { app: string; name: string; path: string };
  touchPoints?: TouchPointEntry[];
  files?: FileEntry[];
  [field: string]: unknown;
};

export function readInitLedger(root: string): InitLedger {
  return readLedger(root) as InitLedger;
}

export function serialiseLedger(ledger: InitLedger): string {
  const sorted: InitLedger = {
    ...ledger,
    ...(ledger.touchPoints && { touchPoints: [...ledger.touchPoints].sort((a, b) => compare(a.id, b.id)) }),
    ...(ledger.files && { files: [...ledger.files].sort((a, b) => compare(a.path, b.path)) }),
  };
  return `${JSON.stringify(sortKeys(sorted), null, 2)}\n`;
}

/** Writes only when the bytes would change, so a rerun leaves the file and its mtime alone. */
export function saveLedger(root: string, ledger: InitLedger): boolean {
  const file = path.join(root, LEDGER_PATH);
  const text = serialiseLedger(ledger);
  if (existsSync(file) && readFileSync(file, "utf8") === text) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return true;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compare)
      .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
  );
}
