// Every sentence the panel shows, and every word that depends on what is on the
// page (PER-214): the rest of `panel-view/` decides, this file says it. Only card
// headings and button names stay in the views, beside the element they name.

import { callSiteLabels, parseHint } from "../../call-site.js";
import type { DefaultValue } from "../../meta/types.js";
import type { NoteKind } from "../../runtime/inspect.js";
import type { LastSeen } from "../../runtime/registry.js";
import type { Props, Scope, ScopeTarget, Status, Suspension } from "../../runtime/store.js";
import { formatCurrent, formatDefault, plural } from "../format.js";
import type { InspectOnlyReason, StatusTag, Tag, ValueText } from "./types.js";

export const NOT_SET = "not set";
export const THIS_INSTANCE = "This instance";
export const PAGE_LABEL = "All on page";

// ── Notes ───────────────────────────────────────────────────────────────────

/** ` (reason)` after the React self-check's sentence, or nothing when it gave none. */
function inParentheses(reason: string | undefined): string {
  return reason ? ` (${reason})` : "";
}

/** Each card-level note: a title that names its kind, and its sentence. Only `overrides-off` reads the status. */
export const NOTES: Record<NoteKind, { title: string; text(status: Status): string }> = {
  server: {
    title: "On the server",
    text: () => "Rendered by a Server Component, so Loupe can show its props but can’t change them.",
  },
  // The panel's banner says this instead (PER-184), so it reaches a card only while
  // the page and the inspection disagree about the status, for a frame.
  "overrides-off": {
    title: "Overrides are off",
    text: (status) =>
      `Overrides are off, everything is inspect-only: this React build isn’t supported${inParentheses(status.overrides ? undefined : status.reason)}.`,
  },
  unadapted: {
    title: "Inspect only · No Adapter",
    text: () =>
      "No Adapter renders this Instance, so it is inspect-only: `loupe generate` writes Adapters only for components with a prop that can be Editable, and imports inside the design system are never swapped for one.",
  },
  spreads: {
    title: "Props spread here",
    text: () => "This call site spreads props, so library props can’t be separated from the app’s here.",
  },
  // `generate`'s Adapters always carry their metadata, so only one made by hand gets here,
  // and a `generate` run leaves it as it is (PER-234).
  "no-meta": {
    title: "No prop metadata",
    text: () =>
      "This Adapter was made without prop metadata, so its props are inspect-only. Pass the metadata to `createAdapter` as `{ props }`, as the Product layer’s Adapters do.",
  },
};

export const OVERRIDES_OFF_TITLE = "Overrides are off";

/** The Overrides-off banner's sentence, under its title. */
export function overridesOffBanner(reason: string): string {
  return `Everything is inspect-only: this React build isn’t supported${inParentheses(reason)}.`;
}

// ── Verdicts ────────────────────────────────────────────────────────────────

export const SUPPORTED: StatusTag = { kind: "supported", text: "Supported" };

/** Why a component or an Instance is inspect only, as the list says it. */
export const REASON_TEXT: Record<InspectOnlyReason, string> = {
  "not-mounted": "No Instance mounted",
  "not-generated": "Not generated yet",
  server: "Rendered on the server",
  "overrides-off": "Overrides are off",
  "no-adapter": "No Adapter",
  "no-editable": "No Editable prop",
};

export const NOT_GENERATED: StatusTag = { kind: "not-generated", text: "Not generated yet" };
const INSPECT_ONLY: StatusTag = { kind: "inspect-only", text: "Inspect only" };

/** The status tag an inspect-only reason gets; none for a component with no Instance mounted. */
export function inspectOnlyTag(reason: InspectOnlyReason): StatusTag | null {
  if (reason === "not-mounted") return null;
  return reason === "not-generated" ? NOT_GENERATED : INSPECT_ONLY;
}

// ── Tags ────────────────────────────────────────────────────────────────────

export const TAGS = {
  server: { kind: "server", text: "On the server" },
  suspended: { kind: "suspended", text: "Held for review" },
  notMounted: { kind: "not-mounted", text: "No Instance mounted" },
  stale: { kind: "stale", text: "Source changed" },
  leftOut: { kind: "left-out", text: "Left out" },
  leftOutUnmounted: { kind: "left-out-unmounted", text: "Left out · not mounted" },
  notVisible: { kind: "not-visible", text: "Not visible now" },
} as const satisfies Record<string, Tag>;

