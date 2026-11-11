// The three scopes an Override can be set at (PER-90): who each one reaches, what
// it is called, and how its members' Current values differ. Read-only: writes go
// through `__loupe` with the selected Instance as the scope's representative.

import { parseHint } from "../runtime/inspect.js";
import type { InstanceProps, InstanceRow, LoupeDebug, RecordRow } from "../runtime/debug.js";
import { currentRoute, identityOf, UNANCHORED } from "../runtime/registry.js";
import { reaches, type Scope, type ScopeTarget, type Source } from "../runtime/store.js";
import { formatCurrent } from "./format.js";
import { safeInspect, safeProps } from "./page.js";

/** What a scope is called on a prop row: "This instance", "All in MemberRowMenu", "All on page". */
export type ScopeLabels = { instance: string; group: string | null; page: string };

export type Member = {
  id: string;
  /** Left out of this scope: its record skips the Instance. */
  out: boolean;
  /** Null when it can't be read this frame. */
  live: InstanceProps | null;
};

export type ScopeView = {
  scope: Scope;
  target: ScopeTarget;
  /** The picker's label, with the scope's size. */
  label: string;
  /** Browser-rendered Instances it reaches, in page order, left-out ones included. */
  members: Member[];
  /** Server-rendered Instances of the same component: counted, never changed (page scope only). */
  server: InstanceRow[];
  /** Left-out Instances that aren't mounted now: still on the record. */
  outUnmounted: string[];
  record: RecordRow | null;
};

/** Narrowest first: the order precedence uses. */
const ORDER: readonly Source[] = ["instance", "group", "page"];

/** Whether `source` is a narrower scope than `scope`, so it wins over it. */
export function narrower(source: Source | undefined, scope: Scope): boolean {
  if (source === undefined || source === "app") return false;
  return ORDER.indexOf(source) < ORDER.indexOf(scope);
}

export const PAGE_LABEL = "All on page";

/** "All in MemberRowMenu", and "· Button 2 of 2" when the enclosing component uses it more than once. */
export function groupLabel(row: Pick<InstanceRow, "anchor" | "hint" | "component">): string | null {
  if (row.anchor.startsWith(UNANCHORED)) return null;
  const parts = row.anchor.split(" › ");
  const enclosing = parts.length >= 3 ? parts[parts.length - 2] : null;
  const base = enclosing ? `All in ${enclosing}` : "All from this call site";
  const site = parseHint(row.hint);
  return site && site.total > 1 ? `${base} · ${row.component} ${site.ordinal} of ${site.total}` : base;
}

export function labelsOf(row: Pick<InstanceRow, "anchor" | "hint" | "component">): ScopeLabels {
  return { instance: "This instance", group: groupLabel(row), page: PAGE_LABEL };
}

/** The record an Override on `row` at `scope` goes into; null for a group with no call site. */
export function targetOf(row: Pick<InstanceRow, "id" | "anchor" | "component">, scope: Scope): ScopeTarget | null {
  switch (scope) {
    case "instance":
      return { scope, id: row.id };
    case "group":
      return row.anchor.startsWith(UNANCHORED) ? null : { scope, anchor: row.anchor };
    case "page":
      return { scope, route: currentRoute(), component: row.component };
  }
}

export function sameTarget(a: ScopeTarget, b: ScopeTarget): boolean {
  if (a.scope !== b.scope) return false;
  switch (a.scope) {
    case "instance":
      return a.id === (b as typeof a).id;
    case "group":
      return a.anchor === (b as typeof a).anchor;
    case "page":
      return a.route === (b as typeof a).route && a.component === (b as typeof a).component;
  }
}

export function recordOf(records: readonly RecordRow[], target: ScopeTarget): RecordRow | null {
  return records.find((record) => sameTarget(record.target, target)) ?? null;
}

/** Who `scope` reaches from `row`, or null when the Instance has no such scope. */
export function scopeView(
  debug: LoupeDebug,
  rows: readonly InstanceRow[],
  records: readonly RecordRow[],
  row: InstanceRow,
  scope: Scope,
): ScopeView | null {
  const target = targetOf(row, scope);
  if (!target) return null;
  const record = recordOf(records, target);
  const out = new Set(record?.excluded ?? []);
  const inScope = rows.filter((other) => reaches(target, identityOf(other)));
  const client = inScope.filter((other) => other.rendered === "client");
  const server = scope === "page" ? inScope.filter((other) => other.rendered === "server") : [];
  const members = client.map((other) => ({ id: other.id, out: out.has(other.id), live: safeProps(debug, other.id) }));
  const mounted = new Set(client.map((other) => other.id));
  const labels = labelsOf(row);
  const name = scope === "instance" ? labels.instance : scope === "group" ? (labels.group as string) : labels.page;
  const size = scope === "instance" ? "" : ` · ${client.length + server.length}`;
  const serverNote = server.length > 0 ? ` (${server.length} server-rendered, inspect only)` : "";
  return {
    scope,
    target,
    label: `${name}${size}${serverNote}`,
    members,
    server,
    outUnmounted: [...out].filter((id) => !mounted.has(id)),
    record,
  };
}

/** The scopes acting on an Instance, and the ones it was left out of: its identity chips. */
export function scopeChips(records: readonly RecordRow[], row: InstanceRow, labels: ScopeLabels): string[] {
  const chips: string[] = [];
  for (const scope of ["group", "page"] as const) {
    const target = targetOf(row, scope);
    const record = target && recordOf(records, target);
    if (!record) continue;
    const name = scope === "group" ? labels.group : labels.page;
    if (record.excluded.includes(row.id)) chips.push(`Left out of ${name}`);
    else if (Object.keys(record.values).length > 0) chips.push(name as string);
  }
  return chips;
}

/** Per prop, the widest scope whose Override this Instance falls back to once its own is reset. */
export function fallbacks(records: readonly RecordRow[], row: InstanceRow): Record<string, Scope> {
  const found: Record<string, Scope> = {};
  // Widest first, so a narrower scope overwrites it.
  for (const scope of ["page", "group"] as const) {
    const target = targetOf(row, scope);
    const record = target && recordOf(records, target);
    if (!record || record.suspended || record.excluded.includes(row.id)) continue;
    for (const prop of Object.keys(record.values)) found[prop] = scope;
  }
  return found;
}

const NOT_SET = "not set";

/**
 * The app's value for one member, as a pill names it: set, its known default, or
 * `not set`. A `conflict` or `unknown` default counts as `not set`: never a guess.
 */
function appValueKey(debug: LoupeDebug, id: string, prop: string): string {
  const row = safeInspect(debug, id)?.rows.find((candidate) => candidate.name === prop);
  if (!row) return NOT_SET;
  if (row.set) return formatCurrent(row.value);
  const known = row.default;
  if (known && (known.source === "destructure" || known.source === "defaultVariants")) return formatCurrent(known.value ?? undefined);
  return NOT_SET;
}

/**
 * How the Current values of the members still in the scope differ, keyed by the
 * pill's label (`formatCurrent`): `{ '"ghost"': 3, '"secondary"': 1 }`.
 */
export function valueCounts(debug: LoupeDebug, view: ScopeView, prop: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const member of view.members) {
    if (member.out) continue;
    const key = appValueKey(debug, member.id, prop);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** In-scope members whose value for `prop` comes from a narrower scope than the view's. */
export function keepingOwn(view: ScopeView, prop: string): string[] {
  return view.members.filter((member) => !member.out && narrower(member.live?.sources[prop], view.scope)).map((member) => member.id);
}
