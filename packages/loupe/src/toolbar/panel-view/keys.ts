// The plot key: every change the Proposal would list gets the number it has there
// (`c1` reads 1), so the mark on the page, the row in the panel and the change in
// the Proposal carry one number. Like the Proposal, it counts the live records in
// `records()` order and leaves out a State prop an Instance record only holds: the
// Proposal shows that as a state, not a change.

import type { InstanceRow, RecordRow } from "../../runtime/debug.js";
import { inScope, keyOf, type ScopeTarget } from "../../runtime/store.js";

export type ChangeKey = { n: number; record: RecordRow; props: string[] };

export type Keys = {
  /** The number of the change a record makes, or null when the Proposal wouldn't list it. */
  of(target: ScopeTarget): number | null;
  /** Every numbered change, in the Proposal's order. */
  changes: ChangeKey[];
  /**
   * Per mounted Instance a change reaches, its numbers, lowest first, and a stamp
   * of what those changes set: it moves when a value does, so the page can show
   * that a change landed even when its number stays.
   */
  marks: { id: string; keys: number[]; stamp: string }[];
};

export function changeKeys(records: readonly RecordRow[], rows: readonly InstanceRow[], route: string): Keys {
  const states = new Map(rows.map((row) => [row.id, new Set(row.stateProps)]));
  const changes: ChangeKey[] = [];
  for (const record of records) {
    if (record.suspended) continue;
    const held = record.target.scope === "instance" ? (states.get(record.target.id) ?? new Set<string>()) : new Set<string>();
    const props = Object.keys(record.values).filter((prop) => !held.has(prop));
    if (props.length === 0) continue;
    changes.push({ n: changes.length + 1, record, props });
  }
  const byKey = new Map(changes.map((change) => [targetKey(change.record.target), change.n]));
  const marks = rows.flatMap((row) => {
    if (row.rendered !== "client") return [];
    const identity = { id: row.id, anchor: row.anchor, component: row.component, route };
    const reaching = changes.filter(({ record }) => inScope(record.target, identity) && !record.excluded.includes(row.id));
    if (reaching.length === 0) return [];
    const stamp = reaching.map(({ record }) => `${targetKey(record.target)} ${valuesStamp(record.values)}`).join("\n");
    return [{ id: row.id, keys: reaching.map((change) => change.n), stamp }];
  });
  return { of: (target) => byKey.get(targetKey(target)) ?? null, changes, marks };
}

/** A record's values as text, to tell one set of values from another. */
function valuesStamp(values: Readonly<Record<string, unknown>>): string {
  try {
    return JSON.stringify(values);
  } catch {
    return Object.entries(values)
      .map(([prop, value]) => `${prop}=${String(value)}`)
      .join(",");
  }
}

/** `keyOf` names a target within its scope; the scope keeps an id and an anchor apart. */
const targetKey = (target: ScopeTarget) => `${target.scope}:${keyOf(target)}`;
