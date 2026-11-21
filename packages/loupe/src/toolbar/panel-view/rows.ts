// A prop row of the Inspector, decided (PER-131, PER-134, PER-137): at This
// instance a row edits one Instance; at a group or page scope it edits that
// scope's record, with its members' Current values counted on the pills.

import type { InstanceProps } from "../../runtime/debug.js";
import type { PropRow } from "../../runtime/inspect.js";
import { textScopeRefusal } from "../../runtime/label-text.js";
import { STATE_SCOPE_REASON } from "../../runtime/state.js";
import type { Scope, Source } from "../../runtime/store.js";
import { appValue, formatCurrent } from "../format.js";
import type { Reads } from "./reads.js";
import { type Counted, isSuspended, keepingOwn, type ScopeLabels, type ScopeView, valueCounts } from "./scopes.js";
import type { Control, PropItem, Write } from "./types.js";
import { countsText, EXPLAIN, heldNotice, keepingText, NOT_SET, REASON_TITLES, RESET, RESET_TO, sameOnAll, sourceText, THE_APP, THIS_CALL_SITE, valueText } from "./words.js";

/** A mounted, browser-rendered, adapted Instance while Overrides are on: what its rows can edit. */
export type Editing = {
  id: string;
  live: InstanceProps;
  labels: ScopeLabels;
  /** Per prop, the scope this Instance falls back to once its own Override is reset. */
  fallback: Record<string, Scope>;
  /** Per scope, the number of the change it holds for this Instance. */
  keyAt: Partial<Record<Scope, number | null>>;
};

/** What every row says the same way at any scope. */
function common(row: PropRow, overridden: boolean) {
  return {
    name: row.name,
    label: row.label,
    codeName: row.label === row.name ? null : row.name,
    dot: row.editable ? (overridden ? "on" : "off") : null,
    overridden,
    state: row.state === true,
    reason: row.reason ?? null,
    reasonTitle: row.reason ? (REASON_TITLES[row.reason] ?? null) : null,
    explanation: row.name === "children" && row.reason ? (EXPLAIN[row.reason] ?? null) : null,
  } satisfies Partial<PropItem>;
}

/** What a scope is called where a value comes from it. */
function scopeName(source: Source, labels: ScopeLabels): string {
  if (source === "app") return THE_APP;
  return labels[source] ?? THIS_CALL_SITE;
}

/** The design system's default for an unset prop, when the metadata reads one from the code; never a guess (PER-84). */
function knownDefault(row: PropRow): { value: unknown } | null {
  const known = row.default;
  if (!known || (known.source !== "destructure" && known.source !== "defaultVariants") || known.value == null) return null;
  return { value: known.value };
}

/** Pills for a closed set of options, each with its count at a scope; a field for label text (PER-113). */
function control(row: PropRow, value: unknown, write: Write, key: string, counts: Map<string, Counted> | null): Control {
  if (row.options) {
    const fallback = knownDefault(row);
    return {
      kind: "options",
      key,
      write,
      options: row.options.map((option) => {
        const label = formatCurrent(option);
        return {
          value: option,
          label,
          pressed: Object.is(value, option),
          count: counts?.get(label)?.count ?? null,
          isDefault: fallback !== null && Object.is(fallback.value, option),
        };
      }),
    };
  }
  return { kind: "text", key, write, value: typeof value === "string" ? value : "" };
}

/**
 * A row at This instance, or any inspect-only row. With `editing` null (on the
 * server, no Adapter, Overrides off, or an inspect-only row at a wider scope) it
 * only shows the app's value.
 */
