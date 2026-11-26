// PropRow (ADR 0003, DESIGN.md "Property rows"): one prop of the Inspector, as `panelView()`
// decided it. A Row with the prop's glyph (or, under Inspect only, a `pair`), its delta,
// name, tags, value and Reset on the line; the change line under it; then its control:
// chips for a closed set, a switch for true/false, a one-line field for label text, or
// the reason it gets none; then what the app holds, and who keeps their own value.
//
// It draws `PropItem` and the Inspector's words, and builds none: every write goes out
// through its callbacks, which the view turns into the runtime's calls. See prop-row.md.

import { useState } from "react";
import type { Control, InspectorWords, PropItem, ValueText, Write } from "../view.js";
import {
  Button,
  Chip,
  ChipGroup,
  Field,
  LockIcon,
  PROP_ICONS,
  ResetIcon,
  Row,
  RowAction,
  RowLine,
  type RowLook,
  RowName,
  RowValue,
  Switch,
  Tag,
  useAnnounceChange,
} from "@loupe/ui";
import { Breakable, ChangeKey, HeldKey } from "../marks/marks.js";

export type PropRowProps = {
  item: PropItem;
  words: InspectorWords;
  /** `inset` in the Inspector's card, with the prop's glyph; `pair` under Inspect only, name and value side by side. */
  look?: RowLook;
  /** A chip chosen, or a switch turned: the value to write. */
  onSet(write: Write, value: unknown): void;
  /** Label text typed, already kept to one line by `oneLine`. */
  onText(write: Write, text: string): void;
  /**
   * Keeps label text to one line as it is typed or pasted: the field shows, and `onText`
   * gets, the same text. The view's rule (a line break becomes a space); none by default.
   */
  oneLine?(text: string): string;
  onReset(write: Write): void;
  /** "1 of 4 keeps its own value": select the one it names. */
  onSelect(id: string): void;
  /** Outline these Instances on the page while the pointer or focus is on what names them; none clears. */
  onHover(ids: string[]): void;
};

type Options = Extract<Control, { kind: "options" }>;

/** A true/false prop, drawn as a switch rather than two options. */
function switchOf(control: Control | null): (Options & { on: boolean }) | null {
  if (control?.kind !== "options" || control.options.length !== 2) return null;
  const values = control.options.map((option) => option.value);
  if (!values.includes(true) || !values.includes(false)) return null;
  // At a scope whose members differ, neither is pressed: it reads off.
  return { ...control, on: control.options.some((option) => option.value === true && option.pressed) };
}

/** An option's label on its chip: a string without its quotes, which the Proposal and the change line keep. */
function bare(label: string): string {
  return /^".+"$/.test(label) ? label.slice(1, -1) : label;
}

/** The app's value: written, the metadata's default, or a muted `not set`. Never recased: values are exact. */
function ValueView({ value, words }: { value: ValueText; words: InspectorWords }) {
  if (value.kind === "set") return <>{value.text}</>;
  return (
    <span data-value={value.kind} title={value.kind === "default" ? words.defaultTitle : undefined}>
      {value.text}
    </span>
  );
}

/** Label text left empty: the row says so, as the field shows nothing. */
function EmptyTag({ words }: { words: InspectorWords }) {
  return (
    <Tag look="empty" data-testid="empty">
      {words.empty}
    </Tag>
  );
}

