// A prop row of the inspector and its control (PER-131, PER-134, PER-137): pills for
// a closed set of options, a field for label text, the app's Current value beside
// an Override, Reset, and the holding notice for a State prop (PER-96). Each
// Editable row is its own card, with a purple dot while it holds an Override (PER-140).
//
// The row comes decided from `panelView()` (PER-214); this file draws it, makes the
// write its data names, and keeps the Text field's unsent text while it has focus.

import { useLayoutEffect, useRef, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { singleLine } from "../runtime/label-text.js";
import { LockIcon, ResetIcon } from "./icons.js";
import { type Control, type PropItem, TEXT, type ValueText } from "./panel-view/index.js";

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

/** The app's value: written, the metadata's default as a tag, or a muted `not set`. */
function ValueView({ value }: { value: ValueText }) {
  if (value.kind === "default") return <span className="tag">{value.text}</span>;
  if (value.kind === "unset") return <span className="muted">{value.text}</span>;
  return <>{value.text}</>;
}

/** The Override dot: purple while the row holds one, an empty slot otherwise so names line up. */
function Dot({ on }: { on: boolean }) {
  return <span className={on ? "dot purple" : "dot"} aria-hidden="true" />;
}

/** Label text left empty: the row says so, as the field shows nothing. */
function EmptyTag() {
  return (
    <span className="tag empty" data-testid="empty">
      {TEXT.empty}
    </span>
  );
}

export function PropRowView({
  item,
  debug,
  onSelect,
  onHover,
}: {
  item: PropItem;
  debug: LoupeDebug;
  onSelect(id: string): void;
  onHover(ids: string[]): void;
}) {
  const { reset } = item;
  const resetButton = reset && (
    <button
      type="button"
      className="btn small reset"
      onClick={() => attempt(() => debug.reset(reset.write.id, reset.write.prop, reset.write.scope))}
    >
      <ResetIcon />
      {reset.label}
    </button>
  );
  const { keeping } = item;
  return (
    <div className={item.overridden ? "row overridden" : "row"} data-prop={item.name}>
      <div className="line">
        {item.dot && <Dot on={item.dot === "on"} />}
        <span className="name">
          {item.label}
          {item.codeName && <span className="mono"> {item.codeName}</span>}
        </span>
        {/* Label text left empty sits beside the name at This instance, and after the counts at a scope. */}
        {item.empty && item.counts === null && <EmptyTag />}
        {item.state && <span className="tag">{TEXT.state}</span>}
        {item.value && (
          <span className="value">
            <ValueView value={item.value} />
          </span>
        )}
        {item.counts !== null && (
          <span className="value" data-testid="counts">
            {item.counts}
          </span>
        )}
        {item.empty && item.counts !== null && <EmptyTag />}
        {item.reason && <span className="tag">{item.reason}</span>}
        {reset && !reset.inNotice && resetButton}
      </div>
      {item.explanation && <div className="explain">{item.explanation}</div>}
      {item.source && (
        <div className="source muted" data-testid="source">
          {item.source}
        </div>
      )}
      {item.control && (
        <ControlView key={item.control.kind === "refused" ? "refused" : item.control.key} control={item.control} label={item.label} debug={debug} />
      )}
      {item.current && (
        <div className="current" data-testid="current">
          <span className="meta">{TEXT.current}</span> <ValueView value={item.current} />
        </div>
      )}
      {item.held && (
        <div className="notice" role="status" data-testid="held">
          {item.held.before} <code>{item.held.value}</code>
          {item.held.middle} <code>{item.held.tried}</code>
          {item.held.after} {reset?.inNotice && resetButton}
        </div>
      )}
      {keeping && (
        <button
          type="button"
          className="keeping"
          onClick={() => onSelect(keeping.select)}
          onMouseEnter={() => onHover(keeping.ids)}
          onMouseLeave={() => onHover([])}
        >
          {keeping.text}
        </button>
      )}
    </div>
  );
}

/** Pills for a closed set of options, each with its count at a scope; a field for label text (PER-113); or why neither. */
function ControlView({ control, label, debug }: { control: Control; label: string; debug: LoupeDebug }) {
  if (control.kind === "refused") {
    return (
      <div className="refusal" data-testid={control.refusal}>
        <LockIcon />
        {control.text}
      </div>
    );
  }
  const { write } = control;
  const set = (next: unknown) => attempt(() => debug.set(write.id, write.prop, next, write.scope));
  if (control.kind === "options") {
    return (
      <div className="pills" role="group" aria-label={label}>
        {control.options.map((option) => (
          <button
            key={`${typeof option.value}:${option.value}`}
            type="button"
            aria-pressed={option.pressed}
            data-option={option.label}
            onClick={() => set(option.value)}
          >
            {option.label}
            {option.count !== null && <span className="count"> {option.count}</span>}
          </button>
        ))}
      </div>
    );
  }
  return <TextField label={label} value={control.value} set={set} />;
}

/**
 * Label text (PER-113): one line, no length limit, applied while typing, and it
 * may be left empty. It wraps and grows to its text rather than scrolling.
 */
function TextField({ label, value, set }: { label: string; value: string; set(next: string): void }) {
  // The Toolbar redraws once a frame, so the field keeps its own text while it has focus,
  // with the value that text was typed over.
  const [draft, setDraft] = useState<{ text: string; from: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Something else moved the value (a reset, another scope): drop the draft.
  const stale = draft !== null && value !== draft.from && value !== draft.text;
  if (stale) setDraft(null);
  const text = draft === null || stale ? value : draft.text;
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
        setDraft({ text: next, from: value });
        set(next);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
