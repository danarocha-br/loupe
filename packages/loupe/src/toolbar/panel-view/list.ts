// The component list (nothing selected): every component on the page with its
// verdict and its Instances, the records Suspended for review, and the components
// seen on this page that aren't mounted now.

import type { ScopeTarget } from "../../runtime/store.js";
import { formatCurrent } from "../format.js";
import type { Keys } from "./keys.js";
import { instanceRecord, type Page } from "./page.js";
import type { Reads } from "./reads.js";
import type { InstanceRow } from "../../runtime/debug.js";
import type { CallSiteItem, ChangeItem, GroupItem, InstanceItem, ListBody, StateItem, Tag } from "./types.js";
import { componentVerdict } from "./verdict.js";
import {
  heldValues,
  instanceLabel,
  listSummary,
  notMountedNote,
  NOT_SET,
  overridesNote,
  pageName,
  reachText,
  siteNames,
  sitesText,
  siteWhere,
  stateDetail,
  suspendedMeta,
  suspensionReason,
  TAGS,
  targetLabel,
  timesText,
  unmountedTag,
} from "./words.js";

export function listBody(page: Page, reads: Reads, keys: Keys): ListBody {
  const marked = new Map(keys.marks.map((mark) => [mark.id, mark.keys]));
  const most = Math.max(1, ...page.groups.map((group) => group.instances.length));
  // Most used first: the bars then read as a ranking; ties stay alphabetical.
  const ranked = [...page.groups].sort((a, b) => b.instances.length - a.instances.length);
  const groups = ranked.map((group): GroupItem => {
    const verdict = componentVerdict(group, reads, page);
    const notes: GroupItem["notes"] = [];
    if (group.overrides > 0) notes.push({ kind: "overrides", text: overridesNote(group.overrides) });
    if (page.stale.has(group.component)) notes.push({ kind: "stale", text: TAGS.stale.text });
    if (group.held.length > 0) notes.push({ kind: "not-mounted", text: notMountedNote(group.held.length) });
    // Why it is inspect only is the eye's, in the row's tooltip (`statusTitle`): the line keeps what changed.
    const mounted = group.instances.map((row): InstanceItem => {
      const tags: Tag[] = [];
      if (row.rendered === "server") tags.push(TAGS.server);
      if (instanceRecord(page.records, row.id)?.suspended) tags.push(TAGS.suspended);
      return {
        id: row.id,
        label: instanceLabel(row.id, row.hint),
        name: reads.name(row.id),
        keys: marked.get(row.id) ?? [],
        mounted: true,
        tags,
        values: [],
      };
    });
    const unmounted = group.held.map(
      (entry): InstanceItem => ({
        id: entry.id,
        label: instanceLabel(entry.id, entry.lastSeen?.hint ?? null),
        name: null,
        keys: [],
        mounted: false,
        tags: [unmountedTag(entry.record.suspended !== null)],
        // A Suspended record's values are on the "Held for review" card above.
        values: entry.record.suspended ? [] : heldValues(entry.record.values, entry.lastSeen),
      }),
    );
    return {
      component: group.component,
      count: timesText(group.instances.length),
      mountedCount: group.instances.length,
      share: group.instances.length / most,
      // A component with nothing mounted has no tag, and no eye either.
      inspectOnly: !verdict.supported && verdict.status !== null,
      sites: callSites(group.instances, reads, verdict.supported),
      sitesText: sitesText(new Set(group.instances.map((row) => row.anchor)).size),
      verdict,
      statusTitle: verdict.supported ? null : verdict.reason === "not-generated" ? page.command : verdict.reasonText,
      notes,
      outlineIds: group.instances.map((row) => row.id),
      instances: [...mounted, ...unmounted],
    };
  });
  const notGenerated = page.groups.map((group) => group.component).filter((component) => page.notGenerated.has(component));
  // Suspended for review (PER-95): they apply to nothing until discarded.
  const suspended = page.records.flatMap((record) =>
    record.suspended === null
      ? []
      : [
          {
            target: record.target,
            label: targetLabel(record.target),
            why: suspensionReason(record.suspended),
            values: heldValues(record.values, record.target.scope === "instance" ? reads.lastSeen(record.target.id) : null),
          },
        ],
  );
  return {
    kind: "list",
    page: { name: pageName(page.route), route: page.route },
    notGenerated: notGenerated.length > 0 ? { names: notGenerated, command: page.command } : null,
    suspended,
    suspendedMeta: suspendedMeta(suspended.length),
    summary: listSummary(page.groups.length, page.instanceCount),
    changes: changeItems(keys, page, reads),
    groups,
    interaction: page.interaction,
  };
}

