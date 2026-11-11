// What the Toolbar's inspector shows for one Instance (PER-84, PER-96, PER-113):
// every prop the component declares plus any other the call site writes, each an
// Editable prop or inspect-only with a reason, and Coverage as the two counts.
// Pure: the rules live here so the Toolbar only draws them.

import type { DefaultValue, InspectReason, OptionValue, PropMeta } from "../meta/types.js";
import type { CallSiteWrites, WrittenAs } from "../writes.js";
import type { Authorship } from "./authored.js";
import type { Props, Source } from "./store.js";

/**
 * Why a row has no control. The metadata's reasons, plus the call site's own for
 * label text (`FROM CODE`, `MIXED`), and `OVERRIDES OFF` while the React self-check fails.
 */
export type RowReason = InspectReason | "FROM CODE" | "MIXED" | "OVERRIDES OFF";

export type PropRow = {
  name: string;
  /** What the row is called: `Text` for label text (PER-113), otherwise the prop's name. */
  label: string;
  /** Whether the call site writes it. Unset rows show `not set`, or their default. */
  set: boolean;
  /** The Current value; meaningful only when `set`. */
  value: unknown;
  /** The default the metadata knows, for an unset row. `unknown`: a library's runtime default. */
  default?: DefaultValue;
  editable: boolean;
  /** Why an inspect-only row is; absent on a server-rendered Instance, whose note says why. */
  reason?: RowReason;
  /** The closed set an Editable prop picks from. */
  options?: readonly OptionValue[];
  /** A State prop (`X` with `onXChange`): Instance scope only (PER-96). */
  state?: true;
  /** How the call site writes it, when its record says. */
  writtenAs?: WrittenAs;
  expression?: string;
  /** Where the rendered value comes from: the app, or an Override's scope. */
  source?: Source;
};

export type CallSite = { path: string; line: number; column: number; ordinal: number; total: number };

export type Inspection = {
  id: string;
  component: string;
  /** Call-site id. */
  anchor: string;
  rendered: "client" | "server";
  /** Parsed from the hint; null when the loader wrote none. */
  callSite: CallSite | null;
  /** Editable rows first, then inspect-only ones. */
  rows: PropRow[];
  /** "N editable props · M inspect only". */
  coverage: { editable: number; inspectOnly: number };
  /** What a library set on the Instance: never a row, never in Coverage (PER-96). */
  injected: Props;
  authorship: Authorship | "server";
  /** One card-level line, when the whole Instance is inspect-only or its rows need a caveat. */
  note: string | null;
};

export type InspectInput = {
  id: string;
  component: string;
  anchor: string;
  hint: string | null;
  rendered: "client" | "server";
  /** The app's own props, live. */
  current: Props;
  injected: Props;
  authorship: Authorship | "server";
  writes: CallSiteWrites | null;
  meta: Readonly<Record<string, PropMeta>> | null;
  stateProps: readonly string[];
  /** False while the React self-check fails: everything is inspect-only. */
  overridesOn: boolean;
  overridesOffReason?: string;
  sources?: Record<string, Source>;
};

export const SERVER_NOTE = "Rendered on the server: it can't be previewed in the MVP.";
export const SPREADS_NOTE = "This call site spreads props, so library props can't be separated from the app's here.";
export const NO_META_NOTE =
  "No prop metadata for this component: run `loupe generate` to see which props are editable.";

export function overridesOffNote(reason: string | undefined): string {
  return `Overrides are off, everything is inspect-only: this React build isn't supported${reason ? ` (${reason})` : ""}.`;
}

/** `path:line:col n/total`. */
export function parseHint(hint: string | null): CallSite | null {
  const match = hint === null ? null : /^(.*):(\d+):(\d+) (\d+)\/(\d+)$/.exec(hint);
  if (!match) return null;
  const [, path, line, column, ordinal, total] = match;
  return { path: path as string, line: +(line as string), column: +(column as string), ordinal: +(ordinal as string), total: +(total as string) };
}

/**
 * The reason for a prop the component doesn't declare, from what the call site
 * passes. An `onX` handler is a function even while the app passes `undefined`.
 */
