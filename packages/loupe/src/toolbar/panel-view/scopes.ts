// The three scopes an Override can be set at (PER-90): who each one reaches, what
// it is called, and how its members' Current values differ. Read-only: writes go
// through `__loupe` with the selected Instance as the scope's representative.

import { callSiteLabels, isUnanchored, parseHint } from "../../call-site.js";
import type { InstanceRow, RecordRow } from "../../runtime/debug.js";
import { identityOf } from "../../runtime/registry.js";
import { inScope, PRECEDENCE, reachOf, recordsFor, type Scope, type ScopeTarget, type Source, targetAt } from "../../runtime/store.js";
import { formatCurrent } from "../format.js";
import type { AppValue, Reads } from "./reads.js";
import type { Member, ScopeOption } from "./types.js";
import type { MemberItem, MembersView, SiteItem } from "@loupe/patterns";
import {
  groupName,
  instancesText,
  keyOf,
  leftOutChip,
  moreOnPage,
  PAGE_LABEL,
  previewedText,
  REACHES,
  reachCount,
  scopeLabel,
  scopeMoveLabel,
  scopeMoveVerb,
  scopeTitle,
  siteLabel,
  TAGS,
  THIS_INSTANCE,
} from "./words.js";

/** What each scope is called: "This instance", "All in MemberRowMenu", "All on page". Null: no group. */
export type ScopeLabels = Record<Scope, string | null>;

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
};

type Labelled = Pick<InstanceRow, "anchor" | "hint" | "component">;

function groupLabel(row: Labelled): string | null {
  if (isUnanchored(row.anchor)) return null;
  return groupName(callSiteLabels(row.anchor).enclosing, row.component, parseHint(row.hint));
}

export function labelsOf(row: Labelled | null): ScopeLabels {
  return { instance: THIS_INSTANCE, group: row ? groupLabel(row) : null, page: PAGE_LABEL };
}

/** Who `scope` reaches from `row`, or null when the Instance has no such scope. */
export function scopeView(rows: readonly InstanceRow[], records: readonly RecordRow[], row: InstanceRow, scope: Scope): ScopeView | null {
  const identity = identityOf(row);
  const target = targetAt(identity, scope);
  const name = labelsOf(row)[scope];
  if (!target || name === null) return null;
  const record = recordsFor(records, identity).find((entry) => entry.record.target.scope === scope)?.record ?? null;
  const atScope = rows.filter((other) => inScope(target, identityOf(other)));
  // An Override reaches only an adapted Instance; one with no Adapter (inside the design system, say) never joins.
  const client = atScope.filter((other) => other.rendered === "client" && other.adapted);
  const server = scope === "page" ? atScope.filter((other) => other.rendered === "server") : [];
  const mounted = new Set(client.map((other) => other.id));
  return {
    scope,
    target,
    label: scopeLabel(name, scope, client.length + server.length, server.length, Boolean(record?.suspended)),
    name,
    members: client.map((other) => ({
      id: other.id,
      out: record !== null && reachOf(record, identityOf(other)) === "left-out",
    })),
    server,
    outUnmounted: (record?.excluded ?? []).filter((id) => !mounted.has(id)),
    record,
  };
}

/** Whether the scope's record is Suspended: shown, never written (PER-95). */
export function isSuspended(view: ScopeView): boolean {
  return view.record?.suspended != null;
}

/** The view without members that have gone since the list was read: they drop out. */
export function present(view: ScopeView, reads: Reads): ScopeView {
  return { ...view, members: view.members.filter((member) => reads.inspect(member.id) !== null) };
}

/** The group and page records acting on an Instance, and the ones it was left out of. */
function actingOn(records: readonly RecordRow[], row: InstanceRow) {
  return recordsFor(records, identityOf(row)).flatMap(({ record, reach }) => {
    const { scope } = record.target;
    // A suspended record acts on nobody until it is reapplied (PER-95), not even to leave one out.
    return scope === "instance" || record.suspended ? [] : [{ scope, record, out: reach === "left-out" }];
  });
}

