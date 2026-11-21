// What `panelView()` takes and returns (PER-214): everything the panel shows, as
// typed data with its words, so the views only render. Nothing here writes; each
// action comes with what it needs, and the views make the `__loupe` call.

import type { LayerStatus } from "../../layer-status.js";
import type { OptionValue } from "../../meta/types.js";
import type { LoupeDebug } from "../../runtime/debug.js";
import type { NoteKind } from "../../runtime/inspect.js";
import type { Scope, ScopeTarget } from "../../runtime/store.js";

/** Components seen on a route so far, for "Appears on interaction". */
export type SeenComponents = { readonly route: string; readonly components: ReadonlySet<string> };

export type PanelInput = {
  debug: LoupeDebug;
  /** The Product layer's status; null while it can't be read. */
  layer: LayerStatus | null;
  selected: string | null;
  /** The scope the user picked. `PanelView.scope` says which one applies. */
  scope: Scope;
  /** The memory the last call returned. */
  seen: SeenComponents;
};

/** An Instance a scope reaches, and whether it was left out of it. */
export type Member = { id: string; out: boolean };

/** What a write needs: `__loupe.set(id, prop, value, scope)` or `__loupe.reset(id, prop, scope)`. */
export type Write = { id: string; prop: string; scope: Scope };

/** Why an Instance or a component is inspect only, closest to Supported last. */
export type InspectOnlyReason = "not-mounted" | "not-generated" | "server" | "overrides-off" | "no-adapter" | "no-editable";

export type StatusTag = { kind: "supported" | "inspect-only" | "not-generated"; text: string };

/** Supported, or Inspect only with one reason, for an Instance or a component. */
export type Verdict =
  | { supported: true; status: StatusTag }
  /** `status` is null for a component with no Instance mounted: the list shows it no tag. */
  | { supported: false; reason: InspectOnlyReason; reasonText: string; status: StatusTag | null };

/** A tag a view styles by kind and shows by its text. */
export type Tag = {
  kind: "server" | "suspended" | "not-mounted" | "stale" | "left-out" | "left-out-unmounted";
  text: string;
};

export type PanelView = {
  /** The scope that applies: the one picked while the Instance has it, else This instance. */
  scope: Scope;
  /** The memory to pass in next time. */
  seen: SeenComponents;
  /** The anchor to load `meta/` for: the selected Instance's, when no Adapter carries its metadata. */
  metaAnchor: string | null;
  /** What the page outline needs: the selection's name, and at a group or page scope the Instances it reaches. */
  outline: { label: string | null; members: Member[] | null };
  /** Every mounted Instance on the page. */
  instanceCount: number;
  /** The plot key: per mounted Instance a numbered change reaches, its numbers. */
  marks: { id: string; keys: number[]; stamp: string }[];
  /** The report line names the page and counts its changes. */
  header: { route: string; report: string };
  /** "Overrides are off" across the panel, while the React self-check fails. */
  banner: { title: string; body: string } | null;
  footer: {
    countText: string;
    hasOverrides: boolean;
    /** Copy Proposal is on while there is a record. */
    copyEnabled: boolean;
    /** Every record "Reset all" discards; empty while it is off. */
    resetAll: ScopeTarget[];
    /** The plot key's numbered changes, in every state of the panel. */
    keys: ChangeItem[];
    /** The State props held open: dashed deltas after the numbered ones. */
    states: StateItem[];
  };
  body: ListBody | InspectorBody | GoneBody;
};

export type ListBody = {
  kind: "list";
  page: { name: string; route: string };
  notGenerated: { names: string[]; command: string } | null;
  /** The records Suspended for review: "Held for review", with what each holds. */
  suspended: { target: ScopeTarget; label: string; why: string; values: string[] }[];
  /** "2 · apply to nothing". */
  suspendedMeta: string;
  /** "9 components · 43 Instances". */
  summary: string;
  /** Every numbered change, as the Proposal will list it: the page's key. */
  changes: ChangeItem[];
  groups: GroupItem[];
  /** Components seen on this page with no Instance mounted now. */
  interaction: string[];
};

export type GroupItem = {
  component: string;
  /** "×4". */
  count: string;
  verdict: Verdict;
  /** The tag's tooltip: the command for "Not generated yet", the reason for "Inspect only". */
  statusTitle: string | null;
  notes: { kind: "overrides" | "stale" | "not-mounted" | "reason"; text: string }[];
  /** The mounted Instances, outlined while the row is hovered. */
  outlineIds: string[];
  instances: InstanceItem[];
};

/** A State prop an Instance Override holds: a state shown in the Proposal, marked with a dashed delta, no number. */
export type StateItem = {
  /** "open held at true". */
  detail: string;
  /** The Instance's name, or its label when it shows none. */
  where: string;
  /** The Instance, while it is mounted. */
  select: string | null;
  reached: string[];
};

/** One numbered change: "1 · variant · Actions for Ana Souza". */
export type ChangeItem = {
  n: number;
  /** The props it changes: "variant, size". */
  props: string;
  /** Each prop from the app's value to the Override's: 'variant "ghost" → "outline"'. */
  detail: string;
  /** What it reaches: an Instance's name, or its scope's. */
  where: string;
  /** The mounted Instance its row selects: the Instance, or the first one its scope reaches. */
  select: string | null;
  /** Every mounted Instance it reaches, outlined on the page while its row is pointed at. */
  reached: string[];
};

