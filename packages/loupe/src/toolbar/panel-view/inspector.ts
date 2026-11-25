// The Inspector (an Instance selected): its identity, verdict, scopes, note,
// Coverage and rows; or "Not on the page now" once it has gone.

import { callSiteLabels, isUnanchored, parseHint } from "../../call-site.js";
import type { InstanceRow } from "../../runtime/debug.js";
import type { PropRow } from "../../runtime/inspect.js";
import type { Scope } from "../../runtime/store.js";
import { formatCurrent } from "../format.js";
import type { Keys } from "./keys.js";
import { instanceRecord, type Page } from "./page.js";
import type { Reads } from "./reads.js";
import { type Editing, instanceProp, scopeProp } from "./rows.js";
import { fallbacks, labelsOf, membersView, scopeChips, type ScopeView, scopeView } from "./scopes.js";
import type { GoneBody, InspectorBody, ScopeOption } from "./types.js";
import type { InspectOnlyView, NoGroupView, PropItem, Tag } from "@loupe/patterns";
import { instanceVerdict } from "./verdict.js";
import {
  callSiteText,
  coverageText,
  heldValues,
  INSPECT_ONLY_OVERRIDES_OFF,
  injectedSummary,
  inspectOnlyTitle,
  NO_CALL_SITE,
  NO_EDITABLE_NOTE,
  NO_GROUP,
  NOT_GENERATED,
  NOTES,
  ONLY_THIS_INSTANCE,
  pageName,
  scopeMoveLabel,
  scopeMoveVerb,
  TAGS,
  TEXT,
  unmountedTag,
  whereText,
} from "./words.js";

/** The Inspector's choice of scope: the one that applies, and its view at a group or page scope. */
export type Scoping = { scope: Scope; scoped: ScopeView | null };

const SCOPES: readonly Scope[] = ["instance", "group", "page"];

/** A dozen props still read as one segment each; past that, two proportional ones. */
const MAX_SEGMENTS = 12;