/** Its identity chips: the scopes acting on it, and the ones it was left out of. */
export function scopeChips(records: readonly RecordRow[], row: InstanceRow, labels: ScopeLabels): string[] {
  return actingOn(records, row).flatMap(({ scope, record, out }) => {
    if (out) return [leftOutChip(labels[scope] as string)];
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

/** One of the values the members still in a scope have for a prop, and how many have it. */
export type Counted = AppValue & { count: number };

/**
 * How the values of the members still in the scope differ, keyed by the pill's
 * label: `{ '"ghost"': 3, '"secondary"': 1 }`. A member that has gone isn't counted.
 * `app` counts the app's own values (what a change reads from); `shown` counts what
 * each member shows now, a narrower Override's value included (what the table says).
 */
export function valueCounts(view: ScopeView, prop: string, reads: Reads, counting: "app" | "shown" = "app"): Map<string, Counted> {
  const counts = new Map<string, Counted>();
  for (const member of view.members) {
    if (member.out) continue;
    const value = counting === "shown" ? shownValue(member.id, prop, reads) : reads.appValue(member.id, prop);
    if (value === null) continue;
    const known = counts.get(value.label);
    counts.set(value.label, known ? { ...known, count: known.count + 1 } : { ...value, count: 1 });
  }
  return counts;
}

/** What a member shows now for a prop: an Override's value, whatever its scope, else the app's own. */
function shownValue(id: string, prop: string, reads: Reads): AppValue | null {
  const live = reads.props(id);
  if (live && prop in live.overrides && live.sources[prop] !== undefined && live.sources[prop] !== "app") {
    const value = live.overrides[prop];
    return { label: formatCurrent(value), value, unset: false };
  }
  return reads.appValue(id, prop);
}

/** Whether `source` is a narrower scope than `scope`, so it wins over it. */
function narrower(source: Source | undefined, scope: Scope): boolean {
  if (source === undefined || source === "app") return false;
  return PRECEDENCE.indexOf(source) < PRECEDENCE.indexOf(scope);
}

/** In-scope members a narrower scope keeps at their own value, where this scope overrides `prop`. */
export function keepingOwn(view: ScopeView, prop: string, reads: Reads): string[] {
  if (!view.record || !(prop in view.record.values)) return [];
  return view.members
    .filter((member) => !member.out && narrower(reads.props(member.id)?.sources[prop], view.scope))
    .map((member) => member.id);
}

/**
 * Who a group or page change reaches, with a box to leave each one out. A page
 * scope groups them by call site, so one box leaves a whole call site out.
 */
export function membersView(
  view: ScopeView,
  selected: string,
  rows: readonly InstanceRow[],
  name: (id: string) => string | null = () => null,
  /** The component's Instances the page scope reaches; the scope's own size when unknown. */
  pageSize: number = view.members.length + view.server.length,
  /** The Inspector's scope options: the scope's name, and where the selection can move from it. */
  options: readonly ScopeOption[] | null = null,
): MembersView {
  const { scope } = view;
  if (scope === "instance") throw new Error("[loupe] This instance has no members to list.");
  const members = view.members.map(
    (member): MemberItem => ({
      id: member.id,
      label: member.id === selected ? THIS_INSTANCE : keyOf(member.id),
      name: name(member.id),
      out: member.out,
      tag: member.out ? TAGS.leftOut : null,
      toggle: member.out ? "include" : "exclude",
    }),
  );
  let sites: SiteItem[] | null = null;
  if (scope === "page") {
    const anchorOf = new Map(rows.map((candidate) => [candidate.id, candidate.anchor]));
    const bySite = new Map<string, MemberItem[]>();
    for (const member of members) {
      const anchor = anchorOf.get(member.id) ?? "";
      bySite.set(anchor, [...(bySite.get(anchor) ?? []), member]);
    }
    sites = [...bySite].map(([anchor, siteMembers]) => {
      const allIn = siteMembers.every((member) => !member.out);
      return {
        anchor,
        label: siteLabel(anchor),
        count: siteMembers.length,
        allIn,
        members: siteMembers,
        // All in: the box leaves every one out. Otherwise it brings back the ones left out.
        toggle: { action: allIn ? "exclude" : "include", ids: siteMembers.filter((member) => member.out !== allIn).map((member) => member.id) },
      };
    });
  }
  const included = members.filter((member) => !member.out).length;
  // Server-rendered ones are counted but never changed: the page beyond the scope starts after them.
  const reached = members.length + view.server.length;
  const current = options?.find((option) => option.scope === scope) ?? null;
  // At a call site, widen to the page; at the page, narrow back to the call site.
  const other = options?.find((option) => option.scope === (scope === "group" ? "page" : "group") && option.enabled) ?? null;
  return {
    scope,
    name: scopeTitle(current?.label ?? null),
    nameTitle: current?.title ?? null,
    instancesText: instancesText(members.length),
    widen: other && { scope: other.scope, text: `${scopeMoveVerb(scope)} ${scopeMoveLabel(other.label)}`, title: other.title ?? other.label },
    countText: previewedText(included, members.length),
    reach: {
      lead: REACHES,
      included,
      total: members.length,
      page: Math.max(pageSize, reached),
      moreText: moreOnPage(pageSize - reached),
      countText: reachCount(included, members.length),
    },
    suspended: isSuspended(view),
    members,
    sites,
    server: view.server.map((server) => ({ id: server.id, label: name(server.id) ?? siteLabel(server.anchor), tag: TAGS.server })),
    outUnmounted: view.outUnmounted.map((outId) => ({ id: outId, tag: TAGS.leftOutUnmounted })),
    reset: { target: view.target, enabled: view.record !== null },
  };
}