export type InstanceItem = {
  id: string;
  /** "members.tsx:11#bia". */
  label: string;
  /** What it is called on screen; null when unmounted or it shows no name. */
  name: string | null;
  /** The numbered changes that reach it. */
  keys: number[];
  /** False for an Instance that holds an Override but isn't mounted: nothing to outline. */
  mounted: boolean;
  tags: Tag[];
  /** A held record's values, each beside its last-seen Current value. */
  values: string[];
};

/** "Not on the page now": the selected Instance has gone. */
export type GoneBody = {
  kind: "gone";
  id: string;
  held: { tag: Tag; values: string[] } | null;
  /** Whether it still holds an Override that "Reset this Instance" can drop. */
  canReset: boolean;
};

export type InspectorBody = {
  kind: "inspector";
  id: string;
  component: string;
  /** What it is called on screen; null when it shows no name. */
  name: string | null;
  /** The component and its call site's file and line: "Button · member-row-menu.tsx:37". */
  where: string;
  /** The numbered changes that reach it. */
  keys: number[];
  /** "Hold open": a State prop with a true/false choice, held at true from one button. */
  hold: { prop: string; held: boolean; write: Write } | null;
  verdict: Verdict;
  tags: Tag[];
  /** The scopes acting on it, and the ones it was left out of. */
  chips: string[];
  /** The adapted Instances around it, nearest first. */
  crumbs: { id: string; label: string }[];
  /** Null while nothing here can be edited: on the server, with no Adapter, or with Overrides off. */
  editing: { resetInstanceEnabled: boolean; scopes: ScopeOption[] | null } | null;
  members: MembersView | null;
  note: { kind: NoteKind; title: string; body: string } | null;
  coverage: {
    editable: number;
    inspectOnly: number;
    text: string;
    callSite: { text: string; title: string } | null;
    /** Its call site's place, or why there is none. */
    noCallSite: string;
    /** One bar segment per prop up to a dozen; past that, two proportional ones. */
    segmented: boolean;
    /** When `generate` hasn't read this component yet: the tag, and the command that would. */
    notGenerated: { tag: StatusTag; command: string } | null;
  };
  editable: PropItem[];
  inspectOnly: PropItem[];
  /** "Overrides off" beside the Inspect only heading. */
  inspectOnlyMeta: string | null;
  injected: { summary: string; rows: { name: string; value: string }[] } | null;
};

export type ScopeOption = { scope: Scope; label: string; enabled: boolean; pressed: boolean; title: string | null };

export type MembersView = {
  scope: "group" | "page";
  /** "3 of 4 previewed". */
  countText: string;
  /** The scope's record is Suspended: shown, never changed. */
  suspended: boolean;
  members: MemberItem[];
  /** At page scope, the members by call site, each with one box for the whole site. */
  sites: SiteItem[] | null;
  server: { id: string; tag: Tag }[];
  outUnmounted: { id: string; tag: Tag }[];
  reset: { target: ScopeTarget; enabled: boolean };
};

export type MemberItem = {
  id: string;
  label: string;
  /** What it is called on screen. */
  name: string | null;
  out: boolean;
  tag: Tag | null;
  toggle: "include" | "exclude";
};

export type SiteItem = {
  anchor: string;
  label: string;
  count: number;
  allIn: boolean;
  members: MemberItem[];
  /** What the site's box does: every member whose state differs goes the same way. */
  toggle: { action: "include" | "exclude"; ids: string[] };
};

/** The app's value as a row shows it: written, the metadata's default, or not set. */
export type ValueText = { kind: "set" | "default" | "unset"; text: string };

export type PropItem = {
  name: string;
  /** `Text` for label text, otherwise the prop's name. */
  label: string;
  /** The prop's own name after a label that isn't it: `children` after `Text`. */
  codeName: string | null;
  /** The Override dot, on an Editable row only. */
  dot: "on" | "off" | null;
  overridden: boolean;
  state: boolean;
  /** Label text held at "". */
  empty: boolean;
  /** At This instance, the app's value on the row's line, unless an Override replaces it there. */
  value: ValueText | null;
  /** At a group or page scope, how the members' values differ: "SAME ON ALL 4". */
  counts: string | null;
  reason: string | null;
  /** What the reason means, for its tooltip. */
  reasonTitle: string | null;
  explanation: string | null;
  /** The number of the change whose value this row shows; null when the app's value shows. */
  key: number | null;
  /** While an Override's value shows: the app's value and the Override's, read as from → to. */
  change: { from: string; to: string } | null;
  /** "from All in Members". */
  source: string | null;
  control: Control | null;
  /** "Current:" with the app's own value, under a row an Override holds. */
  current: ValueText | null;
  /** A State prop the app tried to change while an Override holds it: the notice's sentence around the two values. */
  held: { before: string; value: string; middle: string; tried: string; after: string } | null;
  /** `inNotice`: Reset sits in the held notice, not on the row's line. */
  reset: { label: string; write: Write; inNotice: boolean } | null;
  /** The members a narrower scope keeps at their own value; `select` is the one the note selects. */
  keeping: { text: string; ids: string[]; select: string } | null;
};

export type Control =
  /** `key` resets the control when it changes: another Instance, or another scope. */
  | { kind: "options"; key: string; write: Write; options: { value: OptionValue; label: string; pressed: boolean; count: number | null }[] }
  | { kind: "text"; key: string; write: Write; value: string }
  /** A prop this scope can't change: `refusal` says which rule, `text` says it. */
  | { kind: "refused"; refusal: "state-only" | "per-call-site"; text: string };
