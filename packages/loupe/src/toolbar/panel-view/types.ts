// What `panelView()` takes, and the parts of what it returns that no pattern draws
// (PER-214). Everything a pattern draws is the patterns' contract, `patterns/view.ts`
// (ADR 0012): `panelView()` is the adapter that fits Loupe's runtime to it. Nothing here
// writes; each action comes with what it needs, and the views make the `__loupe` call.

import type { LayerStatus } from "../../layer-status.js";
import type { LoupeDebug } from "../../runtime/debug.js";
import type { NoteKind } from "../../runtime/inspect.js";
import type { Scope } from "../../runtime/store.js";
import type { SelectMode } from "../picker.js";
import type {
  ChangeItem,
  FooterView,
  GroupItem,
  HeldItem,
  IdentityView,
  InspectOnlyView,
  InstanceNoteView,
  MembersView,
  NoGroupView,
  NoticeView,
  PropItem,
  ScopeTarget,
  StatusTag,
  Tag,
  Verdict,
  Write,
} from "../patterns/view.js";

/** Components seen on a route so far, for "Appears on interaction". */
export type SeenComponents = { readonly route: string; readonly components: ReadonlySet<string> };

export type PanelInput = {
  debug: LoupeDebug;
  /** The Product layer's status; null while it can't be read. */
  layer: LayerStatus | null;
  selected: string | null;
  /** The scope the user picked. `PanelView.scope` says which one applies. */
  scope: Scope;
} & (
  | {
      /**
       * The view the last call returned, or null for the first. Its `seen` is the memory
       * this call starts from, and every part of the new view deeply equal to its part
       * is that same object, so a pattern given it can skip its render (`share.ts`).
       */
      previous: PanelView | null;
      seen?: undefined;
    }
  | {
      /** The memory to start from, without a last view to share with. */
      seen: SeenComponents;
      previous?: undefined;
    }
);

/** An Instance a scope reaches, and whether it was left out of it. */
export type Member = { id: string; out: boolean };

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
  header: {
    route: string;
    /** The page's name alone: "Home". */
    page: string;
    report: string;
    /** The page's tooltip after the wordmark: the report and the route, "Home · 2 changes · /". */
    title: string;
  };
  /**
   * The notices over the panel's content: the Product layer's (missing, another format, or
   * sources changed since `generate`), then "Overrides are off" while the React self-check fails.
   */
  notices: NoticeView[];
  /** What the notices say, for the panel's live regions: a missing or other-format layer is an alert, the rest a status. */
  announcements: { alert: string; status: string };
  footer: FooterView & {
    hasOverrides: boolean;
    /** Copy Proposal is on while there is a record. */
    copyEnabled: boolean;
  };
  body: ListBody | InspectorBody | GoneBody;
};

export type ListBody = {
  kind: "list";
  page: { name: string; route: string };
  /** "Not generated yet": the components on this page `generate` hasn't read, and the command that would. */
  notGenerated: NoticeView | null;
  /** The records Suspended for review: "Held for review", with what each holds. */
  suspended: HeldItem[];
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

/** A State prop an Instance Override holds: a state shown in the Proposal, not a numbered change. */
export type StateItem = {
  /** "open held at true". */
  detail: string;
  /** The Instance's name, or its label when it shows none. */
  where: string;
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
  note: (InstanceNoteView & { kind: NoteKind | "no-editable" }) | null;
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

/** What the strip under the header answers to: the view's own state, which panel-view never reads. */
export type StripState = { picking: boolean; mode: SelectMode; covered: boolean; marksHidden: boolean };

export type ScopeOption = { scope: Scope; label: string; enabled: boolean; pressed: boolean; title: string | null };
