// A prop row of the inspector and its control at This instance (PER-131): pills for
// a closed set of options, a field for label text, the app's Current value beside
// an Override, Reset, and the holding notice for a State prop (PER-96).

import { type ReactNode, useState } from "react";
import type { OptionValue } from "../meta/types.js";
import type { InstanceProps, LoupeDebug } from "../runtime/debug.js";
import type { PropRow } from "../runtime/inspect.js";
import { formatCurrent, formatDefault } from "./format.js";

/** A mounted, browser-rendered Instance while Overrides are on: what its rows can edit. */
export type Editing = { debug: LoupeDebug; id: string; live: InstanceProps };

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

/** What the control shows as chosen: the rendered Override, else the app's value, else a known default. */
function chosenValue(row: PropRow, live: InstanceProps): unknown {
  if (row.name in live.overrides) return live.overrides[row.name];
  if (row.set) return row.value;
  // A `conflict` or `unknown` default selects nothing: we never guess (PER-84).
  const fallback = row.default;
  if (fallback && (fallback.source === "destructure" || fallback.source === "defaultVariants")) return fallback.value ?? undefined;
  return undefined;
}

export function PropRowView({ row, editing }: { row: PropRow; editing: Editing | null }) {
  // Only an Instance-scope Override is this scope's to reset; a group or page one is tagged.
  const overridden = editing?.live.sources[row.name] === "instance";
  const held = editing?.live.states[row.name]?.held;
  const tried = held !== undefined && "appTried" in held;
  const scoped = row.source === "group" || row.source === "page";
  const reset = editing && overridden ? () => attempt(() => editing.debug.reset(editing.id, row.name)) : null;
  const resetButton = reset && (
    <button type="button" className="reset" onClick={reset}>
      Reset
    </button>
  );
  return (
    <div className={overridden ? "row overridden" : "row"} data-prop={row.name}>
      <div className="line">
        <span className="name">
          {row.label}
          {row.label !== row.name && <span className="mono muted"> {row.name}</span>}
        </span>
        {!overridden && <span className="value mono">{currentValue(row)}</span>}
        {row.state && <span className="tag">STATE</span>}
        {scoped && <span className="tag">{row.source} override</span>}
        {row.reason && <span className="tag">{row.reason}</span>}
        {!tried && resetButton}
      </div>
      {row.editable && editing && (
        // Keyed so a reset or another Instance drops the field's unsent text.
        <Control key={`${editing.id}:${overridden}`} row={row} editing={editing} />
      )}
      {overridden && (
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

/** Pills for a closed set of options; a field for label text (PER-113). */
function Control({ row, editing }: { row: PropRow; editing: Editing }) {
  const value = chosenValue(row, editing.live);
  const [draft, setDraft] = useState<string | null>(null);
  const set = (next: unknown) => attempt(() => editing.debug.set(editing.id, row.name, next));
  if (row.options) {
    return (
      <div className="pills" role="group" aria-label={row.label}>
        {row.options.map((option: OptionValue) => (
          <button key={`${typeof option}:${option}`} type="button" aria-pressed={Object.is(value, option)} onClick={() => set(option)}>
            {formatCurrent(option)}
          </button>
        ))}
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