/** `row`: the selected Instance's list row, when it is mounted. */
export function inspectorBody(
  id: string,
  row: InstanceRow | null,
  page: Page,
  reads: Reads,
  scoping: Scoping,
  keys: Keys,
): InspectorBody | GoneBody {
  const inspection = reads.inspect(id);
  // An Instance-scope record that holds an Override, mounted or not: what "Reset this Instance" drops.
  const record = instanceRecord(page.records, id);
  const holds = record !== null && Object.keys(record.values).length > 0;
  const recorded = page.status.overrides && holds;
  if (inspection === null) {
    const seen = reads.lastSeen(id);
    const site = seen ? parseHint(seen.hint) : null;
    // How it last rendered, else what its id names, when the id is a call site's.
    const component = seen?.component ?? (isUnanchored(id) ? null : callSiteLabels(id).component || null);
    const where = site ? `${site.path.split("/").at(-1)}:${site.line}` : null;
    const held = record && holds ? { tag: unmountedTag(record.suspended !== null), values: heldValues(record.values, seen) } : null;
    return {
      kind: "gone",
      id,
      canReset: recorded,
      identity: {
        component: null,
        page: null,
        status: component ? { text: TEXT.notOnPage } : null,
        keys: [],
        name: component ?? TEXT.notOnPage,
        nameTitle: id,
        ownName: false,
        where,
        whereTitle: id,
        id: null,
        note: TEXT.showsWhenMounted,
        tags: held ? [held.tag] : [],
        chips: [],
        held: held?.values ?? null,
        notGenerated: null,
        crumbs: [],
      },
    };
  }
  // Null for a server-rendered Instance, one with no Adapter, or while Overrides are off: no controls then.
  const live = inspection.rendered === "client" && page.status.overrides ? reads.props(id) : null;
  const labels = labelsOf(row);
  // Per scope, the number of the change it holds for this Instance: what a row's key shows.
  const keyAt: Editing["keyAt"] = row
    ? {
        instance: keys.of({ scope: "instance", id }),
        group: keys.of({ scope: "group", anchor: row.anchor }),
        page: keys.of({ scope: "page", route: page.route, component: row.component }),
      }
    : {};
  const editing: Editing | null = live ? { id, live, labels, fallback: row ? fallbacks(page.records, row) : {}, keyAt } : null;
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
  const verdict = instanceVerdict(inspection, adapted, page);
  // "No Editable prop" is the one Inspect only reason with no runtime note: the Toolbar says it.
  const note: InspectorBody["note"] = noteKind
    ? { kind: noteKind, title: NOTES[noteKind].title, body: NOTES[noteKind].text(page.status) }
    : !verdict.supported && verdict.reason === "no-editable"
      ? { kind: "no-editable", title: NO_EDITABLE_NOTE.title, body: NO_EDITABLE_NOTE.text }
      : null;
  const hold = editing ? holdOf(inspection.rows, editing) : null;
  const tags: Tag[] = [];
  if (inspection.rendered === "server") tags.push(TAGS.server);
  if (page.stale.has(inspection.component)) tags.push(TAGS.stale);
  // Mounted, not shown: every node it renders is hidden, or a menu or dialog that can be held open renders none.
  if (inspection.rendered === "client") {
    const shown = reads.visible(id);
    if (shown === "hidden" || (shown === "empty" && hold !== null && !hold.held)) tags.push(TAGS.notVisible);
  }
  const injected = Object.entries(inspection.injected);
  const site = inspection.callSite;
  const { editable, inspectOnly } = inspection.coverage;
  const scopes = editing && row ? scopeOptions(page, row, scoping.scope) : null;
  const name = reads.name(id);
  const source = {
    ...sourceParts(site ? callSiteText(site, inspection.anchor).text : whereText(inspection.component, site), inspection.component),
    title: site ? `${callSiteText(site, inspection.anchor).title}\n${inspection.id}` : inspection.id,
  };
  const instanceKeys = keys.marks.find((mark) => mark.id === id)?.keys ?? [];
  const chips = row ? scopeChips(page.records, row, labels) : [];
  const crumbs = reads.ancestors(id).map((ancestor) => ({ id: ancestor, label: reads.inspect(ancestor)?.component ?? ancestor }));
  const members = scoped ? membersView(scoped, id, page.rows, reads.name, row ? pageSize(page, row) : undefined, scopes) : null;
  const coverageNotGenerated = notGenerated ? { tag: NOT_GENERATED, command: page.command } : null;
  const editableRows = inspection.rows
    .filter((candidate) => candidate.editable)
    .map((candidate) =>
      scoped ? scopeProp(candidate, id, scoped, reads, scoped.record ? keys.of(scoped.record.target) : null) : instanceProp(candidate, editing),
    );
  // At a wider scope, inspect-only rows show the app's value alone.
  const inspectOnlyRows = inspection.rows.filter((candidate) => !candidate.editable).map((candidate) => instanceProp(candidate, scoped ? null : editing));
  return {
    kind: "inspector",
    id: inspection.id,
    component: inspection.component,
    name,
    where: whereText(inspection.component, site),
    source,
    keys: instanceKeys,
    hold,
    verdict,
    tags,
    chips,
    crumbs,
    editing: editing ? { resetInstanceEnabled: recorded, scopes, noGroup: scopes && noGroupOf(scopes) } : null,
    members,
    note,
    coverage: {
      editable,
      inspectOnly,
      text: coverageText(editable, inspectOnly),
      callSite: site ? callSiteText(site, inspection.anchor) : null,
      noCallSite: NO_CALL_SITE,
      segmented: editable + inspectOnly <= MAX_SEGMENTS,
      notGenerated: coverageNotGenerated,
    },
    editable: editableRows,
    inspectOnly: inspectOnlyRows,
    legend: legendOf(editableRows),
    inspectFold: inspectOnlyView(inspectOnlyRows, {
      open: editableRows.length === 0,
      meta: page.status.overrides ? null : INSPECT_ONLY_OVERRIDES_OFF,
      injected:
        injected.length > 0
          ? { summary: injectedSummary(injected.length), rows: injected.map(([prop, value]) => ({ name: prop, value: formatCurrent(value) })) }
          : null,
    }),
    identity: {
      component: name !== null ? inspection.component : null,
      page: pageName(page.route),
      status: verdict.status,
      keys: instanceKeys,
      name: name ?? inspection.component,
      nameTitle: name ?? inspection.component,
      ownName: name !== null,
      where: { file: source.file, line: source.line },
      whereTitle: source.title,
      id: inspection.id,
      note: null,
      tags,
      // The scope's own section names the scopes acting on it.
      chips: members ? [] : chips,
      held: null,
      notGenerated: coverageNotGenerated,
      crumbs,
    },
  };
}

