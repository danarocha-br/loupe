// A prop row of the inspector and its control (PER-131, PER-134): pills for a
// closed set of options, a field for label text, the app's Current value beside
// an Override, Reset, and the holding notice for a State prop (PER-96). At This
// instance a row edits one Instance; at a group or page scope it edits that
// scope's record, with its members' Current values counted on the pills.

import { type ReactNode, useState } from "react";
import type { OptionValue } from "../meta/types.js";
import type { InstanceProps, LoupeDebug } from "../runtime/debug.js";
import type { PropRow } from "../runtime/inspect.js";
import { STATE_SCOPE_REASON } from "../runtime/state.js";
import type { Scope, Source } from "../runtime/store.js";
import { formatCurrent, formatDefault } from "./format.js";
import { keepingOwn, type ScopeLabels, type ScopeView, valueCounts } from "./scopes.js";

/** A mounted, browser-rendered Instance while Overrides are on: what its rows can edit. */
export type Editing = {
  debug: LoupeDebug;
  id: string;
  live: InstanceProps;
  labels: ScopeLabels;
  /** Per prop, the scope this Instance falls back to once its own Override is reset. */
  fallback: Record<string, Scope>;
};

/**
 * The Instance can unmount between a frame and a click (its menu closes, say). The
 * write is then dropped, and the next frame shows "Not on the page now".
 */
function attempt(write: () => void): void {
  try {
    write();
  } catch {
    // Nothing to write to any more.
  }
}

/** The app's value as the row shows it: set, its default, or `not set`. */
function currentValue(row: PropRow): ReactNode {
  if (row.set) return formatCurrent(row.value);
  if (row.default) return <span className="tag">{formatDefault(row.default)}</span>;
  return <span className="muted">not set</span>;
}

/** The value a control shows when no Override names one: the app's, else a known default. */
function appValue(row: PropRow): unknown {
  if (row.set) return row.value;
  // A `conflict` or `unknown` default selects nothing: we never guess (PER-84).
  const fallback = row.default;
  if (fallback && (fallback.source === "destructure" || fallback.source === "defaultVariants")) return fallback.value ?? undefined;
  return undefined;
}

/** What a scope is called where a value comes from it. */
function scopeName(source: Source, labels: ScopeLabels): string {
  if (source === "app") return "the app";
  if (source === "group") return labels.group ?? "this call site";
  return labels[source];
}

const RESET_TO: Record<Scope, string> = { instance: "Reset", group: "Reset to group value", page: "Reset to page value" };

export function PropRowView({ row, editing }: { row: PropRow; editing: Editing | null }) {
  // Only an Instance-scope Override is this scope's to reset; a group or page one says where it comes from.
  const source = editing?.live.sources[row.name];
  const overridden = source === "instance";
  // Any Override's value, whatever its scope, puts the app's own value on a `Current:` line.
  const fromOverride = source !== undefined && source !== "app";
  const held = editing?.live.states[row.name]?.held;
  const tried = held !== undefined && "appTried" in held;
  const fallback = editing?.fallback[row.name];
  const reset = editing && overridden ? () => attempt(() => editing.debug.reset(editing.id, row.name)) : null;
  const resetButton = reset && (
    <button type="button" className="reset" onClick={reset}>
      {RESET_TO[fallback ?? "instance"]}
    </button>
  );
  const value: unknown = editing && row.name in editing.live.overrides ? editing.live.overrides[row.name] : appValue(row);
  return (
    <div className={overridden ? "row overridden" : "row"} data-prop={row.name}>
      <div className="line">
        <span className="name">
          {row.label}
          {row.label !== row.name && <span className="mono muted"> {row.name}</span>}
        </span>
        {!fromOverride && <span className="value mono">{currentValue(row)}</span>}
        {row.state && <span className="tag">STATE</span>}
        {row.reason && <span className="tag">{row.reason}</span>}
        {!tried && resetButton}
      </div>
      {editing && source && (
        <div className="source muted" data-testid="source">
          from {scopeName(source, editing.labels)}
        </div>
      )}
      {row.editable && editing && (
        // Keyed so a reset or another Instance drops the field's unsent text.
        <Control
          key={`${editing.id}:${source}`}
          row={row}
          value={value}
          set={(next) => attempt(() => editing.debug.set(editing.id, row.name, next))}
        />
      )}
      {fromOverride && (
        <div className="current mono" data-testid="current">
          Current: {currentValue(row)}
        </div>
      )}
      {tried && (
        <div className="notice" role="status" data-testid="held">
          Your Override holds this at <code>{formatCurrent(held.value)}</code>; the app tried to set{" "}
          <code>{formatCurrent(held.appTried)}</code>. {resetButton}
        </div>
      )}
    </div>
  );
}

