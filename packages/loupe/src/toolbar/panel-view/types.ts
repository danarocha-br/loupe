// What `panelView()` takes and returns (PER-214): everything the panel shows, as
// typed data with its words, so the views only render. Nothing here writes; each
// action comes with what it needs, and the views make the `__loupe` call.

import type { LayerStatus } from "../../layer-status.js";
import type { OptionValue } from "../../meta/types.js";
import type { LoupeDebug } from "../../runtime/debug.js";
import type { NoteKind } from "../../runtime/inspect.js";
import type { Scope, ScopeTarget } from "../../runtime/store.js";
import type { FlagValue } from "../flags-preview.js";
import type { SelectMode } from "../picker.js";

// The runtime's scope words, the select tools' modes and a flag's value, as the panel's data speaks them: a pattern takes them from here.
export type { FlagValue, Scope, ScopeTarget, SelectMode };

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

/** A status in words: a verdict, or a plain one ("Not on the page now") when it has no kind. */
export type StatusText = { kind?: StatusTag["kind"]; text: string };

/** Supported, or Inspect only with one reason, for an Instance or a component. */
export type Verdict =
  | { supported: true; status: StatusTag }
  /** `status` is null for a component with no Instance mounted: the list shows it no tag. */
  | { supported: false; reason: InspectOnlyReason; reasonText: string; status: StatusTag | null };

/** A tag a view styles by kind and shows by its text. */
export type Tag = {
  kind: "server" | "suspended" | "not-mounted" | "stale" | "left-out" | "left-out-unmounted" | "not-visible";
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
  header: { route: string; /** The page's name alone: "Home". */ page: string; report: string };
  /**
   * The notices over the panel's content: the Product layer's (missing, another format, or
   * sources changed since `generate`), then "Overrides are off" while the React self-check fails.
   */
  notices: NoticeView[];
  /** What the notices say, for the panel's live regions: a missing or other-format layer is an alert, the rest a status. */
  announcements: { alert: string; status: string };
  footer: {
    countText: string;
    hasOverrides: boolean;
    /** Copy Proposal is on while there is a record. */
    copyEnabled: boolean;
    /** Every record "Reset all" discards; empty while it is off. */
    resetAll: ScopeTarget[];
    /** The numbered changes: the big number, and its word, "change" or "changes". */
    changes: { count: number; word: string };
    /** The State props held open, which the Proposal shows as states: the chip's words, and each one for its tooltip. */
    states: { chip: string | null; title: string };
  };
  body: ListBody | InspectorBody | GoneBody;
};

export type ListBody = {
  kind: "list";
  page: { name: string; route: string };
  /** "Not generated yet": the components on this page `generate` hasn't read, and the command that would. */
  notGenerated: NoticeView | null;
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
  /** Its mounted Instances. */
  mountedCount: number;
  /** Its bar: its count over the most used component's, 0 to 1. */
  share: number;
  /** No Override can reach it: drawn with the eye, its reason in the row's tooltip. */
  inspectOnly: boolean;
  /** "3 call sites · pick one to inspect". */
  sitesText: string;
  /** Its mounted Instances by call site, each a card to pick one from. */
  sites: CallSiteItem[];
  verdict: Verdict;
  /** The tag's tooltip: the command for "Not generated yet", the reason for "Inspect only". */
  statusTitle: string | null;
  notes: { kind: "overrides" | "stale" | "not-mounted"; text: string }[];
  /** The mounted Instances, outlined while the row is hovered. */
  outlineIds: string[];
  instances: InstanceItem[];
  /** Its hue, one of the map's, by its place in the list: the row's bar and dots, and its blocks on the map. */
  hue: number;
  /** Its blocks' tooltip on the page map: "Button ×7". */
  mapTitle: string;
};

/** A call site of a component on the page: where it is written, and what its Instances show. */
export type CallSiteItem = {
  anchor: string;
  /** Its file and line: "member-row-menu.tsx:37". */
  label: string;
  /** What its Instances show, the first two by name: "Ana Souza, Bruno Lima +2". */
  names: string;
  ids: string[];
  /** The card's name for a screen reader: "Inspect member-row-menu.tsx:37: Ana Souza, Bruno Lima +2". */
  inspect: string;
  /** Each Instance, a dot on the card: its tooltip, and its name for a screen reader ("Inspect Ana Souza"). */
  instances: { id: string; label: string; inspect: string }[];
  /** The Instance its card selects: the first. */
  select: string;
  /** False when no Override can reach its Instances: drawn with the inspect-only eye. */
  supported: boolean;
};

