// The Proposal (PER-99, PER-135): what a designer's Overrides ask engineering to
// change, as JSON. The JSON is the contract; Copy as Markdown and the HTML report
// (PER-139) are renderers on it. `proposal.schema.json` at the package root is the
// published schema for this shape, and a test keeps the two in step.

export const FORMAT_VERSION = 1;

/** PER-95's locate rule, in the words every Proposal carries. */
export const HOW_TO_APPLY =
  "For each call site: open its path, find the enclosing component, and count the uses of <Component> in source order to the nth. " +
  "If that component now has a different total of uses there, stop and ask: the code changed since the Proposal was made. " +
  "The line hint is where it was at export time, a hint only. " +
  "A change written as an expression comes from app logic, not a one-line edit. " +
  "A change marked as needing a condition applies to some Instances of the call site only. " +
  "Do not apply anything under Held for review.";

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
  /** HEAD at export time. */
  commit: string | null;
  /** Whether the working tree had uncommitted changes at export time. */
  dirty: boolean | null;
  playgroundVersion: string | null;
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
  /** `line:col` at export time. A hint, never a key. */
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

export type ProposalChange = {
  id: string;
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
  /** Other routes the covered Instances were seen on. */
  alsoRendersOn: string[];
  /** False: no covered Instance was mounted at export, so Current values are as last seen. */
  onScreenAtExport: boolean;
  note: string | null;
  /** Snapshot ids (PER-138); empty until Snapshots exist. */
  screenshots: string[];
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

export type ProposalScreenshot = {
  id: string;
  kind: "viewport" | "crop";
  caption: string;
  before: string;
  after: string;
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
  screenshots: ProposalScreenshot[];
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
