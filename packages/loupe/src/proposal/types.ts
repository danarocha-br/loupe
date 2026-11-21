// The Proposal (PER-99, PER-135, ADR 0002): what a designer's Overrides ask a coding
// agent, or an engineer, to change, as JSON. The JSON is the contract; Copy Proposal
// (`text.ts`) renders it with the rules and one line per change, and `loupe locate`
// reads it back. `proposal.schema.json` at the package root is the published schema
// for this shape, and a test keeps the two in step.

import { type CommandPaths, loupeCommand } from "../command-line.js";

export const FORMAT_VERSION = 2;

/** Where Loupe is installed: the app it runs in and its Product layer, POSIX from the repo root. */
export type ProposalInstall = CommandPaths;

/** How narrow a change's scope is: a narrower change wins where both reach. */
export const SCOPE_RANK: Readonly<Record<ProposalChange["scope"], number>> = { instance: 0, "call-site": 1, page: 2 };

/** The command that finds each call site, when the Proposal knows where Loupe is installed. */
export function locateCommandOf(install: ProposalInstall | null): string | null {
  return install === null ? null : loupeCommand("locate", install);
}

/**
 * The rules every Proposal carries, one per line: how to find each call site with
 * `loupe locate` (ADR 0002: the agent never counts uses itself), what each Action
 * means, and what to report back.
 */