/** A State prop an Instance Override holds: a state shown in the Proposal, not a numbered change. */
export type StateItem = {
  /** "open held at true". */
  detail: string;
  /** The Instance's name, or its label when it shows none. */
  where: string;
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
  /**
   * Its block on the page map, named for a screen reader: Loupe's words ("Inspect Button 2 of 7, "),
   * then `who`, what it shows on screen (`own`: the app's words) or its call site. Null while it isn't mounted.
   */
  block: { lead: string; who: string; own: boolean } | null;
};

/** "Not on the page now": the selected Instance has gone. */
export type GoneBody = {
  kind: "gone";
  id: string;
  /** Whether it still holds an Override that "Reset this Instance" can drop. */
  canReset: boolean;
  /** What the identity block says of it: "Not on the page now", where it was written, what it still holds. */
  identity: IdentityView;
};

export type InspectorBody = {
  kind: "inspector";
  id: string;
  component: string;
  /** What it is called on screen; null when it shows no name. */
  name: string | null;
  /** The component and its call site's file and line: "Button · member-row-menu.tsx:37". */
  where: string;
  /** Where it is written, set apart where the line starts: "member-row-menu.tsx" and ":37 · use 1 of 2"; its full path and key, for the tooltip. */
  source: { file: string; line: string; title: string };
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
  editing: { resetInstanceEnabled: boolean; scopes: ScopeOption[] | null; noGroup: NoGroupView | null } | null;
  members: MembersView | null;
  /** Why nothing here can change, said once; `no-editable` is the Toolbar's own, for an adapted Instance with no Editable prop. */
  note: { kind: NoteKind | "no-editable"; title: string; body: string } | null;
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
  /** The fold of the props it shows but can't change here, as Inspect only draws it. */
  inspectFold: InspectOnlyView;
  /**
   * What a chip's marks mean, said under the option rows when one of them marks a default;
   * `app` when a chip rings the app's value. Null otherwise.
   */
  legend: { app: boolean } | null;
  /** What the identity block at the card's top says of it. */
  identity: IdentityView;
};

/**
 * The identity block at the top of the Inspector's card, and of "Not on the page now"
 * (DESIGN.md "Identity"): what is selected, where it is written, and only the exceptions.
 */
export type IdentityView = {
  /** The component, muted after Back; null when the headline is the component already. */
  component: string | null;
  /** The page, "Billing", after the component; none once the Instance is gone. */
  page: string | null;
  /** Its verdict ("Supported"), or a plain status ("Not on the page now"). */
  status: StatusText | null;
  /** The numbered changes that reach it. */
  keys: number[];
  /** The headline: its visible name in full, else its component. */
  name: string;
  /** The headline's tooltip. */
  nameTitle: string;
  /** The headline is the app's own words, in whatever script it writes: the view gives it the app's language. */
  ownName: boolean;
  /** Where it is written: a file and its line, set apart; or one line of words. */
  where: { file: string; line: string } | string | null;
  /** The full path and key, on hover. */
  whereTitle: string;
  /** Its id, on the where line, for the view's own queries; null once it is gone. */
  id: string | null;
  /** What it says once it is gone. */
  note: string | null;
  tags: Tag[];
  /** The scopes acting on it, and the ones it was left out of; none while the scope's own section names them. */
  chips: string[];
  /** What a gone Instance still holds. */
  held: string[] | null;
  /** Its component isn't generated yet: the tag, and the command that would read it. */
  notGenerated: { tag: StatusTag; command: string } | null;
  /** The adapted Instances around it, nearest first. */
  crumbs: { id: string; label: string }[];
};

/**
 * Inspect only (DESIGN.md "Inspect only"): the props an Instance shows but can't change
 * here, folded to one row. One cause for them all is said once, under the row.
 */
