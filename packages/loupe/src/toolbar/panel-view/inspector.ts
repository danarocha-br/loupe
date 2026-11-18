// The Inspector (an Instance selected): its identity, verdict, scopes, note,
// Coverage and rows; or "Not on the page now" once it has gone.

import type { InstanceRow } from "../../runtime/debug.js";
import type { Scope } from "../../runtime/store.js";
import { formatCurrent } from "../format.js";
import { instanceRecord, type Page } from "./page.js";
import type { Reads } from "./reads.js";
import { type Editing, instanceProp, scopeProp } from "./rows.js";
import { fallbacks, labelsOf, membersView, scopeChips, type ScopeView, scopeView } from "./scopes.js";
import type { GoneBody, InspectorBody, ScopeOption, Tag } from "./types.js";
import { instanceVerdict } from "./verdict.js";
import {
  callSiteText,
  coverageText,
  heldValues,
  INSPECT_ONLY_OVERRIDES_OFF,
  injectedSummary,
  NO_CALL_SITE,
  NO_GROUP,
  NOT_GENERATED,
  NOTES,
  TAGS,
  unmountedTag,
} from "./words.js";

/** The Inspector's choice of scope: the one that applies, and its view at a group or page scope. */
export type Scoping = { scope: Scope; scoped: ScopeView | null };

const SCOPES: readonly Scope[] = ["instance", "group", "page"];

/** A dozen props still read as one segment each; past that, two proportional ones. */
const MAX_SEGMENTS = 12;

/** `row`: the selected Instance's list row, when it is mounted. */
export function inspectorBody(id: string, row: InstanceRow | null, page: Page, reads: Reads, scoping: Scoping): InspectorBody | GoneBody {
  const inspection = reads.inspect(id);
  // An Instance-scope record that holds an Override, mounted or not: what "Reset this Instance" drops.
  const record = instanceRecord(page.records, id);
  const holds = record !== null && Object.keys(record.values).length > 0;
  const recorded = page.status.overrides && holds;
  if (inspection === null) {
    return {
      kind: "gone",
      id,
      held: record && holds ? { tag: unmountedTag(record.suspended !== null), values: heldValues(record.values, reads.lastSeen(id)) } : null,
      canReset: recorded,
    };
  }
  // Null for a server-rendered Instance, one with no Adapter, or while Overrides are off: no controls then.
  const live = inspection.rendered === "client" && page.status.overrides ? reads.props(id) : null;
  const labels = labelsOf(row);
  const editing: Editing | null = live ? { id, live, labels, fallback: row ? fallbacks(page.records, row) : {} } : null;
  const scoped = editing ? scoping.scoped : null;
  const notGenerated = page.notGenerated.has(inspection.component);
  const adapted = row ? row.adapted : inspection.rendered === "client" && inspection.note !== "unadapted";
  // Never generated: its Coverage line says so; the note's "no Editable prop" would be a guess.
  // Overrides off: the panel's banner already says it (PER-184).
  const noteKind =
    inspection.note === null ||
    (inspection.note === "unadapted" && notGenerated) ||
    (inspection.note === "overrides-off" && !page.status.overrides)
      ? null
      : inspection.note;
  const tags: Tag[] = [];
  if (inspection.rendered === "server") tags.push(TAGS.server);
  if (page.stale.has(inspection.component)) tags.push(TAGS.stale);
  const injected = Object.entries(inspection.injected);
  const site = inspection.callSite;
  const { editable, inspectOnly } = inspection.coverage;
  return {
    kind: "inspector",
    id: inspection.id,
    component: inspection.component,
    verdict: instanceVerdict(inspection, adapted, page),
    tags,
    chips: row ? scopeChips(page.records, row, labels) : [],
    crumbs: reads.ancestors(id).map((ancestor) => ({ id: ancestor, label: reads.inspect(ancestor)?.component ?? ancestor })),
    editing: editing ? { resetInstanceEnabled: recorded, scopes: row ? scopeOptions(page, row, scoping.scope) : null } : null,
    members: scoped ? membersView(scoped, id, page.rows) : null,
    note: noteKind ? { kind: noteKind, title: NOTES[noteKind].title, body: NOTES[noteKind].text(page.status) } : null,
    coverage: {
      editable,
      inspectOnly,
      text: coverageText(editable, inspectOnly),
      callSite: site ? callSiteText(site, inspection.anchor) : null,
      noCallSite: NO_CALL_SITE,
      segmented: editable + inspectOnly <= MAX_SEGMENTS,
      notGenerated: notGenerated ? { tag: NOT_GENERATED, command: page.command } : null,
    },
    editable: inspection.rows
      .filter((candidate) => candidate.editable)
      .map((candidate) => (scoped ? scopeProp(candidate, id, scoped, reads) : instanceProp(candidate, editing))),
    // At a wider scope, inspect-only rows show the app's value alone.
    inspectOnly: inspection.rows.filter((candidate) => !candidate.editable).map((candidate) => instanceProp(candidate, scoped ? null : editing)),
    inspectOnlyMeta: page.status.overrides ? null : INSPECT_ONLY_OVERRIDES_OFF,
    injected:
      injected.length > 0
        ? { summary: injectedSummary(injected.length), rows: injected.map(([name, value]) => ({ name, value: formatCurrent(value) })) }
        : null,
  };
}

/** APPLY TO: this instance, every Instance from this call site, every Instance on this page, each with its size. */
function scopeOptions(page: Page, row: InstanceRow, applied: Scope): ScopeOption[] {
  return SCOPES.map((scope) => {
    const view = scopeView(page.rows, page.records, row, scope);
    return {
      scope,
      label: view?.label ?? NO_GROUP.label,
      enabled: view !== null,
      pressed: scope === applied,
      title: view === null ? NO_GROUP.title : null,
    };
  });
}