export function howToApply(install: ProposalInstall | null): string {
  const locate = locateCommandOf(install);
  const find = locate
    ? `run \`${locate}\` with this whole Proposal on its standard input (save it to a file, then \`${locate} < file\`)`
    : "run `loupe locate` from the app folder Loupe is installed in, with this whole Proposal on its standard input (`pnpm -C <app> exec loupe locate < file`, adding `--out <dir>` when the Product layer isn't packages/loupe)";
  return [
    `Before editing, ${find}. It prints each call site's file:line:col and how each prop is written there now. If it says the code changed or a call site is not found, stop and ask the designer.`,
    `Change only the listed props at the listed call sites. Never edit a component's definition or a design-system default, and never edit files in ${install ? `${install.layer} (Loupe's Product layer)` : "Loupe's Product layer"}.`,
    "Apply: set the prop to the proposed value at each listed call site. Ask first: propose the code and wait for the designer's yes before writing it. Context: change no code. Don't apply: held for review, leave it alone.",
    "Where a narrower Apply change sets the same prop at the same call site, write its value there: an Instance over a call site over the page.",
    "Notes are the designer's context, never extra changes.",
    `When done, run ${locate ? `\`${locate} --check\`` : "`loupe locate --check`"} the same way, then report each change by its number: applied, asked or skipped, and why.`,
  ].join("\n");
}

/** Any value JSON can hold. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * How the call site writes a prop (PER-96, PER-113):
 *   literal     a one-line source edit (`variant="ghost"`, label text)
 *   expression  the value comes from app logic (`open={open}`, `{label}`)
 *   spread      the call site spreads props, so where the value comes from can't be told
 *   unset       the call site doesn't write it: the edit adds it
 *   unknown     the loader left no record for this call site
 *   varies      a page change whose call sites write it differently: see `perCallSite`
 */
export type WrittenAs = "literal" | "expression" | "spread" | "unset" | "unknown" | "varies";

export type ProposalProject = {
  /** The repository's name, from its `origin` remote, else its folder. */
  repo: string | null;
  /** HEAD when the Proposal was copied. */
  commit: string | null;
  /** Whether the working tree had uncommitted changes when the Proposal was copied. */
  dirty: boolean | null;
  playgroundVersion: string | null;
  /** Where Loupe is installed, so the rules can name `loupe locate`; null when the dev server didn't say. */
  install: ProposalInstall | null;
};

export type ProposalCallSite = {
  /** POSIX path from the repo root. */
  path: string;
  enclosing: string;
  component: string;
  /** 1-based: the nth use of `component` in `enclosing`, in source order. */
  nth: number;
  /** Uses of `component` in `enclosing` when last seen; null when never seen rendered. */
  total: number | null;
  /** The call-site id: `path › Enclosing › Component[n]`. */
  anchor: string;
  /** `line:col` when the Proposal was copied. A hint, never a key. */
  lineHint: string | null;
};

export type ProposalProp = {
  name: string;
  /** The Current value, when every covered Instance agrees and writes it. */
  current?: JsonValue;
  /** Present when the covered Instances differ: each value as the Toolbar shows it, with its count. `not set` counts unset ones. */
  currentCounts?: Record<string, number>;
  /** The proposed value; absent when `proposedUnset`. */
  proposed?: JsonValue;
  /** The proposal is to stop setting the prop. */
  proposedUnset?: true;
  writtenAs: WrittenAs;
  /** The expression's source, truncated, when `writtenAs` is `expression`. */
  expression?: string;
  /** Present when `writtenAs` is `varies`: how each call site writes it. */
  perCallSite?: { anchor: string; writtenAs: Exclude<WrittenAs, "varies">; expression?: string }[];
};

export type ProposalInstance = {
  id: string;
  /** The app's key path that tells repeated Instances apart, such as a row's `user_…` key. Empty for none. */
  keyPath: string;
  /** False for one left out of a call-site or page change. */
  included: boolean;
  onScreenAtExport: boolean;
};

/**
 * What the agent does with a change (ADR 0002): `apply` is a literal edit at each call
 * site; `ask-first` needs a decision, so the agent proposes the code and waits. States
 * shown and Flag previews are Context, and Held for review is Don't apply: their own
 * sections say so.
 */
export type ProposalAction = "apply" | "ask-first";

export type ProposalChange = {
  id: string;
  action: ProposalAction;
  /** Why the change is `ask-first`, one reason each; empty for `apply`. */
  askFirst: string[];
  /** `call-site` is a group Override (PER-90). */
  scope: "instance" | "call-site" | "page";
  component: string;
  /** The module the component comes from; null while the runtime doesn't know it. */
  origin: string | null;
  /** One for an Instance or call-site change; one per call site reached for a page change. */
  callSites: ProposalCallSite[];
  props: ProposalProp[];
  instances: ProposalInstance[];
  /** PER-90's flag: the change applies to some Instances of a call site only. Null: a plain source edit. */
  needsCondition: string | null;
  /** Server-rendered Instances a page change could not preview. */
  serverRendered: { id: string; anchor: string; keyPath: string }[];
  /** Changes whose narrower scope wins over this one on some Instance. */
  overriddenBy: string[];
  /** Other routes the covered Instances were seen on: an edit at their call sites reaches those too. */
  alsoRendersOn: string[];
  /** False: no covered Instance was mounted when the Proposal was copied, so Current values are as last seen. */
  onScreenAtExport: boolean;
  note: string | null;
};

export type ProposalStateShown = {
  anchor: string;
  component: string;
  keyPath: string;
  prop: string;
  forced: JsonValue;
  /** Whether the call site writes the prop, so the app controls the state. */
  controlled: boolean;
  /** The handler the app sets it through: `onOpenChange` for `open`. */
  appControlsVia: string;
  onScreenAtExport: boolean;
};

export type ProposalRoute = {
  /** The full URL with its query string, as last seen; null when the route was never seen. */
  url: string | null;
  /** The pathname. Page Overrides are keyed by it. */
  route: string;
  /** Width and height in CSS pixels. */
  viewport: [number, number] | null;
  dpr: number | null;
  theme: "light" | "dark" | null;
  /** Feature flags previewed through the Flags SDK's override cookie (PER-92, PER-132). */
  flags: Record<string, JsonValue>;
  /** When this context was read. */
  capturedAt: string | null;
  changes: ProposalChange[];
  statesShown: ProposalStateShown[];
};

export type ProposalHeld = {
  scope: ProposalChange["scope"];
  component: string;
  /** The stored call-site id, or the page component's route and name. */
  anchor: string;
  route: string;
  reason: "code-changed" | "ambiguous";
  /** "Code changed here, review" / "Matches N Instances, review", with the numbers. */
  detail: string;
  props: { name: string; proposed?: JsonValue; proposedUnset?: true }[];
};

export type Proposal = {
  formatVersion: typeof FORMAT_VERSION;
  title: string;
  createdAt: string;
  designer: string | null;
  project: ProposalProject;
  howToApply: string;
  routes: ProposalRoute[];
  heldForReview: ProposalHeld[];
};