export function reasonOfValue(value: unknown, name = ""): InspectReason {
  if (typeof value === "function" || (value === undefined && /^on[A-Z]/.test(name))) return "FUNCTION";
  if (isElementLike(value)) return "CONTENT";
  if (typeof value === "string") return "OPEN TEXT";
  if (typeof value === "object" && value !== null) return "OBJECT";
  return "UNVERIFIED";
}

function isElementLike(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isElementLike);
  return typeof value === "object" && value !== null && "$$typeof" in value;
}

/** Label text's row, judged by how this call site writes it (PER-113). */
function childrenRow(meta: PropMeta, writes: CallSiteWrites | null): Pick<PropRow, "editable" | "reason"> {
  if (!meta.editable) return { editable: false, reason: meta.reason };
  if (meta.kind !== "text") return { editable: true };
  switch (writes?.children) {
    case "text":
      return { editable: true };
    case "from-code":
      return { editable: false, reason: "FROM CODE" };
    case "mixed":
      return { editable: false, reason: "MIXED" };
    case "elements":
      return { editable: false, reason: "CONTENT" };
    case "none":
      // Nothing written between the tags: no text to change at this call site.
      return { editable: false, reason: "CONTENT" };
    default:
      // A spread or unrecorded call site: its text can't be told from code.
      return { editable: false, reason: "UNVERIFIED" };
  }
}

export function inspect(input: InspectInput): Inspection {
  const { current, meta, writes } = input;
  const written = new Map((writes?.attributes ?? []).map((attribute) => [attribute.name, attribute]));
  const names = [...Object.keys(meta ?? {})];
  for (const name of Object.keys(current)) if (!names.includes(name)) names.push(name);

  const server = input.rendered === "server";
  const rows: PropRow[] = names.map((name) => {
    const declared = meta?.[name];
    const set = name in current;
    const row: PropRow = { name, label: name === "children" && declared?.editable && declared.kind === "text" ? "Text" : name, set, value: current[name], editable: false };
    if (!set && declared?.default) row.default = declared.default;
    if (declared?.state || input.stateProps.includes(name)) row.state = true;
    const write = written.get(name);
    if (write) {
      row.writtenAs = write.writtenAs;
      if (write.expression !== undefined) row.expression = write.expression;
    }
    const source = input.sources?.[name];
    if (source) row.source = source;

    let judged: Pick<PropRow, "editable" | "reason">;
    // With no metadata, a value's type proves nothing (a "ghost" may be one of a closed set).
    if (declared === undefined) {
      judged = { editable: false, reason: meta === null ? "UNVERIFIED" : reasonOfValue(current[name], name) };
    }
    else if (name === "children") judged = childrenRow(declared, writes);
    else judged = declared.editable ? { editable: true } : { editable: false, reason: declared.reason };

    if (judged.editable && declared?.editable && declared.kind === "options") row.options = declared.options;
    // Only a browser-rendered Instance is previewable, and only while Overrides are on.
    if (judged.editable && !input.overridesOn) judged = { editable: false, reason: "OVERRIDES OFF" };
    // A server-rendered Instance gets one card-level line instead of a reason per row (PER-84).
    if (server) judged = { editable: false };
    row.editable = judged.editable;
    if (judged.reason) row.reason = judged.reason;
    return row;
  });

  // Controls first; each half keeps declaration order.
  const ordered = [...rows.filter((row) => row.editable), ...rows.filter((row) => !row.editable)];
  const editable = ordered.filter((row) => row.editable).length;

  let note: string | null = null;
  if (server) note = SERVER_NOTE;
  else if (!input.overridesOn) note = overridesOffNote(input.overridesOffReason);
  else if (input.authorship === "spreads") note = SPREADS_NOTE;
  else if (meta === null) note = NO_META_NOTE;

  return {
    id: input.id,
    component: input.component,
    anchor: input.anchor,
    rendered: input.rendered,
    callSite: parseHint(input.hint),
    rows: ordered,
    coverage: { editable, inspectOnly: ordered.length - editable },
    injected: input.injected,
    authorship: input.authorship,
    note,
  };
}