export function instanceProp(row: PropRow, editing: Editing | null): PropItem {
  // Only an Instance-scope Override is this scope's to reset; a group or page one says where it comes from.
  const source = editing?.live.sources[row.name];
  const overridden = source === "instance";
  // Any Override's value, whatever its scope, puts the app's own value on a `Current:` line.
  const fromOverride = source !== undefined && source !== "app";
  const held = editing?.live.states[row.name]?.held;
  const tried = held !== undefined && "appTried" in held;
  const value: unknown = editing && row.name in editing.live.overrides ? editing.live.overrides[row.name] : appValue(row);
  const write: Write | null = editing ? { id: editing.id, prop: row.name, scope: "instance" } : null;
  return {
    ...common(row, overridden),
    empty: row.text === true && value === "",
    value: fromOverride ? null : valueText(row),
    counts: null,
    source: editing && source ? sourceText(scopeName(source, editing.labels)) : null,
    // Keyed by Instance, so another Instance drops the field's unsent text. Not by
    // source: the first keystroke makes an Override, and a remount would take the field's focus.
    control: row.editable && editing && write ? control(row, value, write, editing.id, null) : null,
    current: fromOverride ? valueText(row) : null,
    key: editing && source && source !== "app" ? (editing.keyAt[source] ?? null) : null,
    change: fromOverride ? { from: valueText(row).text, to: formatCurrent(value) } : null,
    held: tried ? heldNotice(held.value, held.appTried) : null,
    reset:
      editing && overridden && write ? { label: RESET_TO[editing.fallback[row.name] ?? "instance"], write, inNotice: tried } : null,
    keeping: null,
  };
}

/**
 * An Editable row at a group or page scope: it edits that scope's record. The pills
 * count the Current values of the members still in the scope, and the row notes
 * the members a narrower scope keeps at their own value.
 */
export function scopeProp(row: PropRow, id: string, view: ScopeView, reads: Reads, key: number | null = null): PropItem {
  const { scope } = view;
  const values = view.record?.values ?? {};
  const overridden = row.name in values;
  // A Suspended record is shown, never written: "Code changed here, review" is PER-136's.
  const suspended = isSuspended(view);
  const inScope = view.members.filter((member) => !member.out).length;
  // The table counts what each member shows now; a change still reads from the app's own values.
  const counts = valueCounts(view, row.name, reads, "shown");
  const appCounts = valueCounts(view, row.name, reads, "app");
  const [only] = counts.size === 1 && inScope > 0 ? [...counts.values()] : [];
  const keeping = keepingOwn(view, row.name, reads);
  const [nearest] = keeping;
  // Instance scope only for a State prop (a group `open` would open every dialog at that
  // call site at once, PER-96); never page scope for label text (PER-113).
  const textRefusal = row.text ? textScopeRefusal(scope, row.name) : null;
  // The pressed pill: this scope's Override, else the one value every member shares.
  const value: unknown = overridden ? values[row.name] : only && !only.unset ? only.value : undefined;
  const write: Write = { id, prop: row.name, scope };
  return {
    ...common(row, overridden),
    empty: row.text === true && overridden && values[row.name] === "",
    value: null,
    // Text with no control here still shows what it says, not only that it matches.
    counts: only && !textRefusal ? sameOnAll(inScope) : countsText(new Map([...counts].map(([label, entry]) => [label, entry.count]))),
    source: sourceText(overridden ? view.name : THE_APP),
    control: row.state
      ? { kind: "refused", refusal: "state-only", text: STATE_SCOPE_REASON }
      : textRefusal
        ? { kind: "refused", refusal: "per-call-site", text: textRefusal }
        : row.editable && !suspended
          ? // Keyed by scope, not by whether it holds an Override: the first keystroke sets this scope's value.
            control(row, value, write, scope, counts)
          : null,
    current: null,
    key: overridden ? key : null,
    // The app's value when every member shares one, else how they differ.
    change: overridden
      ? {
          from: appCounts.size === 1 ? ([...appCounts.keys()][0] ?? NOT_SET) : appCounts.size === 0 ? NOT_SET : "mixed",
          to: formatCurrent(values[row.name]),
        }
      : null,
    held: null,
    reset: overridden && !suspended ? { label: RESET, write, inNotice: false } : null,
    keeping: nearest === undefined ? null : { text: keepingText(keeping.length, inScope), ids: keeping, select: nearest },
  };
}
