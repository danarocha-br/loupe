// A prop row of the inspector and its control (PER-131, PER-134): pills for a
// closed set of options, a field for label text (PER-137), the app's Current value beside
// an Override, Reset, and the holding notice for a State prop (PER-96). At This
// instance a row edits one Instance; at a group or page scope it edits that
// scope's record, with its members' Current values counted on the pills.

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { OptionValue } from "../meta/types.js";
import type { InstanceProps, LoupeDebug } from "../runtime/debug.js";
import type { PropRow } from "../runtime/inspect.js";
import { singleLine, textScopeRefusal } from "../runtime/label-text.js";
import { STATE_SCOPE_REASON } from "../runtime/state.js";
import type { Scope, Source } from "../runtime/store.js";
import { appValue, formatCurrent, formatDefault } from "./format.js";
import { keepingOwn, NOT_SET, type ScopeLabels, type ScopeView, valueCounts } from "./scopes.js";

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
export function attempt(write: () => void): void {
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

/** What a scope is called where a value comes from it. */
function scopeName(source: Source, labels: ScopeLabels): string {
  if (source === "app") return "the app";
  return labels[source] ?? "this call site";
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
        {row.text && value === "" && <EmptyTag />}
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
        // Keyed so another Instance drops the field's unsent text. Not on the source: the
        // first keystroke makes an Override, and a remount would take the field's focus.
        <Control
          key={editing.id}
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
  onHover,
}: {
  row: PropRow;
  editing: Editing;
  view: ScopeView;
  onSelect(id: string): void;
  onHover(ids: string[]): void;
}) {
  const { debug, id } = editing;
  const scope = view.scope;
  const values = view.record?.values ?? {};
  const overridden = row.name in values;
  // A suspended record is shown, never written: "Code changed here, review" is PER-136's.
  const suspended = view.record?.suspended != null;
  const inScope = view.members.filter((member) => !member.out).length;
  const counts = valueCounts(view, row.name);
  const sole = counts.size === 1 && inScope > 0 ? ([...counts.keys()][0] as string) : null;
  const keeping = keepingOwn(view, row.name);
  // Instance scope only for a State prop (a group `open` would open every dialog at that
  // call site at once, PER-96); never page scope for label text (PER-113).
  const refusal = row.state
    ? { testId: "state-only", reason: STATE_SCOPE_REASON }
    : row.text && textScopeRefusal(scope, row.name)
      ? { testId: "per-call-site", reason: textScopeRefusal(scope, row.name) }
      : null;
  // The pressed pill: this scope's Override, else the one value every member shares.
  const value: unknown = overridden
    ? values[row.name]
    : sole !== null && sole !== NOT_SET
      ? row.options
        ? row.options.find((option) => formatCurrent(option) === sole)
        : textOf(sole)
      : undefined;
  return (
    <div className={overridden ? "row overridden" : "row"} data-prop={row.name}>
      <div className="line">
        <span className="name">
          {row.label}
          {row.label !== row.name && <span className="mono muted"> {row.name}</span>}
        </span>
        <span className="value mono" data-testid="counts">
          {sole !== null ? `SAME ON ALL ${inScope}` : [...counts].map(([key, count]) => `${key} ${count}`).join(" · ")}
        </span>
        {row.text && overridden && values[row.name] === "" && <EmptyTag />}
        {row.state && <span className="tag">STATE</span>}
        {row.reason && <span className="tag">{row.reason}</span>}
        {overridden && !suspended && (
          <button type="button" className="reset" onClick={() => attempt(() => debug.reset(id, row.name, scope))}>
            Reset
          </button>
        )}
      </div>
      <div className="source muted" data-testid="source">
        from {overridden ? view.name : "the app"}
      </div>
      {refusal ? (
        <div className="muted" data-testid={refusal.testId}>
          {refusal.reason}
        </div>
      ) : (
        row.editable &&
        !suspended && (
          // Not keyed on `overridden`: the first keystroke sets this scope's value.
          <Control
            key={scope}
            row={row}
            value={value}
            counts={counts}
            set={(next) => attempt(() => debug.set(id, row.name, next, scope))}
          />
        )
      )}
      {keeping.length > 0 && (
        <button
          type="button"
          className="keeping"
          onClick={() => onSelect(keeping[0] as string)}
          onMouseEnter={() => onHover(keeping)}
          onMouseLeave={() => onHover([])}
        >
          {keeping.length} of {inScope} {keeping.length === 1 ? "keeps its own value" : "keep their own values"}
        </button>
      )}
    </div>
  );
}

/** Label text left empty: the row says so, as the field shows nothing. */
function EmptyTag() {
  return (
    <span className="tag" data-testid="empty">
      empty
    </span>
  );
}

/** The label text a pill key names (`formatCurrent` of a string is its JSON), or undefined. */
function textOf(key: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(key);
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
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
  return <TextField label={row.label} value={typeof value === "string" ? value : ""} set={set} />;
}

/**
 * Label text (PER-113): one line, no length limit, applied while typing, and it
 * may be left empty. It wraps and grows to its text rather than scrolling.
 */
function TextField({ label, value, set }: { label: string; value: string; set(next: string): void }) {
  // The Toolbar redraws once a frame, so the field keeps its own text while it has focus.
  const [draft, setDraft] = useState<string | null>(null);
  // The value the last keystroke started from and the one it sent: the frame after it shows either.
  const [typed, setTyped] = useState<{ from: string; to: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Anything else moved the value (a reset, another scope): the draft is stale.
  const stale = draft !== null && typed !== null && value !== typed.from && value !== typed.to;
  if (stale) {
    setDraft(null);
    setTyped(null);
  }
  const text = stale ? value : (draft ?? value);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    // scrollHeight leaves out the borders, which border-box sizing counts.
    field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      className="text"
      rows={1}
      aria-label={label}
      value={text}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onChange={(event) => {
        const next = singleLine(event.target.value);
        setTyped({ from: value, to: next });
        setDraft(next);
        set(next);
      }}
      onBlur={() => {
        setDraft(null);
        setTyped(null);
      }}
    />
  );
}