export function PropRow({ item, words, look = "inset", onSet, onText, oneLine, onReset, onSelect, onHover }: PropRowProps) {
  const { reset, keeping } = item;
  // The app pushing back on a held value is news while the row is in view: said as it lands.
  useAnnounceChange(item.held?.text ?? "");
  const toggle = switchOf(item.control);
  const resetButton = reset && (
    <Button
      size="small"
      iconOnly={toggle !== null}
      title={toggle ? reset.label : undefined}
      // Named by the prop it resets, after what it shows: every row's Reset would read the same.
      aria-label={toggle ? undefined : reset.name}
      data-prop-reset=""
      onClick={(event) => {
        // Reset goes once there is nothing to reset: focus moves to the row's own control, not out of the panel.
        const control = event.currentTarget
          .closest("[data-row]")
          ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="switch"], textarea');
        onReset(reset.write);
        control?.focus();
      }}
    >
      <ResetIcon />
      {toggle ? <span className="sr-only">{reset.name}</span> : reset.label}
    </Button>
  );
  // At a scope a switch speaks for its members while they agree; the counts show only once they differ.
  const mixed = toggle !== null && toggle.options.filter((option) => (option.count ?? 0) > 0).length > 1;
  // The chips show the chosen option and the field shows the text: the line keeps the value only for a row without either.
  const shown = item.control === null || item.control.kind === "refused";
  return (
    <Row
      look={look}
      glyph={look === "pair" ? undefined : PROP_ICONS[item.glyph]}
      data-prop={item.name}
      data-overridden={item.overridden ? "" : undefined}
    >
      <div data-prop-head="">
        <RowLine>
          {item.key !== null ? <ChangeKey n={item.key} words={words} /> : item.dot === "on" ? <HeldKey words={words} /> : null}
          {/* The label and its code name together in the tooltip; the name itself wraps between its words. */}
          <RowName code={item.codeName ?? undefined} title={item.codeName ? `${item.label} (${item.codeName})` : item.label}>
            <Breakable text={item.label} />
          </RowName>
          {/* Label text left empty sits beside the name at This instance, and after the counts at a scope. */}
          {item.empty && item.counts === null && <EmptyTag words={words} />}
          {item.state && <Tag>{words.state}</Tag>}
          {!item.change && shown && item.value && (
            <RowValue>
              <ValueView value={item.value} words={words} />
            </RowValue>
          )}
          {item.counts !== null && (!toggle || mixed) && <RowValue data-testid="counts">{item.counts}</RowValue>}
          {item.empty && item.counts !== null && <EmptyTag words={words} />}
          {item.reason && (
            <Tag look="reason" title={item.reasonTitle ?? undefined}>
              {item.reason}
            </Tag>
          )}
          {/* The switch shows true or false itself; no word repeats it. */}
          {((reset && !reset.inNotice) || toggle) && (
            <RowAction>
              {reset && !reset.inNotice && resetButton}
              {toggle && <Switch label={item.label} checked={toggle.on} onCheckedChange={(on) => onSet(toggle.write, on)} />}
            </RowAction>
          )}
        </RowLine>
        {item.change && (
          <div data-prop-change="" data-testid="change">
            <span>{item.change.from}</span>
            <span data-prop-arrow="">{" → "}</span>
            <span data-prop-to="">{item.change.to}</span>
            {item.wider && (
              <span data-prop-source="" data-testid="source">
                {" · "}
                {item.source}
              </span>
            )}
          </div>
        )}
      </div>
      {item.explanation && <div data-prop-explain="">{item.explanation}</div>}
      {item.control && !toggle && (
        <ControlView
          key={item.control.kind === "refused" ? "refused" : item.control.key}
          control={item.control}
          label={item.label}
          app={item.change?.from ?? null}
          words={words}
          onSet={onSet}
          onText={onText}
          oneLine={oneLine}
        />
      )}
      {item.current && !item.change && (
        <div data-prop-current="" data-testid="current">
          <span data-prop-lead="">{words.current}</span> <ValueView value={item.current} words={words} />
        </div>
      )}
      {item.held && (
        <div data-prop-held="" data-testid="held">
          {item.held.before} <code>{item.held.value}</code>
          {item.held.middle} <code>{item.held.tried}</code>
          {item.held.after} {reset?.inNotice && resetButton}
        </div>
      )}
      {keeping && (
        <button
          type="button"
          data-prop-keeping=""
          onClick={() => onSelect(keeping.select)}
          // Over, not Enter, as every row of the panel; focus outlines the same.
          onMouseOver={() => onHover(keeping.ids)}
          onMouseLeave={() => onHover([])}
          onFocus={() => onHover(keeping.ids)}
          onBlur={() => onHover([])}
        >
          {keeping.text}
        </button>
      )}
    </Row>
  );
}

/**
 * A closed set of options as chips: the value that shows now in salmon, the app's own
 * value ringed and tagged under an Override, the design system's default with a dot
 * after it, each with its count at a scope; a field for label text; or why neither.
 */
function ControlView({
  control,
  label,
  app,
  words,
  onSet,
  onText,
  oneLine,
}: {
  control: Control;
  label: string;
  app: string | null;
  words: InspectorWords;
  onSet: PropRowProps["onSet"];
  onText: PropRowProps["onText"];
  oneLine: PropRowProps["oneLine"];
}) {
  if (control.kind === "refused") {
    return (
      <div data-prop-refusal="" data-testid={control.refusal}>
        <LockIcon />
        {control.text}
      </div>
    );
  }
  const { write } = control;
  if (control.kind === "text") return <TextField label={label} value={control.value} oneLine={oneLine} set={(text) => onText(write, text)} />;
  // Chips take string values: each option by its type and value, which tells `1` from `"1"`.
  const keyOf = (value: unknown) => `${typeof value}:${String(value)}`;
  const checked = control.options.find((option) => option.pressed);
  return (
    <ChipGroup
      label={label}
      value={checked ? keyOf(checked.value) : null}
      onChoose={(key) => {
        const option = control.options.find((candidate) => keyOf(candidate.value) === key);
        if (option) onSet(write, option.value);
      }}
    >
      {control.options.map((option) => {
        const isApp = option.label === app && !option.pressed;
        const notes = [isApp && words.appValue, option.isDefault && words.designDefault].filter(Boolean).join("; ");
        return (
          <Chip
            key={keyOf(option.value)}
            value={keyOf(option.value)}
            tag={isApp ? words.appTag : undefined}
            dot={option.isDefault}
            count={option.count}
            description={notes || undefined}
            // The exact value and its marks for a pointer; the chip wraps the value in full.
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

/**
 * Label text: one line, no length limit, applied while typing, and it may be left empty.
 * It wraps and grows to its text rather than scrolling. The row shows the prop's name:
 * the field says it to a screen reader.
 */
function TextField({ label, value, oneLine, set }: { label: string; value: string; oneLine?(text: string): string; set(next: string): void }) {
  // The Toolbar redraws once a frame, so the field keeps its own text while it has focus,
  // with the value that text was typed over.
  const [draft, setDraft] = useState<{ text: string; from: string } | null>(null);
  // Something else moved the value (a reset, another scope): drop the draft.
  const stale = draft !== null && value !== draft.from && value !== draft.text;
  if (stale) setDraft(null);
  const text = draft === null || stale ? value : draft.text;
  return (
    <Field
      label={label}
      labelHidden
      look="outline"
      multiline
      autoResize
      rows={1}
      value={text}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onValueChange={(typed) => {
        // The field shows what is written: a pasted line break is a space here as well.
        const next = oneLine ? oneLine(typed) : typed;
        setDraft({ text: next, from: value });
        set(next);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
