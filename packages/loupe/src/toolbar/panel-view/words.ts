// Every sentence the panel shows, and every word that depends on what is on the
// page (PER-214): the rest of `panel-view/` decides, this file says it. Only card
// headings and button names stay in the views, beside the element they name.

import { callSiteLabels, parseHint } from "../../call-site.js";
import type { DefaultValue } from "../../meta/types.js";
import type { NoteKind } from "../../runtime/inspect.js";
import type { LastSeen } from "../../runtime/registry.js";
import type { Props, Scope, ScopeTarget, Status, Suspension } from "../../runtime/store.js";
import { formatCurrent, formatDefault, plural } from "../format.js";
import type { StripState } from "./types.js";
import type { CommandWords, CopyWords, FooterWords, HeaderWords, InspectOnlyReason, InspectorWords, ListWords, StatusTag, StripPart, Tag, ValueText } from "@loupe/patterns";

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

/** The Inspector's patterns' words (patterns/view.ts `InspectorWords`). */
export const INSPECTOR_WORDS: InspectorWords = {
  change: (n) => ({ label: `Change ${n}`, title: `Change ${n} in the Proposal` }),
  heldTitle: "Held by your Override: shown as a state in the Proposal",
  empty: TEXT.empty,
  state: TEXT.state,
  current: TEXT.current,
  defaultTitle: "The component’s default: the call site doesn’t set it",
  appTag: "app",
  appValue: "the app’s value",
  designDefault: "the design system’s default",
  back: { label: "All components", title: "Back to every component on this page (Esc)" },
  inside: "Inside",
  run: TEXT.run,
  fromRootToReadProps: TEXT.fromRootToReadProps,
  untick: TEXT.untick,
  picked: TEXT.picked,
  resetScope: "Reset this scope",
  serverRendered: "Server-rendered",
  leftOutUnmounted: "Left out, not mounted",
  legend: { shown: "Shows now", app: "App’s value", default: "Default" },
  hold: (prop) => `Hold ${prop}`,
  resetInstance: "Reset this Instance",
};

/** The list's patterns' words (patterns/view.ts `ListWords`). */
export const LIST_WORDS: ListWords = {
  start: { title: TEXT.startTitle, body: TEXT.startBody, tools: "Start selecting" },
  tools: {
    one: {
      label: "Select one",
      hint: "Click one thing on the page",
      title: "Select one: click an Instance on the page to change it alone (Esc cancels)",
    },
    many: {
      label: "Select multiple",
      hint: "Every Instance from one call site",
      title: "Select multiple: click an Instance on the page to change every one from the same call site (Esc cancels)",
    },
  },
  onPage: { title: "On this page", rows: "Components on this page", map: "Page map" },
  held: { title: "Held for review", discard: "Discard", discardName: (label) => `Discard ${label}` },
  interaction: { title: "Appears on interaction", meta: "Not on screen yet", seen: TEXT.seenNotMounted },
  changes: { title: "Changes", meta: "numbered as in the Proposal" },
  change: INSPECTOR_WORDS.change,
};

/** A command's Copy button (patterns/view.ts `CommandWords`). */
export const COMMAND_WORDS: CommandWords = {
  prompt: "$ ",
  copy: "Copy",
  copied: "Copied",
  failed: "Copy failed",
  copiedText: (command) => `Copied${QUOTE.open}${command}${QUOTE.close}`,
  refused: "Couldn’t reach the clipboard. Select the command and copy it.",
};

/** The header's words and its status strip's (patterns/view.ts `HeaderWords`). */
export const HEADER_WORDS: HeaderWords = {
  pageLead: "/ ",
  tools: LIST_WORDS.tools,
  select: "Select",
  marks: {
    label: "Hide marks",
    hide: "Hide marks: take Loupe’s outlines off the page, to judge the change as it will ship. The selection stays.",
    show: "Show marks: outline the selection on the page again",
  },
  hide: { label: "Hide panel", title: "Hide the panel" },
  strip: {
    pick: {
      one: ["Click an Instance on the page", " · ", { key: "Esc" }, " cancels"],
      many: ["Click an Instance: every one from its call site is selected", " · ", { key: "Esc" }, " cancels"],
    },
    covered: ["A dialog on the page runs under the panel · hold ", { key: "Alt" }, " to see through"],
    marksHidden: ["Outlines are hidden on the page"],
  },
};

