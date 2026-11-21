// Change numbers (ADR 0002, and the Impeccable critique of 2026-11-20): a change gets
// its number when it is first made and keeps it, so Δ2 on the page, 2 in the panel
// and c2 in the copied Proposal stay one change while others come and go. Numbers
// only go up and never pass to another change: a reset one leaves a gap. Undo puts a
// change back with the values it had, so it gets its old number back. One numbering
// per page load, kept across a Fast Refresh; `resetLoupe()` starts it over.
//
// The panel (`panel-view/keys.ts`) and the Proposal builder both number through
// here, so they can't disagree. The numbering watches the store, so changes made
// together, or put back together by Undo, still number in the order they were made.

import { registry } from "../runtime/registry.js";
import { type PerPageOptions, perPage } from "../runtime/slot.js";
import { keyOf, type ScopeTarget } from "../runtime/store.js";

/** A change the Proposal would list: its record's key (`scope:keyOf(target)`) and values. */
export type Numbered = { key: string; values: Readonly<Record<string, unknown>> };

/** A number given: to the record made at `made` (the store's tick), with the values it has now. */
type Entry = { n: number; stamp: string; made: number | undefined };

export type Numbering = {
  /** The last number given. */
  last: number;
  /** The changes that hold a number now, by key. */
  live: Map<string, Entry>;
  /** Changes that went away, with the values they had: Undo brings one back. */
  gone: Map<string, Entry>;
  /** When each record now in the store appeared, by key: the order new numbers go in. */
  made: Map<string, number>;
  stop: () => void;
};

/** A record's key: its scope and its name within it, as the Proposal's `setOnKey` writes it. */
export function changeKey(target: ScopeTarget): string {
  return `${target.scope}:${keyOf(target)}`;
}

export function newNumbering(): Numbering {
  return { last: 0, live: new Map(), gone: new Map(), made: new Map(), stop: () => {} };
}

const ON_RESET: PerPageOptions<Numbering> = { stop: (numbering) => numbering.stop() };

/** The page's numbering, watching the store from its first use until `resetLoupe()`. */
export function pageNumbering(): Numbering {
  return perPage("changeNumbers", () => watch(newNumbering()), ON_RESET);
}

/**
 * Notes when each record appears in the store, and forgets one once it has gone, so
 * a record reset and made again, even within one batch, reads as a new one. Records
 * already there when it starts count as made then, in the store's order.
 */
function watch(numbering: Numbering): Numbering {
  const { store } = registry();
  let tick = 0;
  for (const record of store.records()) numbering.made.set(changeKey(record.target), ++tick);
  numbering.stop = store.subscribe((target) => {
    const key = changeKey(target);
    const exists = store.records().some((record) => changeKey(record.target) === key);
    if (!exists) numbering.made.delete(key);
    else if (!numbering.made.has(key)) numbering.made.set(key, ++tick);
  });
  return numbering;
}

/** A record's values as text, to tell one set of values from another. */
export function valuesStamp(values: Readonly<Record<string, unknown>>): string {
  try {
    return JSON.stringify(values);
  } catch {
    return Object.entries(values)
      .map(([prop, value]) => `${prop}=${String(value)}`)
      .join(",");
  }
}

/**
 * The number of each change, for the changes in the order given. `changes` is every
 * change the Proposal would list now: one missing from it has gone, and keeps its
 * number only to get it back unchanged. A change edited in place keeps its own. A
 * change that is new, or back with other values, gets the next number, in the order
 * the store saw the records appear (those it didn't see, in the order given).
 */
export function numberChanges(changes: readonly Numbered[], numbering: Numbering = pageNumbering()): number[] {
  const present = new Set(changes.map((change) => change.key));
  for (const [key, entry] of numbering.live) {
    if (present.has(key)) continue;
    numbering.live.delete(key);
    numbering.gone.set(key, entry);
  }
  const numbers: number[] = [];
  const fresh: number[] = [];
  changes.forEach(({ key, values }, index) => {
    const stamp = valuesStamp(values);
    const made = numbering.made.get(key);
    const live = numbering.live.get(key);
    // The same record, edited in place: it keeps its number.
    if (live && (live.made === undefined || made === undefined || live.made === made)) {
      live.stamp = stamp;
      live.made ??= made;
      numbers[index] = live.n;
      return;
    }
    // Reset and made again since the last count: the old one has gone.
    if (live) {
      numbering.live.delete(key);
      numbering.gone.set(key, live);
    }
    const gone = numbering.gone.get(key);
    numbering.gone.delete(key);
    if (gone && gone.stamp === stamp) {
      gone.made = made;
      numbering.live.set(key, gone);
      numbers[index] = gone.n;
    } else fresh.push(index);
  });
  const madeAt = (index: number) => numbering.made.get(changes[index]?.key ?? "") ?? Number.POSITIVE_INFINITY;
  for (const index of fresh.sort((a, b) => madeAt(a) - madeAt(b) || a - b)) {
    const change = changes[index] as Numbered;
    const entry = { n: ++numbering.last, stamp: valuesStamp(change.values), made: numbering.made.get(change.key) };
    numbering.live.set(change.key, entry);
    numbers[index] = entry.n;
  }
  return numbers;
}
