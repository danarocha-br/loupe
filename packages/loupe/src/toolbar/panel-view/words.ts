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
    text: () => "Rendered on the server: it can't be previewed in the MVP.",
  },
  // The panel's banner says this instead (PER-184), so it reaches a card only while
  // the page and the inspection disagree about the status, for a frame.
  "overrides-off": {
    title: "Overrides are off",
    text: (status) =>
      `Overrides are off, everything is inspect-only: this React build isn't supported${inParentheses(status.overrides ? undefined : status.reason)}.`,
  },
  unadapted: {
    title: "Inspect only · No Adapter",
    text: () =>
      "No Adapter renders this Instance, so it is inspect-only: `loupe generate` writes Adapters only for components with a prop that can be Editable, and imports inside the design system are never swapped for one.",
  },
  spreads: {
    title: "Props spread here",
    text: () => "This call site spreads props, so library props can't be separated from the app's here.",
  },
  "no-meta": {
    title: "No prop metadata",
    text: () => "No prop metadata for this component: run `loupe generate` to see which props are editable.",
  },
};

export const OVERRIDES_OFF_TITLE = "Overrides are off";

/** The Overrides-off banner's sentence, under its title. */
export function overridesOffBanner(reason: string): string {
  return `Everything is inspect-only: this React build isn't supported${inParentheses(reason)}.`;
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
  "no-editable": "No props with fixed options",
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
} as const satisfies Record<string, Tag>;

/** An Instance's record that isn't mounted: held for review when Suspended, otherwise just not mounted. */
export const unmountedTag = (suspended: boolean): Tag => (suspended ? TAGS.suspended : TAGS.notMounted);

/** Sentences the panel shows whatever is on the page. */
export const TEXT = {
  nothingSelected: "Nothing selected. Pick a component below or click one on the page.",
  seenNotMounted: "Seen on this page, not mounted now: open its menu or dialog to inspect it.",
  notOnPage: "Not on the page now",
  showsWhenMounted: "It shows here again when it mounts, for example when its menu or dialog opens.",
  untick: "Untick one to leave it out: it keeps its own value.",
  current: "Current:",
  state: "STATE",
  empty: "empty",
  none: "None",
  run: "Run",
  toReadProps: "to read its props.",
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
export const overridesNote = (count: number) => plural(count, "override");
export const notMountedNote = (count: number) => `${count} not mounted`;

/** The call site's file and line, then the key path that tells repeated Instances apart. */
export function instanceLabel(id: string, hint: string | null): string {
  const site = parseHint(hint);
  const where = site ? `${site.path.split("/").at(-1)}:${site.line}` : id;
  return `${where}${callSiteLabels(id).key}`;
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

export function footerCount(count: number): string {
  return `${plural(count, "Override")} on this page`;
}

// ── The Inspector ───────────────────────────────────────────────────────────

export function coverageText(editable: number, inspectOnly: number): string {
  return `${plural(editable, "editable prop")} · ${inspectOnly} inspect only`;
}

export function callSiteText(site: { path: string; line: number; column: number; ordinal: number; total: number }, anchor: string) {
  return {
    text: `${site.path.split("/").at(-1)}:${site.line} · use ${site.ordinal} of ${site.total}`,
    title: `${site.path}:${site.line}:${site.column}\n${anchor}`,
  };
}

export const NO_CALL_SITE = "No call site was anchored here.";
export const injectedSummary = (count: number) => `${count} set by the library`;
export const INSPECT_ONLY_OVERRIDES_OFF = "Overrides off";

export const NO_GROUP = { label: "No call site group", title: "No call site was anchored here, so it has no group." };

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
export const previewedText = (included: number, total: number) => `${included} of ${total} previewed`;
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

export const sameOnAll = (count: number) => `SAME ON ALL ${count}`;
export const countsText = (counts: Map<string, number>) => [...counts].map(([key, count]) => `${key} ${count}`).join(" · ");

export function keepingText(keeping: number, inScope: number): string {
  return `${keeping} of ${inScope} ${keeping === 1 ? "keeps its own value" : "keep their own values"}`;
}

/** The held notice around its two values: "Your Override holds this at true; the app tried to set false." */
export function heldNotice(value: unknown, tried: unknown) {
  return {
    before: "Your Override holds this at",
    value: formatCurrent(value),
    middle: "; the app tried to set",
    tried: formatCurrent(tried),
    after: ".",
  };
}