/** A true/false prop: it shares one card of switches with the others, under the option rows. */
export function isSwitch(item: PropItem): boolean {
  const control = item.control;
  if (control?.kind !== "options" || control.options.length !== 2) return false;
  const values = control.options.map((option) => option.value);
  return values.includes(true) && values.includes(false);
}

/** The legend under the option rows: when one of them marks a default, and whether one rings the app's value. */
function legendOf(editable: readonly PropItem[]): InspectorBody["legend"] {
  const options = editable.filter((item) => !isSwitch(item));
  const marksDefault = options.some((item) => item.control?.kind === "options" && item.control.options.some((option) => option.isDefault));
  return marksDefault ? { app: options.some((item) => item.change !== null && item.counts === null) } : null;
}

/**
 * Inspect only, folded to one row (open when nothing else can change). Closed, the row
 * names its props; one cause for them all is said once, under the row, instead of a tag
 * on every row.
 */
function inspectOnlyView(items: PropItem[], rest: Pick<InspectOnlyView, "open" | "meta" | "injected">): InspectOnlyView {
  const reasons = new Set(items.map((item) => item.reason));
  const [only] = reasons.size === 1 ? [...reasons] : [];
  const shared = only ? items.find((item) => item.reason === only) : undefined;
  return {
    title: inspectOnlyTitle(items.length),
    names: items.length > 0 ? ` · ${items.map((item) => item.name).join(", ")}` : null,
    shared: shared?.reason ? { reason: shared.reason, title: shared.reasonTitle } : null,
    rows: shared ? items.map((item) => ({ ...item, reason: null })) : items,
    empty: TEXT.none,
    ...rest,
  };
}

/** Where it is written, without the component the title line names, its line set apart: "member-row-menu.tsx" and ":37". */
function sourceParts(text: string, component: string): { file: string; line: string } {
  const place = text.startsWith(`${component} · `) ? text.slice(component.length + 3) : text;
  const at = place.search(/:\d/);
  return at === -1 ? { file: place, line: "" } : { file: place.slice(0, at), line: place.slice(at) };
}

/** How many Instances the page scope reaches from this one: what a call site's "more on this page" counts from. */
function pageSize(page: Page, row: InstanceRow): number | undefined {
  const view = scopeView(page.rows, page.records, row, "page");
  return view ? view.members.length + view.server.length : undefined;
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

/** Select multiple with no call site: why it selects this Instance alone, and Widen to the page while that applies. */
function noGroupOf(scopes: readonly ScopeOption[]): NoGroupView {
  const group = scopes.find((option) => option.scope === "group");
  const page = scopes.find((option) => option.scope === "page");
  return {
    text: group?.title ?? ONLY_THIS_INSTANCE,
    widen: page?.enabled ? { scope: page.scope, text: `${scopeMoveVerb("group")} ${scopeMoveLabel(page.label)}`, title: page.title ?? page.label } : null,
  };
}

/**
 * "Hold open": the first State prop with a true/false choice, such as a menu's
 * `open`. Clicking the panel closes the app's own menus, so holding one open is a
 * button on the Instance, not a pill seventh in a list (critique 2026-11-19).
 */
function holdOf(rows: readonly PropRow[], editing: Editing): InspectorBody["hold"] {
  const row = rows.find(
    (candidate) => candidate.editable && candidate.state === true && candidate.options?.includes(true) && candidate.options.includes(false),
  );
  if (!row) return null;
  const held = editing.live.sources[row.name] === "instance" && editing.live.overrides[row.name] === true;
  return { prop: row.name, held, write: { id: editing.id, prop: row.name, scope: "instance" } };
}