/** What the strip says, first of: picking with a tool, a dialog of the app's under the panel, the marks hidden. Null for nothing. */
export function stripParts({ picking, mode, covered, marksHidden }: StripState): readonly StripPart[] | null {
  if (picking) return HEADER_WORDS.strip.pick[mode];
  if (covered) return HEADER_WORDS.strip.covered;
  return marksHidden ? HEADER_WORDS.strip.marksHidden : null;
}

/** What the strip says as one line, each key by name: for the announcer, which says it as it changes. */
export const stripText = (parts: readonly StripPart[] | null) => (parts ? parts.map((part) => (typeof part === "string" ? part : part.key)).join("") : "");

/** The footer's words beside its count (patterns/view.ts `FooterWords`). */
export const FOOTER_WORDS: FooterWords = {
  resetAll: "Reset all",
  undo: "Undo",
  offer: { reset: (count) => `Reset ${plural(count, "Override")}`, discard: (count) => `Discarded ${plural(count, "held Override")}` },
  theme: { label: "Dark theme", toLight: "Switch to light", toDark: "Switch to dark" },
};

const COPIED = "Copied";
const PASTE_IT = "Paste it into your coding agent";
const QUOTE = { open: " “", close: "”" };

/** Copy Proposal's words (patterns/view.ts `CopyWords`). */
export const COPY_WORDS: CopyWords = {
  idle: "Copy Proposal",
  copied: COPIED,
  failed: "Not copied",
  mainTitle: "Copy the Proposal for your coding agent or an engineer",
  detailsTitle: "Copy with a title and a designer",
  details: "Copy with details",
  title: "Title",
  designer: "Designer",
  optional: "optional",
  designerHint: "Who is asking for this?",
  copyWith: "Copy with these details",
  titleMissing: "Give the Proposal a title: it heads the text your coding agent reads.",
  notCopied: "Couldn’t copy automatically",
  selectAll: "Select all",
  retry: "Try again",
  proposal: "The Proposal",
  pasteIt: PASTE_IT,
  quote: QUOTE,
  // The toast's line and the line under it, as one sentence each.
  copiedText: (title) => `${COPIED}${QUOTE.open}${title}${QUOTE.close}. ${PASTE_IT}.`,
  notCopiedText: (reason, withText) => (withText ? `${reason} Your Proposal is below.` : reason),
};

/** A button that inspects what it names: "Inspect Ana Souza". */
export const inspectText = (what: string) => `Inspect ${what}`;

/** A block on the page map, before what its Instance shows: "Inspect Button 2 of 7, ". */
export const blockLead = (component: string, nth: number, of: number) => `Inspect ${component} ${nth} of ${of}, `;

/** Where the selection can move from a scope: a call site widens to the page, the page narrows back. */
export const scopeMoveVerb = (from: "group" | "page") => (from === "group" ? "Widen to" : "Narrow to");

/** A scope's name without its count, "All in MemberRowMenu"; "Instances" when it has none. */
export const scopeTitle = (label: string | null) => (label ? label.replace(/ · \d+.*$/, "") : "Instances");

/** A scope option's label without what it can't change, which its tooltip keeps: "All on page · 7". */
export const scopeMoveLabel = (label: string) => label.replace(/ \(.*\)$/, "");

/** What a screen reader hears as the selection's scope moves: "Scope: All on page. Reaches 7 of 7.", "Scope: This instance." */
export const scopeSaid = (name: string, reach: string | null) => (reach ? `Scope: ${name}. ${reach}.` : `Scope: ${name}.`);

export const instancesText = (count: number) => plural(count, "Instance");
export const reachCount = (included: number, total: number) => `${included} of ${total}`;

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

/** What a record names in full, its file's path included: two records' short names can be the same. */
export function targetFullLabel(target: ScopeTarget): string {
  switch (target.scope) {
    case "instance":
      return target.id;
    case "group":
      return `All from ${target.anchor}`;
    case "page":
      return targetLabel(target);
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

/** The header's page: its name after the wordmark, the report, and both with the route for its tooltip. */
export function headerView(route: string, changes: number, states: number) {
  const report = headerReport(route, changes, states);
  return { route, page: pageName(route), report, title: `${report} · ${route}` };
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
/** Select multiple's line when there is no group option at all. */
export const ONLY_THIS_INSTANCE = "Only this Instance can be selected here.";

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
/**
 * A row's Reset as a screen reader hears it, the prop it resets after what the button
 * shows, so the rows' Resets tell apart: "Reset variant", "Reset to group value for variant".
 */
export const RESET_NAME: Record<Scope, (prop: string) => string> = {
  instance: (prop) => `Reset ${prop}`,
  group: (prop) => `Reset to group value for ${prop}`,
  page: (prop) => `Reset to page value for ${prop}`,
};

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

