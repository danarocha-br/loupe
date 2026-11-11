import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// `init` (PER-124) owns the ledger. The check owns only `untestedAccepted`
// and keeps every other field as it finds it.
export const LEDGER_PATH = "packages/loupe/loupe.ledger.json";

export type Acceptance = { app: string; item: string; seen: string };
export type Accepted = Acceptance & { acceptedAt: string };

type Ledger = { formatVersion?: number; untestedAccepted?: Accepted[]; [field: string]: unknown };

export class LedgerError extends Error {}

export function readLedger(root: string): Ledger {
  const path = join(root, LEDGER_PATH);
  if (!existsSync(path)) return {};
  let ledger: unknown;
  try {
    ledger = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new LedgerError(`${LEDGER_PATH} isn't valid JSON. Fix or delete it, then rerun.`);
  }
  const accepted = (ledger as Ledger | null)?.untestedAccepted;
  if (typeof ledger !== "object" || ledger === null || Array.isArray(ledger) || (accepted !== undefined && !Array.isArray(accepted))) {
    throw new LedgerError(`${LEDGER_PATH} isn't a Loupe ledger. Fix or delete it, then rerun.`);
  }
  return ledger as Ledger;
}

export function isAccepted(ledger: Ledger, { app, item, seen }: Acceptance): boolean {
  return (ledger.untestedAccepted ?? []).some((a) => a.app === app && a.item === item && a.seen === seen);
}

/** Replaces any older yes for the same app and item. */
export function recordAccepted(root: string, entries: Acceptance[], now: Date): void {
  const ledger = readLedger(root);
  // NUL can't appear in a path or an item key, so the pair can't collide.
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