/** An Instance's record that isn't mounted: held for review when Suspended, otherwise just not mounted. */
export const unmountedTag = (suspended: boolean): Tag => (suspended ? TAGS.suspended : TAGS.notMounted);

/** Sentences the panel shows whatever is on the page. */
export const TEXT = {
  startTitle: "What do you want to change?",
  startBody: "Pick it right on the page, or start from what this page uses most.",
  seenNotMounted: "Seen on this page, not mounted now. Select its menu or dialog and press Hold open to inspect it.",
  notOnPage: "Not on the page now",
  showsWhenMounted: "It shows here again when it mounts. To keep a menu or dialog open, select it and press Hold open.",
  untick: "Untick one to leave it out. It keeps its own value.",
  picked: "picked",
  current: "App value:",
  state: "State prop",
  empty: "empty",
  none: "None",
  run: "Run",
  fromRootToReadProps: "from the repo root to read its props.",
} as const;

// ── The page and its list ───────────────────────────────────────────────────

/**
 * The page's name from its route's last segment: `/org/acme/settings/billing`
 * reads Billing. Titles put the app's name first as often as last, so the route
 * is the steadier source.
 */
export function pageName(route: string): string {
  const segment = decodeURIComponent(route.split("/").filter(Boolean).at(-1) ?? "");
  if (segment === "") return "Home";
  const words = segment.replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function listSummary(components: number, instances: number): string {
  return `${plural(components, "component")} · ${plural(instances, "Instance")}`;
}

export const timesText = (count: number) => `×${count}`;
/** How many of a component's Instances an Override changes: one unit, Instances, beside the footer's Overrides. */
export const overridesNote = (count: number) => `${plural(count, "Instance")} changed`;
export const notMountedNote = (count: number) => `${count} not mounted`;

/** The call site's file and line, then the key path that tells repeated Instances apart. */
export function instanceLabel(id: string, hint: string | null): string {
  const site = parseHint(hint);
  const where = site ? `${site.path.split("/").at(-1)}:${site.line}` : id;
  return `${where}${callSiteLabels(id).key}`;
}

/** Over a component's call sites, opened: "3 call sites · pick one to inspect". */
export const sitesText = (count: number) => (count === 1 ? "1 call site · pick it to inspect" : `${count} call sites · pick one to inspect`);

/** A call site's file and line, from its hint: "member-row-menu.tsx:37". Its anchor when it has no hint. */
export function siteWhere(anchor: string, hint: string | null): string {
  const site = parseHint(hint);
  return site ? `${site.path.split("/").at(-1)}:${site.line}` : callSiteLabels(anchor).short;
}

/** What a call site's Instances show, the first two by name: "Ana Souza, Bruno Lima +2". */
export function siteNames(names: readonly string[]): string {
  if (names.length === 1) return names[0] as string;
  const shown = names.slice(0, 2).map(isolate).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}

/** The key path that tells repeated Instances apart, or the whole id when there is none. */
export function keyOf(id: string): string {
  return callSiteLabels(id).key || id;
}

/** What a record names: an Instance, every Instance from a call site, or a component on a page. */
export function targetLabel(target: ScopeTarget): string {
  const short = (idOrAnchor: string) => callSiteLabels(idOrAnchor).short;
  switch (target.scope) {
    case "instance":
      return short(target.id);
    case "group":
      return `All from ${short(target.anchor)}`;
    case "page":
      return `${target.component} on ${target.route}`;
  }
}

/** Why a record is held, in the words of PER-95's decision. */
export function suspensionReason(suspended: Suspension): string {
  return suspended.reason === "ambiguous"
    ? `Matches more than one Instance (${suspended.ids.join(", ")}): discard it and set it again on the one you mean.`
    : `Code changed here: this call site had ${suspended.was} uses, now ${suspended.now}.`;
}

/**
 * A held record's values, each beside the Current value its Instance last
 * rendered with: an unmounted Instance's Current value is only ever last seen.
 */
export function heldValues(values: Props, lastSeen: LastSeen | null): string[] {
  return Object.entries(values).map(([prop, value]) => `${prop} ${formatCurrent(value)}${currentLastSeen(lastSeen, prop)}`);
}

/** Nothing when there is no last-seen value: the id may be mounted again, on another element. */
function currentLastSeen(lastSeen: LastSeen | null, prop: string): string {
  if (lastSeen === null) return "";
  const value = prop in lastSeen.current ? formatCurrent(lastSeen.current[prop]) : NOT_SET;
  return ` · Current ${value} (last seen)`;
}

export const suspendedMeta = (count: number) => `${count} · apply to nothing`;

/**
 * The band's report: the page, its numbered changes, and the State props held open,
 * which the Proposal shows as states, not changes: "Home · 2 changes · 1 state shown".
 */
export function headerReport(route: string, changes: number, states: number): string {
  const parts = [pageName(route)];
  if (changes > 0) parts.push(plural(changes, "change"));
  if (states > 0) parts.push(statesShown(states));
  return parts.join(" · ");
}

/**
 * An app's own words set inside Loupe's English, between Unicode direction isolates
 * (the string form of `<bdi>`): an Arabic or Hebrew name can't reorder the words around it.
 */
export const isolate = (text: string) => `\u2068${text}\u2069`;

/** What a numbered change reaches, by name: "Actions for Ana Souza", "Actions for Ana Souza and 3 more". */
export function reachText(first: string, count: number): string {
  return count > 1 ? `${isolate(first)} and ${count - 1} more` : first;
}

/** The component and where its call site is: "Button · member-row-menu.tsx:37". */
export function whereText(component: string, site: { path: string; line: number } | null): string {
  return site ? `${component} · ${site.path.split("/").at(-1)}:${site.line}` : component;
}

function statesShown(count: number): string {
  return plural(count, "state shown", "states shown");
}

/** The footer's count: the numbered changes, and the states shown beside them: "2 changes · 1 state shown". */
export function footerCount(changes: number, states: number): string {
  return states > 0 ? `${plural(changes, "change")} · ${statesShown(states)}` : plural(changes, "change");
}

/** The footer's word after its big number. */
export const changesWord = (count: number) => (count === 1 ? "change" : "changes");

/** The footer's chip for the State props held open, as Paper draws it: "1 held". */
export const heldChip = (count: number) => (count > 0 ? `${count} held` : null);

/** What a held State prop shows: "open held at true". */
export function stateDetail(prop: string, value: string): string {
  return `${prop} held at ${value}`;
}

// ── The Inspector ───────────────────────────────────────────────────────────

export function coverageText(editable: number, inspectOnly: number): string {
  return `${plural(editable, "editable prop")} · ${inspectOnly} inspect only`;
}

export function callSiteText(site: { path: string; line: number; column: number; ordinal: number; total: number }, anchor: string) {
  return {
    // Which use of the component in its function, only when there is more than one to tell apart.
    text: `${site.path.split("/").at(-1)}:${site.line}${site.total > 1 ? ` · use ${site.ordinal} of ${site.total}` : ""}`,
    title: `${site.path}:${site.line}:${site.column}\n${anchor}`,
  };
}

export const NO_CALL_SITE = "No call site was anchored here.";
export const injectedSummary = (count: number) => `${count} set by the library`;
export const INSPECT_ONLY_OVERRIDES_OFF = "Overrides off";

export const NO_GROUP = { label: "No call site group", title: "No call site was anchored here, so it has no group." };

// ── The pick tag: what a click on the page would select (2026-11-20) ──────────

/** On the tag of an Instance no Override can reach: the list's status tag. */
export const PICK_INSPECT_ONLY = INSPECT_ONLY.text;
/** On the tag in Select multiple: how many Instances a click selects. */
export const pickCount = (count: number) => `${count} from this call site`;

/** "All in MemberRowMenu", and "· Button 2 of 2" when the enclosing component uses it more than once. */
export function groupName(enclosing: string | null, component: string, site: { ordinal: number; total: number } | null): string {
  const base = enclosing ? `All in ${enclosing}` : "All from this call site";
  return site && site.total > 1 ? `${base} · ${component} ${site.ordinal} of ${site.total}` : base;
}

/** The scope picker's label: the scope's name with its size, and what it can't change. */
export function scopeLabel(name: string, scope: Scope, size: number, server: number, suspended: boolean): string {
  const sized = scope === "instance" ? "" : ` · ${size}`;
  const serverNote = server > 0 ? ` (${server} server-rendered, inspect only)` : "";
  return `${name}${sized}${serverNote}${suspended ? " (suspended for review)" : ""}`;
}

export const leftOutChip = (label: string) => `Left out of ${label}`;
/** How many of a scope's Instances a change here reaches: "Reaches 3 of 4". */
export const REACHES = "Reaches";
export const previewedText = (included: number, total: number) => `${REACHES} ${included} of ${total}`;
/** The Instances of the component on the page that a call site doesn't reach: "3 more on this page". */
export const moreOnPage = (more: number) => (more > 0 ? `${more} more on this page` : null);
export const siteLabel = (anchor: string) => (anchor ? callSiteLabels(anchor).short : "No call site");

// ── Prop rows ───────────────────────────────────────────────────────────────

/** The app's value as a row shows it: written, the metadata's default, or not set. */
export function valueText(row: { set: boolean; value: unknown; default?: DefaultValue }): ValueText {
  if (row.set) return { kind: "set", text: formatCurrent(row.value) };
  if (row.default) return { kind: "default", text: formatDefault(row.default) };
  return { kind: "unset", text: NOT_SET };
}

/** Where a row's value comes from: "from the app", "from All in Members". */
export const sourceText = (name: string) => `from ${name}`;
export const THE_APP = "the app";
/** A scope with no name here: a group Override reaching an Instance whose own labels have no group. */
export const THIS_CALL_SITE = "this call site";

export const RESET_TO: Record<Scope, string> = { instance: "Reset", group: "Reset to group value", page: "Reset to page value" };
export const RESET = "Reset";

/** One line under a label-text row the call site writes in a way no field can change (PER-113). */
export const EXPLAIN: Partial<Record<string, string>> = {
  "FROM CODE": "Written as an expression here, so it changes in code.",
  MIXED: "Text and code together: no single string to change.",
  CONTENT: "Elements, or nothing, between the tags.",
};

/** What each reason a prop gets no control means, for its tooltip. */
export const REASON_TITLES: Partial<Record<string, string>> = {
  FUNCTION: "A function, such as an event handler: there is no value to try.",
  CONTENT: "Elements, or nothing, between the tags.",
  "OPEN TEXT": "Any text fits here, so there is no set of options to choose from.",
  OBJECT: "An object or a list: no single value to choose.",
  STRUCTURAL: "It changes which element renders, not how it looks.",
  "LINKED PROPS": "It only works together with another prop.",
  UNVERIFIED: "Its options couldn’t be confirmed from the code.",
  "FROM CODE": "Written as an expression here, so it changes in code.",
  MIXED: "Text and code together: no single string to change.",
};

export const sameOnAll = (count: number) => `Same on all ${count}`;
export const countsText = (counts: Map<string, number>) => [...counts].map(([key, count]) => `${key} ${count}`).join(" · ");

export function keepingText(keeping: number, inScope: number): string {
  return `${keeping} of ${inScope} ${keeping === 1 ? "keeps its own value" : "keep their own values"}`;
}

/** The held notice around its two values: "Your Override holds this at true; the app tried to set false." */
export function heldNotice(value: unknown, tried: unknown) {
  const parts = {
    before: "Your Override holds this at",
    value: formatCurrent(value),
    middle: "; the app tried to set",
    tried: formatCurrent(tried),
    after: ".",
  };
  // As the row draws it: a space after `before` and after `middle`, none around the rest.
  return { ...parts, text: `${parts.before} ${parts.value}${parts.middle} ${parts.tried}${parts.after}` };
}

// ── The Inspector's own words (the 2026-11-20 layout pass) ──────────────────────

/** The fold of props this Instance shows but can't change here: "Inspect only · 6". */
export const inspectOnlyTitle = (count: number) => (count === 0 ? "Inspect only" : `Inspect only · ${count}`);

/** An adapted Instance none of whose props is Editable: said once, as a note, instead of a bare tag. */
export const NO_EDITABLE_NOTE = {
  title: "No Editable prop",
  text: "None of its props has a set of values or label text to try, so Loupe can show them but not change them.",
} as const;

/** The legend under the first table that marks a default: what its marks mean, said once. */
export const LEGEND = { shown: "Shows now", app: "App’s value", default: "Default" } as const;
