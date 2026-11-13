// `packages/loupe/loupe.ledger.json` (PER-93, ADR 0001): the only record of an
// install, and the only module that reads, writes or judges it. It records what
// `init` wrote, so a rerun, `remove` and `doctor` can tell Loupe's edits from
// anybody else's, and the compatibility check's yes to untested items.
//
// Sorted keys and arrays, no timestamps but the check's, and it never records
// itself. The installer plugin reads the JSON directly (`productLayer.app`,
// `loupe.version`), so its shape is a contract: change it only with
// `formatVersion`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readHeader } from "../generate/header.js";
import { compare } from "../meta/sources.js";
import { fileHash, sha256 } from "./syntax.js";
import type { Found, TouchPoint, TouchPointId } from "./touch-points.js";

export const LEDGER_PATH = "packages/loupe/loupe.ledger.json";
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

/** A yes to an item the compatibility check grades "not tested yet". */
export type Acceptance = { app: string; item: string; seen: string };
export type Accepted = Acceptance & { acceptedAt: string };

export type Ledger = {
  formatVersion?: number;
  loupe?: { package: string; version: string };
  productLayer?: { app: string; name: string; path: string };
  touchPoints?: TouchPointEntry[];
  files?: FileEntry[];
  untestedAccepted?: Accepted[];
  [field: string]: unknown;
};

export class LedgerError extends Error {}

// ── Reading and writing ──────────────────────────────────────────────────────

export function readLedger(root: string): Ledger {
  const file = path.join(root, LEDGER_PATH);
  if (!existsSync(file)) return {};
  let ledger: unknown;
  try {
    ledger = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new LedgerError(`${LEDGER_PATH} isn't valid JSON. Fix or delete it, then rerun.`);
  }
  const accepted = (ledger as Ledger | null)?.untestedAccepted;
  if (typeof ledger !== "object" || ledger === null || Array.isArray(ledger) || (accepted !== undefined && !Array.isArray(accepted))) {
    throw new LedgerError(`${LEDGER_PATH} isn't a Loupe ledger. Fix or delete it, then rerun.`);
  }
  return ledger as Ledger;
}

/** The refusal for a ledger written by a newer Loupe, or undefined when this one can read it. */
export function formatTooNew(ledger: Ledger, version: string): string | undefined {
  if ((ledger.formatVersion ?? LEDGER_FORMAT_VERSION) <= LEDGER_FORMAT_VERSION) return undefined;
  return `${LEDGER_PATH} has formatVersion ${ledger.formatVersion}; this Loupe (${version}) reads ${LEDGER_FORMAT_VERSION}. Upgrade Loupe.`;
}

export function serialiseLedger(ledger: Ledger): string {
  const sorted: Ledger = {
    ...ledger,
    ...(ledger.touchPoints && { touchPoints: [...ledger.touchPoints].sort((a, b) => compare(a.id, b.id)) }),
    ...(ledger.files && { files: [...ledger.files].sort((a, b) => compare(a.path, b.path)) }),
  };
  return `${JSON.stringify(sortKeys(sorted), null, 2)}\n`;
}

/** Writes only when the bytes would change, so a rerun leaves the file and its mtime alone. */
export function saveLedger(root: string, ledger: Ledger): boolean {
  const file = path.join(root, LEDGER_PATH);
  const text = serialiseLedger(ledger);
  if (existsSync(file) && readFileSync(file, "utf8") === text) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return true;
}

export function isAccepted(ledger: Ledger, { app, item, seen }: Acceptance): boolean {
  return (ledger.untestedAccepted ?? []).some((a) => a.app === app && a.item === item && a.seen === seen);
}

