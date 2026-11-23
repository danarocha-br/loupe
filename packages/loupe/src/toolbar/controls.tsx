// A prop row of the inspector and its control (PER-131, PER-134, PER-137): options
// for a closed set, a field for label text, the app's own value beside an Override,
// Reset, and the holding notice for a State prop (PER-96). Since Paper's "Inspector as
// property rows" (2026-11-22) a closed set is a row of chips with the chosen one in
// salmon, and a true/false prop is a switch; a row that shows an Override carries its change's
// revision delta before its name, or an empty dashed delta for a held State prop,
// which the Proposal shows as a state, not a numbered change.
//
// The row comes decided from `panelView()` (PER-214); this file draws it, makes the
// write its data names, and keeps the Text field's unsent text while it has focus.

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { singleLine } from "../runtime/label-text.js";
import { Delta, LockIcon, ResetIcon } from "./icons.js";
import { type Control, type PropItem, sourceText, TEXT, THIS_INSTANCE, type ValueText } from "./panel-view/index.js";
import type { SelectMode } from "./picker.js";
import { Button, Chip, ChipGroup } from "./ui/index.js";

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

/** The app's value: written, the metadata's default, or a muted `not set`. Never recased: values are exact. */
function ValueView({ value }: { value: ValueText }) {
  if (value.kind === "default") return <span className="default" title="The component’s default: the call site doesn’t set it">{value.text}</span>;
  if (value.kind === "unset") return <span className="muted">{value.text}</span>;
  return <>{value.text}</>;
}

/** One change's revision delta, with the number the page's cloud and the Proposal's change id show. */
export function Key({ n }: { n: number }) {
  return (
    // Read as "Change 1", not a bare "1": the number means nothing without what it numbers.
    <span className="key" role="img" aria-label={`Change ${n}`} title={`Change ${n} in the Proposal`}>
      <Delta />
      <span className="n">{n}</span>
    </span>
  );
}

/**
 * A prop's or a component's name, free to break only where its words meet:
 * `focusable·When·Disabled`, `AlertDialog·Content`, never mid-word.
 */
export function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[a-z0-9])(?=[A-Z])/);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/** A held State prop's mark: an empty dashed delta, since the Proposal shows it as a state, not a numbered change. */
export function HeldKey() {
  return (
    <span className="key held" title="Held by your Override: shown as a state in the Proposal">
      <Delta dashed />
    </span>
  );
}

/** Before the name: the change's delta, an empty dashed one for a held State prop, or nothing. */
function KeySlot({ item }: { item: PropItem }) {
  if (item.key !== null) return <Key n={item.key} />;
  if (item.dot === "on") return <HeldKey />;
  return null;
}

type Options = Extract<Control, { kind: "options" }>;

/** A true/false prop, drawn as a switch rather than two options. */
function switchOf(control: Control | null): (Options & { on: boolean }) | null {
  if (control?.kind !== "options" || control.options.length !== 2) return null;
  const values = control.options.map((option) => option.value);
  if (!values.includes(true) || !values.includes(false)) return null;
  // At a scope whose members differ, neither is pressed: it reads off.
  return { ...control, on: control.options.some((option) => option.value === true && option.pressed) };
}

