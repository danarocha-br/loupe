// The three scopes an Override can be set at (PER-90): who each one reaches, what
// it is called, and how its members' Current values differ. Read-only: writes go
// through `__loupe` with the selected Instance as the scope's representative.

import type { InstanceProps, InstanceRow, LoupeDebug, RecordRow } from "../runtime/debug.js";
import { callSiteLabels, isUnanchored, parseHint } from "../call-site.js";
import { identityOf, scopeTarget } from "../runtime/registry.js";
import { keyOf, PRECEDENCE, reaches, type Scope, type ScopeTarget, type Source } from "../runtime/store.js";
import { appValue, formatCurrent } from "./format.js";
import { safeInspect, safeProps } from "./page.js";

/** What each scope is called: "This instance", "All in MemberRowMenu", "All on page". Null: no group. */
export type ScopeLabels = Record<Scope, string | null>;

export type Member = {
  id: string;
  /** Left out of this scope: its record skips the Instance. */
  out: boolean;
};

export type ScopeView = {
  scope: Scope;
  target: ScopeTarget;
  /** The picker's label, with the scope's size. */
  label: string;
  /** What the scope is called on a row: the label without its size. */
  name: string;
  /** Browser-rendered Instances it reaches, in page order, left-out ones included. */
  members: Member[];
  /** Server-rendered Instances of the same component: counted, never changed (page scope only). */
  server: InstanceRow[];
  /** Left-out Instances that aren't mounted now: still on the record. */
  outUnmounted: string[];
  record: RecordRow | null;
  /** A member's live props, read once per view. */
  live(id: string): InstanceProps | null;
  /** A member's app value for a prop, as a pill names it. Read once per view. */
  appValue(id: string, prop: string): string;
};

export const PAGE_LABEL = "All on page";
export const NOT_SET = "not set";

/** Whether `source` is a narrower scope than `scope`, so it wins over it. */
function narrower(source: Source | undefined, scope: Scope): boolean {
  if (source === undefined || source === "app") return false;
  return PRECEDENCE.indexOf(source) < PRECEDENCE.indexOf(scope);
}

/** "All in MemberRowMenu", and "· Button 2 of 2" when the enclosing component uses it more than once. */
function groupLabel(row: Pick<InstanceRow, "anchor" | "hint" | "component">): string | null {
  if (isUnanchored(row.anchor)) return null;
  const { enclosing } = callSiteLabels(row.anchor);
  const base = enclosing ? `All in ${enclosing}` : "All from this call site";
  const site = parseHint(row.hint);
  return site && site.total > 1 ? `${base} · ${row.component} ${site.ordinal} of ${site.total}` : base;
}

export function labelsOf(row: Pick<InstanceRow, "anchor" | "hint" | "component">): ScopeLabels {
  return { instance: "This instance", group: groupLabel(row), page: PAGE_LABEL };
}

function recordOf(records: readonly RecordRow[], target: ScopeTarget): RecordRow | null {
  return records.find((record) => record.target.scope === target.scope && keyOf(record.target) === keyOf(target)) ?? null;
}

/** Who `scope` reaches from `row`, or null when the Instance has no such scope. */
export function scopeView(
  debug: LoupeDebug,
  rows: readonly InstanceRow[],
  records: readonly RecordRow[],
  row: InstanceRow,
  scope: Scope,
): ScopeView | null {
  const target = scopeTarget(row, scope);
  const name = labelsOf(row)[scope];
  if (!target || name === null) return null;
  const record = recordOf(records, target);
  const out = new Set(record?.excluded ?? []);
  const inScope = rows.filter((other) => reaches(target, identityOf(other)));
  // An Override reaches only an adapted Instance; one with no Adapter (inside the design system, say) never joins.
  const client = inScope.filter((other) => other.rendered === "client" && other.adapted);
  const server = scope === "page" ? inScope.filter((other) => other.rendered === "server") : [];
  const mounted = new Set(client.map((other) => other.id));
  const size = scope === "instance" ? "" : ` · ${client.length + server.length}`;
  const serverNote = server.length > 0 ? ` (${server.length} server-rendered, inspect only)` : "";
  const suspended = record?.suspended ? " (suspended for review)" : "";
  const lives = new Map<string, InstanceProps | null>();
  const values = new Map<string, Map<string, string>>();
  return {
    scope,
    target,
    label: `${name}${size}${serverNote}${suspended}`,
    name,
    members: client.map((other) => ({ id: other.id, out: out.has(other.id) })),
    server,
    outUnmounted: [...out].filter((id) => !mounted.has(id)),
    record,
    live(id) {
      if (!lives.has(id)) lives.set(id, safeProps(debug, id));
      return lives.get(id) ?? null;
    },
    appValue(id, prop) {
      let byProp = values.get(id);
      if (!byProp) {
        byProp = new Map();
        for (const propRow of safeInspect(debug, id)?.rows ?? []) {
          const value = appValue(propRow);
          byProp.set(propRow.name, value === undefined && !propRow.set ? NOT_SET : formatCurrent(value));
        }
        values.set(id, byProp);
      }
      return byProp.get(prop) ?? NOT_SET;
    },
  };
}

/** The group and page records acting on an Instance, and the ones it was left out of. */
function actingOn(records: readonly RecordRow[], row: InstanceRow) {
  return (["group", "page"] as const).flatMap((scope) => {
    const target = scopeTarget(row, scope);
    const record = target && recordOf(records, target);
    // A suspended record acts on nobody until it is reapplied (PER-95).
    return record && !record.suspended ? [{ scope, record, out: record.excluded.includes(row.id) }] : [];
  });
}

/** Its identity chips: the scopes acting on it, and the ones it was left out of. */
export function scopeChips(records: readonly RecordRow[], row: InstanceRow, labels: ScopeLabels): string[] {
  return actingOn(records, row).flatMap(({ scope, record, out }) => {
    if (out) return [`Left out of ${labels[scope]}`];
    return Object.keys(record.values).length > 0 ? [labels[scope] as string] : [];
  });
}

/** Per prop, the scope this Instance falls back to once its own Override is reset: the narrowest left. */
export function fallbacks(records: readonly RecordRow[], row: InstanceRow): Record<string, Scope> {
  const found: Record<string, Scope> = {};
  for (const { scope, record, out } of actingOn(records, row).reverse()) {
    if (out) continue;
    for (const prop of Object.keys(record.values)) found[prop] = scope;
  }
  return found;
}

/**
 * How the Current values of the members still in the scope differ, keyed by the
 * pill's label (`formatCurrent`): `{ '"ghost"': 3, '"secondary"': 1 }`.
 */
export function valueCounts(view: ScopeView, prop: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const member of view.members) {
    if (member.out) continue;
    const key = view.appValue(member.id, prop);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** In-scope members a narrower scope keeps at their own value, where this scope overrides `prop`. */
export function keepingOwn(view: ScopeView, prop: string): string[] {
  if (!view.record || !(prop in view.record.values)) return [];
  return view.members
    .filter((member) => !member.out && narrower(view.live(member.id)?.sources[prop], view.scope))
    .map((member) => member.id);
}