/** Records the check's yes, replacing any older yes for the same app and item. Every other field is kept. */
export function recordAccepted(root: string, entries: Acceptance[], now: Date): void {
  const ledger = readLedger(root);
  // NUL can't appear in a path or an item key, so the pair can't collide.
  const replaced = new Set(entries.map((e) => `${e.app}\0${e.item}`));
  const kept = (ledger.untestedAccepted ?? []).filter((a) => !replaced.has(`${a.app}\0${a.item}`));
  saveLedger(root, {
    formatVersion: LEDGER_FORMAT_VERSION,
    ...ledger,
    untestedAccepted: [...kept, ...entries.map((e) => ({ ...e, acceptedAt: now.toISOString() }))],
  });
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

// ── Verdicts ─────────────────────────────────────────────────────────────────
// What Loupe concludes about an item it may have written, against the record
// only (GLOSSARY.md). Whether the item is what *this* version would write is
// `init`'s question, not the ledger's.

/**
 * - `intact`: recorded, and Loupe's edit is there unchanged.
 * - `drift`: recorded, and the edit was changed by hand since.
 * - `missing`: recorded, and the edit (or the file) is gone.
 * - `pending`: recorded as a manual step, not adopted yet; `found` is the edit if one is there.
 * - `unclaimed`: not recorded, but a Loupe edit is there; `found.exact` when it is exactly what `init` writes.
 * - `not-loupes`: not recorded, and no Loupe edit is there.
 * - `unrecognised`: recorded, but no touch point answers for it any more, and its file is still there.
 *
 * `text` is the file's content, undefined when it doesn't exist; `hash` is what to record for `found`.
 */
export type TouchPointVerdict =
  | { kind: "intact"; text: string }
  | { kind: "drift"; text: string }
  | { kind: "missing"; text: string | undefined }
  | { kind: "pending"; text: string | undefined; found: Found | undefined; hash: string | undefined }
  | { kind: "unclaimed"; text: string; found: Found; hash: string }
  | { kind: "not-loupes"; text: string | undefined }
  | { kind: "unrecognised" };

/** Judges one touch point against its ledger entry. Pass `tp` undefined when no touch point answers for `entry`. */
export function judgeTouchPoint(root: string, entry: TouchPointEntry | undefined, tp: TouchPoint | undefined): TouchPointVerdict {
  if (!tp) {
    const there = entry !== undefined && existsSync(path.join(root, entry.file));
    return there ? { kind: "unrecognised" } : { kind: "missing", text: undefined };
  }
  const text = readText(root, tp.file);
  const found = text === undefined ? undefined : tp.find(text);
  const hash = found ? sha256(found.canonical) : undefined;
  if (entry?.sha256) {
    if (text === undefined || !found) return { kind: "missing", text };
    return hash === entry.sha256 ? { kind: "intact", text } : { kind: "drift", text };
  }
  if (entry) return { kind: "pending", text, found, hash };
  if (text !== undefined && found && hash) return { kind: "unclaimed", text, found, hash };
  return { kind: "not-loupes", text };
}

/**
 * - `intact` / `drift`: `by` says whose record it was checked against: the ledger (`init`) or the file's own header (`generate`).
 * - `missing`: the file isn't there (for a recorded file, it is gone).
 * - `not-loupes`: neither the ledger nor a header claims it.
 */
export type FileVerdict =
  | { kind: "intact"; by: "init" | "generate"; text: string }
  | { kind: "drift"; by: "init" | "generate"; text: string }
  | { kind: "missing" }
  | { kind: "not-loupes"; text: string };

/** Judges one Product layer file: against its ledger entry when there is one, else against its generated header. */
export function judgeLayerFile(root: string, repoPath: string, entry: FileEntry | undefined): FileVerdict {
  const text = readText(root, repoPath);
  if (text === undefined) return { kind: "missing" };
  if (entry) return fileHash(text) === entry.sha256 ? { kind: "intact", by: "init", text } : { kind: "drift", by: "init", text };
  const header = readHeader(text).kind;
  if (header === "intact") return { kind: "intact", by: "generate", text };
  if (header === "edited") return { kind: "drift", by: "generate", text };
  return { kind: "not-loupes", text };
}

function readText(root: string, file: string): string | undefined {
  const abs = path.join(root, file);
  return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
}