/**
 * A prop row at a group or page scope: it edits that scope's record. The pills
 * count the Current values of the members still in the scope, and the row notes
 * the members a narrower scope keeps at their own value.
 */
export function ScopeRowView({
  row,
  editing,
  view,
  onSelect,
}: {
  row: PropRow;
  editing: Editing;
  view: ScopeView;
  onSelect(id: string): void;
}) {
  const { debug, id } = editing;
  const scope = view.scope;
  const values = view.record?.values ?? {};
  const overridden = row.name in values;
  const inScope = view.members.filter((member) => !member.out).length;
  const counts = valueCounts(debug, view, row.name);
  const same = counts.size === 1 && inScope > 0;
  const keeping = keepingOwn(view, row.name);
  const value: unknown = overridden ? values[row.name] : same ? appValue(row) : undefined;
  return (
    <div className={overridden ? "row overridden" : "row"} data-prop={row.name}>
      <div className="line">
        <span className="name">
          {row.label}
          {row.label !== row.name && <span className="mono muted"> {row.name}</span>}
        </span>
        <span className="value mono" data-testid="counts">
          {same ? `SAME ON ALL ${inScope}` : [...counts].map(([key, count]) => `${key} ${count}`).join(" · ")}
        </span>
        {row.state && <span className="tag">STATE</span>}
        {row.reason && <span className="tag">{row.reason}</span>}
        {overridden && (
          <button type="button" className="reset" onClick={() => attempt(() => debug.reset(id, row.name, scope))}>
            Reset
          </button>
        )}
      </div>
      {row.state ? (
        // Instance scope only: a group `open` would open every dialog at that call site at once (PER-96).
        <div className="muted" data-testid="state-only">
          {STATE_SCOPE_REASON}
        </div>
      ) : (
        row.editable && (
          <Control
            key={`${scope}:${overridden}`}
            row={row}
            value={value}
            counts={counts}
            set={(next) => attempt(() => debug.set(id, row.name, next, scope))}
          />
        )
      )}
      {keeping.length > 0 && (
        <button type="button" className="keeping" onClick={() => onSelect(keeping[0] as string)}>
          {keeping.length} of {inScope} {keeping.length === 1 ? "keeps its own value" : "keep their own values"}
        </button>
      )}
    </div>
  );
}

/** Pills for a closed set of options, each with its count at a scope; a field for label text (PER-113). */
function Control({
  row,
  value,
  set,
  counts,
}: {
  row: PropRow;
  value: unknown;
  set(next: unknown): void;
  counts?: Map<string, number>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (row.options) {
    return (
      <div className="pills" role="group" aria-label={row.label}>
        {row.options.map((option: OptionValue) => {
          const label = formatCurrent(option);
          const count = counts?.get(label);
          return (
            <button
              key={`${typeof option}:${option}`}
              type="button"
              aria-pressed={Object.is(value, option)}
              data-option={label}
              onClick={() => set(option)}
            >
              {label}
              {count !== undefined && <span className="count"> {count}</span>}
            </button>
          );
        })}
      </div>
    );
  }
  // The Toolbar redraws once a frame, so the field keeps its own text while it has focus.
  return (
    <input
      className="text"
      aria-label={row.label}
      value={draft ?? (typeof value === "string" ? value : "")}
      onChange={(event) => {
        setDraft(event.target.value);
        set(event.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