/** A component's mounted Instances by call site, in page order, each named by what its Instances show. */
function callSites(rows: readonly InstanceRow[], reads: Reads, supported: boolean): CallSiteItem[] {
  const bySite = new Map<string, InstanceRow[]>();
  for (const row of rows) bySite.set(row.anchor, [...(bySite.get(row.anchor) ?? []), row]);
  return [...bySite].map(([anchor, siteRows]) => {
    const [first] = siteRows as [InstanceRow];
    const instances = siteRows.map((row) => ({ id: row.id, label: reads.name(row.id) ?? instanceLabel(row.id, row.hint) }));
    return {
      anchor,
      label: siteWhere(anchor, first.hint),
      names: siteNames(instances.map((instance) => instance.label)),
      ids: instances.map((instance) => instance.id),
      instances,
      select: first.id,
      // An Instance on the server, or one with no Adapter, keeps the component's own word.
      supported: supported && siteRows.every((row) => row.rendered === "client" && row.adapted),
    };
  });
}

/** The plot key's numbered changes as the panel lists them: what each changes, from what to what, and where. */
export function changeItems(keys: Keys, page: Page, reads: Reads): ChangeItem[] {
  return keys.changes.map(({ n, record, props }): ChangeItem => {
    const reached = reachedBy(record.target, record.excluded, page);
    const [first] = reached;
    const detail = props
      .map((prop) => {
        const from = first ? (reads.appValue(first, prop)?.label ?? NOT_SET) : null;
        const to = formatCurrent(record.values[prop]);
        return from === null ? `${prop} → ${to}` : `${prop} ${from} → ${to}`;
      })
      .join(", ");
    const named = first ? reads.name(first) : null;
    return {
      n,
      props: props.join(", "),
      detail,
      where: named ? reachText(named, reached.length) : targetLabel(record.target),
      select: first ?? null,
      reached,
    };
  });
}

/** Each State prop an Instance Override holds: what the Proposal lists as a state shown, not a change. */
export function stateItems(page: Page, reads: Reads): StateItem[] {
  const stateProps = new Map(page.rows.map((row) => [row.id, row.stateProps]));
  return page.records.flatMap((record) => {
    if (record.target.scope !== "instance" || record.suspended) return [];
    const { id } = record.target;
    const held = Object.keys(record.values).filter((prop) => stateProps.get(id)?.includes(prop));
    const mounted = page.rows.some((row) => row.id === id && row.rendered === "client");
    const where = (mounted ? reads.name(id) : null) ?? targetLabel(record.target);
    return held.map((prop) => ({ detail: stateDetail(prop, formatCurrent(record.values[prop])), where }));
  });
}

/** The mounted Instances a change reaches now, in page order: its own, or those its scope reaches. */
function reachedBy(target: ScopeTarget, excluded: readonly string[], page: Page): string[] {
  return page.rows
    .filter((candidate) => {
      if (candidate.rendered !== "client" || excluded.includes(candidate.id)) return false;
      switch (target.scope) {
        case "instance":
          return candidate.id === target.id;
        case "group":
          return candidate.anchor === target.anchor;
        case "page":
          return candidate.component === target.component && page.route === target.route;
      }
    })
    .map((candidate) => candidate.id);
}