/** An option's label in the table: a string without its quotes, which the Proposal and the change line keep. */
function bare(label: string): string {
  return /^".+"$/.test(label) ? label.slice(1, -1) : label;
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
  onSelect(id: string, mode?: SelectMode): void;
  onHover(ids: string[]): void;
}) {
  const { reset } = item;
  const toggle = switchOf(item.control);
  const resetButton = reset && (
    <Button
      size="small"
      iconOnly={toggle !== null}
      className="reset"
      title={toggle ? reset.label : undefined}
      onClick={(event) => {
        // Reset goes once there is nothing to reset: focus moves to the row's own control, not out of the panel.
        const control = event.currentTarget
          .closest(".row")
          ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="switch"], textarea');
        attempt(() => debug.reset(reset.write.id, reset.write.prop, reset.write.scope));
        control?.focus();
      }}
    >
      <ResetIcon />
      {toggle ? <span className="sr-only">{reset.label}</span> : reset.label}
    </Button>
  );
  const { keeping } = item;
  // At a scope a switch speaks for its members while they agree; the counts show only once they differ.
  const mixed = toggle !== null && toggle.options.filter((option) => (option.count ?? 0) > 0).length > 1;
  // The table shows the chosen option and the field shows the text: the line keeps the value only for a row without either.
  const shown = item.control === null || item.control.kind === "refused";
  // Where a value comes from matters once it comes from a wider scope than the one in view:
  // at This instance, a group or page Override's; at a scope, the card is that scope already.
  const wider = item.source !== null && item.counts === null && item.source !== sourceText(THIS_INSTANCE);
  const classes = ["row", item.overridden && "overridden", toggle && "switch"].filter(Boolean).join(" ");
  return (
    <div className={classes} data-prop={item.name}>
      <div className="head-group">
        <div className="line">
          {item.dot && <KeySlot item={item} />}
          {/* The label and its code name together in the tooltip; the name itself wraps between its words. */}
          <span className="name" title={item.codeName ? `${item.label} (${item.codeName})` : item.label}>
            <span>
              <Breakable text={item.label} />
            </span>
            {item.codeName && <span className="mono"> {item.codeName}</span>}
          </span>
          {/* Label text left empty sits beside the name at This instance, and after the counts at a scope. */}
          {item.empty && item.counts === null && <EmptyTag />}
          {item.state && <span className="tag">{TEXT.state}</span>}
          {!item.change && shown && item.value && (
            <span className="value">
              <ValueView value={item.value} />
            </span>
          )}
          {item.counts !== null && (!toggle || mixed) && (
            <span className="value counts" data-testid="counts">
              {item.counts}
            </span>
          )}
          {item.empty && item.counts !== null && <EmptyTag />}
          {item.reason && (
            <span className="tag reason" title={item.reasonTitle ?? undefined}>
              {item.reason}
            </span>
          )}
          {reset && !reset.inNotice && !toggle && resetButton}
          {/* The switch shows true or false itself; no word repeats it. */}
          {toggle && (
            <span className="toggle">
              {reset && !reset.inNotice && resetButton}
              <SwitchView control={toggle} label={item.label} debug={debug} />
            </span>
          )}
        </div>
        {item.change && (
          <div className="change" data-testid="change">
            <span className="from">{item.change.from}</span>
            <span className="arrow">
              {" → "}
            </span>
            <span className="to">{item.change.to}</span>
            {wider && (
              <span className="from-scope" data-testid="source">
                {" · "}
                {item.source}
              </span>
            )}
          </div>
        )}
      </div>
      {item.explanation && <div className="explain">{item.explanation}</div>}
      {item.control && !toggle && (
        <ControlView
          key={item.control.kind === "refused" ? "refused" : item.control.key}
          control={item.control}
          label={item.label}
          app={item.change?.from ?? null}
          debug={debug}
        />
      )}
      {item.current && !item.change && (
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
          onClick={() => onSelect(keeping.select, "one")}
          // Over, not Enter, as every row of the panel (`Actions` in panel.tsx); focus outlines the same.
          onMouseOver={() => onHover(keeping.ids)}
          onMouseLeave={() => onHover([])}
          onFocus={() => onHover(keeping.ids)}
          onBlur={() => onHover([])}
        >
          {keeping.text}
        </button>
      )}
    </div>
  );
}

/** A true/false prop's switch: on sets true, off sets false. */
function SwitchView({ control, label, debug }: { control: Options & { on: boolean }; label: string; debug: LoupeDebug }) {
  const { write } = control;
  return (
    <button
      type="button"
      role="switch"
      className="switch-track"
      aria-checked={control.on}
      aria-label={label}
      data-switch={label}
      onClick={() => attempt(() => debug.set(write.id, write.prop, !control.on, write.scope))}
    >
      <span className="thumb" />
    </button>
  );
}

/**
 * A closed set of options as chips: the value that shows now in salmon, the app's
 * own value ringed and tagged under an Override, the design system's default with a
 * dot after it, each with its count at a scope; a field for label text (PER-113); or why neither.
 */
function ControlView({ control, label, app, debug }: { control: Control; label: string; app: string | null; debug: LoupeDebug }) {
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
    // Chips take string values: each option by its type and value, which tells `1` from `"1"`.
    const keyOf = (value: unknown) => `${typeof value}:${String(value)}`;
    const checked = control.options.find((option) => option.pressed);
    return (
      <ChipGroup
        label={label}
        value={checked ? keyOf(checked.value) : null}
        onChoose={(key) => {
          const option = control.options.find((candidate) => keyOf(candidate.value) === key);
          if (option) set(option.value);
        }}
      >
        {control.options.map((option) => {
          const isApp = option.label === app && !option.pressed;
          const notes = [isApp && "the app’s value", option.isDefault && "the design system’s default"].filter(Boolean).join("; ");
          return (
            <Chip
              key={keyOf(option.value)}
              value={keyOf(option.value)}
              tag={isApp ? "app" : undefined}
              dot={option.isDefault}
              count={option.count}
              description={notes || undefined}
              // The exact value and its marks for a pointer; the cell wraps the value in full.
              title={notes ? `${option.label}: ${notes}` : option.label}
              data-option={option.label}
            >
              {bare(option.label)}
            </Chip>
          );
        })}
      </ChipGroup>
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
