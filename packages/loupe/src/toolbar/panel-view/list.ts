// The component list (nothing selected): every component on the page with its
// verdict and its Instances, the records Suspended for review, and the components
// seen on this page that aren't mounted now.

import { instanceRecord, type Page } from "./page.js";
import type { Reads } from "./reads.js";
import type { GroupItem, InstanceItem, ListBody, Tag } from "./types.js";
import { componentVerdict } from "./verdict.js";
import {
  heldValues,
  instanceLabel,
  listSummary,
  notMountedNote,
  overridesNote,
  pageName,
  suspendedMeta,
  suspensionReason,
  TAGS,
  targetLabel,
  timesText,
  unmountedTag,
} from "./words.js";

export function listBody(page: Page, reads: Reads): ListBody {
  const groups = page.groups.map((group): GroupItem => {
    const verdict = componentVerdict(group, reads, page);
    const notes: GroupItem["notes"] = [];
    if (group.overrides > 0) notes.push({ kind: "overrides", text: overridesNote(group.overrides) });
    if (page.stale.has(group.component)) notes.push({ kind: "stale", text: TAGS.stale.text });
    if (group.held.length > 0) notes.push({ kind: "not-mounted", text: notMountedNote(group.held.length) });
    // "Not generated yet" is its tag, and a component with nothing mounted has no tag to explain.
    if (!verdict.supported && verdict.reason !== "not-generated" && verdict.reason !== "not-mounted") {
      notes.push({ kind: "reason", text: verdict.reasonText });
    }
    const mounted = group.instances.map((row): InstanceItem => {
      const tags: Tag[] = [];
      if (row.rendered === "server") tags.push(TAGS.server);
      if (instanceRecord(page.records, row.id)?.suspended) tags.push(TAGS.suspended);
      return { id: row.id, label: instanceLabel(row.id, row.hint), mounted: true, tags, values: [] };
    });
    const unmounted = group.held.map(
      (entry): InstanceItem => ({
        id: entry.id,
        label: instanceLabel(entry.id, entry.lastSeen?.hint ?? null),
        mounted: false,
        tags: [unmountedTag(entry.record.suspended !== null)],
        // A Suspended record's values are on the "Held for review" card above.
        values: entry.record.suspended ? [] : heldValues(entry.record.values, entry.lastSeen),
      }),
    );
    return {
      component: group.component,
      count: timesText(group.instances.length),
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
    groups,
    interaction: page.interaction,
  };
}