export type InspectOnlyView = {
  /** "Inspect only · 6". */
  title: string;
  /** Its props by name, said after the title while it is folded: " · children, className". Null when it has none. */
  names: string | null;
  /** "Overrides off", at the row's right. */
  meta: string | null;
  /** Open as it first draws: nothing else on the Instance can change. */
  open: boolean;
  /** The one reason every prop shares, said once under the row; its rows then carry none. */
  shared: { reason: string; title: string | null } | null;
  rows: PropItem[];
  /** Said in place of the rows when it has none. */
  empty: string;
  /** The props the library sets, folded under the rest: "2 set by the library". */
  injected: { summary: string; rows: { name: string; value: string }[] } | null;
};

/**
 * A notice card (DESIGN.md "Notices and status"): something about the page or the panel
 * the reader should know before they change anything, and the command that fixes it.
 */
export type NoticeView = {
  /** Which notice; its look follows its `tone`. */
  kind: "overrides-off" | "missing" | "format" | "stale" | "not-generated";
  /** Red for what stops Loupe working, amber for what may be out of date. */
  tone: "alert" | "amber";
  title: string;
  /** What counts it at the head's right: "2 components", "Format 0 ≠ 1". */
  meta: string | null;
  body: string;
  /** A line each: the components, and for a changed module its file at the right, its changed files in the tooltip. */
  rows: { text: string; value: string | null; valueTitle: string | null }[];
  /** The command that would fix it: Loupe names it and never runs it. */
  command: string | null;
};

/** A command's Copy button and what it says (DESIGN.md "Notices and status"). */
export type CommandWords = {
  /** Before the command, for the eye only. */
  prompt: string;
  copy: string;
  copied: string;
  failed: string;
  /** Said under the command, and by the announcer, when the clipboard refuses it. */
  refused: string;
};

/**
 * The words the list's patterns draw whatever is on the page (DESIGN.md "Start", "On this
 * page"): decided here, so a pattern builds none.
 */
export type ListWords = {
  /** The guided start: its question, the line under it, and the name of its two tiles' group. */
  start: { title: string; body: string; tools: string };
  /** Each select tool: its name, what it does in a few words, and its tooltip. */
  tools: Record<SelectMode, { label: string; hint: string; title: string }>;
  /** "On this page": its title, its rows' list, and the page map's toolbar. */
  onPage: { title: string; rows: string; map: string };
  /** "Held for review": its title, and the button that drops a held record. */
  held: { title: string; discard: string };
  /** "Appears on interaction": its title, what it counts, and what each row says under its name. */
  interaction: { title: string; meta: string; seen: string };
  /** The change list: its title, and what it says of its numbers. */
  changes: { title: string; meta: string };
  /** A change's delta: "Change 1", and its tooltip, as the Inspector says it. */
  change: InspectorWords["change"];
};

/** Select multiple on an Instance with no call site to group by: why, and the way to the page when that scope applies. */
export type NoGroupView = { text: string; widen: ScopeMove | null };

/** A button that moves the selection to another scope: what it says, and what it can't change, for its tooltip. */
export type ScopeMove = { scope: Scope; text: string; title: string };

/**
 * The words the Inspector's patterns draw whatever is on the page (DESIGN.md "Layers"):
 * decided here, so a pattern builds none.
 */
export type InspectorWords = {
  /** A change's delta: "Change 1", and its tooltip. */
  change(n: number): { label: string; title: string };
  /** A held State prop's empty delta: its tooltip. */
  heldTitle: string;
  /** Label text left empty. */
  empty: string;
  /** The tag on a State prop's row. */
  state: string;
  /** Before the app's own value under an Override. */
  current: string;
  /** A value that is the component's default, for its tooltip. */
  defaultTitle: string;
  /** The tag on the app's own value's chip, once an Override replaces it. */
  appTag: string;
  /** A chip's marks, said to a screen reader and in its tooltip. */
  appValue: string;
  designDefault: string;
  /** The identity's back button. */
  back: { label: string; title: string };
  /** Before the adapted Instances around it. */
  inside: string;
  /** "Run `loupe generate` from the repo root to read its props." */
  run: string;
  fromRootToReadProps: string;
  /** The scope's Instances, opened. */
  untick: string;
  picked: string;
  resetScope: string;
  serverRendered: string;
  leftOutUnmounted: string;
  /** What a chip's marks mean, said once under the options. */
  legend: { shown: string; app: string; default: string };
};

