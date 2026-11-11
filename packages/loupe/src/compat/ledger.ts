import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The ledger belongs to `init` (PER-124), which records every touch point in
// it. This module defines only the part the compatibility check needs: the
// untested items someone said yes to, keyed by app, item and the value seen,
// so a rerun with nothing changed does not ask again. Fields it does not own
// are kept as they are.
export const LEDGER_PATH = "packages/loupe/loupe.ledger.json";

export type Accepted = { app: string; item: string; seen: string; acceptedAt: string };

type Ledger = { formatVersion?: number; untestedAccepted?: Accepted[]; [field: string]: unknown };

export class LedgerError extends Error {}

export function readLedger(root: string): Ledger {
  const path = join(root, LEDGER_PATH);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Ledger;
  } catch {
    throw new LedgerError(`${LEDGER_PATH} isn't valid JSON. Fix or delete it, then rerun.`);
  }
}

export function isAccepted(ledger: Ledger, app: string, item: string, seen: string): boolean {
  return (ledger.untestedAccepted ?? []).some((a) => a.app === app && a.item === item && a.seen === seen);
}

/** Records a yes, replacing any older yes for the same app and item. */
export function recordAccepted(root: string, entries: Omit<Accepted, "acceptedAt">[], now: Date): void {
  const ledger = readLedger(root);
  const replaced = new Set(entries.map((e) => `${e.app}\0${e.item}`));
  const kept = (ledger.untestedAccepted ?? []).filter((a) => !replaced.has(`${a.app}\0${a.item}`));
  const next: Ledger = {
    formatVersion: 1,
    ...ledger,
    untestedAccepted: [...kept, ...entries.map((e) => ({ ...e, acceptedAt: now.toISOString() }))],
  };
  const path = join(root, LEDGER_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
}