export type ScopeOption = { scope: Scope; label: string; enabled: boolean; pressed: boolean; title: string | null };

export type MembersView = {
  scope: "group" | "page";
  /** The scope's name, "All in MemberRowMenu", and what it can't change, for its tooltip. */
  name: string;
  nameTitle: string | null;
  /** "4 Instances": the fold's trigger. */
  instancesText: string;
  /** Widen a call site to the page, or narrow the page back to it: "Widen to All on page · 7". */
  widen: ScopeMove | null;
  /** "3 of 4 previewed". */
  countText: string;
  /** How far the scope reaches: "Reaches", its members in and in all, the component's on the page, and the rest said. */
  reach: { lead: string; included: number; total: number; page: number; moreText: string | null; countText: string };
  /** The scope's record is Suspended: shown, never changed. */
  suspended: boolean;
  members: MemberItem[];
  /** At page scope, the members by call site, each with one box for the whole site. */
  sites: SiteItem[] | null;
  /** `label`: what it is called on screen, else its call site's file and line. */
  server: { id: string; label: string; tag: Tag }[];
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

/** A prop's glyph on its row, by what the prop does. */
export type PropGlyph = "size" | "variant" | "off" | "focus" | "text" | "state" | "other";

export type PropItem = {
  name: string;
  glyph: PropGlyph;
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
  /** The value comes from a wider scope than the one in view: the change line names `source`. */
  wider: boolean;
  control: Control | null;
  /** "Current:" with the app's own value, under a row an Override holds. */
  current: ValueText | null;
  /** A State prop the app tried to change while an Override holds it: the notice's sentence around the two values. */
  /** `text`: the whole sentence, for the announcer; the rest draws it with its values in `code`. */
  held: { before: string; value: string; middle: string; tried: string; after: string; text: string } | null;
  /** `inNotice`: Reset sits in the held notice, not on the row's line. */
  reset: { label: string; write: Write; inNotice: boolean } | null;
  /** The members a narrower scope keeps at their own value; `select` is the one the note selects. */
  keeping: { text: string; ids: string[]; select: string } | null;
};

export type Control =
  /** `key` resets the control when it changes: another Instance, or another scope. */
  | {
      kind: "options";
      key: string;
      write: Write;
      /** `isDefault`: the design system's default, which the metadata knows; shown with a dot. */
      options: { value: OptionValue; label: string; pressed: boolean; count: number | null; isDefault: boolean }[];
    }
  | { kind: "text"; key: string; write: Write; value: string }
  /** A prop this scope can't change: `refusal` says which rule, `text` says it. */
  | { kind: "refused"; refusal: "state-only" | "per-call-site"; text: string };

/**
 * The Feature flags card (DESIGN.md "Notices and status"), from the flags store: the app's
 * flags, each one's options and whether it is previewed. The card writes nothing: its
 * callbacks ask the store, in the view.
 */
export type FlagsCardView = {
  title: string;
  /** "3 declared · 1 previewing", or "Unavailable". */
  meta: string | null;
  /** Reading the app's flags: what the card says meanwhile. Null once it has read them. */
  loading: string | null;
  /** Previews are off: one line until it is opened, then why, and the one fix made in a file. */
  off: { title: string; why: string; reason: string; fix: { text: string; copy: string } | null } | null;
  /** Ready: said when the app declares no flag. */
  empty: string | null;
  rows: FlagRowView[];
  /** The last write the dev server refused, said under the flags. */
  error: string | null;
  /** How long a preview lasts, and where it is kept. Null until the flags are read. */
  lasts: string | null;
  /** Clears every preview; off while nothing is previewed. Null until the flags are read. */
  clearAll: { label: string; enabled: boolean } | null;
};

/** One flag: its key, what it does, its options as one radio group, and what shows now. */
export type FlagRowView = {
  key: string;
  previewing: boolean;
  description: string | null;
  /** "No options declared: offered as on and off." */
  note: string | null;
  options: { label: string; value: FlagValue }[];
  /** The option previewed, by its place in `options`; null while the app decides. */
  checked: number | null;
  /** "Previewing Pro", "App decides". */
  state: string;
  /** "Clear", while it is previewed. */
  clear: string | null;
};
