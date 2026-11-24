// Marks (ADR 0003, DESIGN.md "Layers"): the small marks the Inspector's patterns and the
// list share. A change's delta and an Instance's row of them, a held State prop's empty
// delta, a verdict's status chip, a tag in panel-view's words, a name that breaks only
// between its words, a held record's values, a card title that leads with a dot, and the
// count beside a card's title. Primitives composed: Delta, Dot, Tag and the check icon. A
// component's hue is CSS alone (`[data-hue]`). And `hovering()`, the handlers that outline
// what a row names on the page while it is pointed at or focused. See marks.md.

import { Fragment, type ReactNode } from "react";
import type { InspectorWords, StatusText, Tag as TagText } from "../../panel-view/index.js";
import { CheckIcon, Delta, Dot, type DotTone, Tag, type TagLook } from "../../ui/index.js";

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

/** One change's revision delta, with the number the Proposal's change id shows: read as "Change 1", never a bare "1". */
export function ChangeKey({ n, words }: { n: number; words: Pick<InspectorWords, "change"> }) {
  const { label, title } = words.change(n);
  return <Delta n={n} label={label} title={title} />;
}

/** A held State prop's mark: an empty dashed delta, since the Proposal shows it as a state, not a numbered change. */
export function HeldKey({ words }: { words: Pick<InspectorWords, "heldTitle"> }) {
  return <Delta title={words.heldTitle} />;
}

/** An Instance's or a row's change numbers, side by side; nothing when none reach it. */
export function Keys({ keys, words }: { keys: readonly number[]; words: Pick<InspectorWords, "change"> }) {
  if (keys.length === 0) return null;
  return (
    <span data-keys="">
      {keys.map((n) => (
        <ChangeKey key={n} n={n} words={words} />
      ))}
    </span>
  );
}

/** A status in words: a verdict, or a plain one ("Not on the page now") when it has no kind. panel-view's `StatusText`. */
export type Status = StatusText;

/** A verdict in words. Supported is the rule, so the list says only the exceptions; `check` leads Supported with a tick. */
export function StatusChip({ status, title, check }: { status: Status; title?: string | null; check?: boolean }) {
  return (
    <span data-status={status.kind ?? "plain"} title={title ?? undefined}>
      {check && status.kind === "supported" && <CheckIcon />}
      {status.text}
    </span>
  );
}

const TAG_LOOK: Record<TagText["kind"], TagLook> = {
  server: "plain",
  suspended: "ring",
  "not-mounted": "dashed",
  stale: "amber",
  "left-out": "plain",
  "left-out-unmounted": "dashed",
  "not-visible": "dashed",
};

/** One of panel-view's tags, in the look its kind takes: dashed for what isn't there now, amber for out of date. */
export function TagChip({ tag }: { tag: TagText }) {
  return <Tag look={TAG_LOOK[tag.kind]}>{tag.text}</Tag>;
}

/** A held record's values, a line each, in small mono: what it would set, beside what the app last showed. */
export function HeldValues({ values }: { values: readonly string[] }) {
  return (
    <ul data-held-values="" data-testid="held-values">
      {values.map((value, index) => (
        <li key={index}>{value}</li>
      ))}
    </ul>
  );
}

/** What counts a card's title, at the head's right: "9 components · 43 Instances", "2 · apply to nothing". */
export function Meta({ children }: { children: ReactNode }) {
  return <span data-meta="">{children}</span>;
}

/** A card's title that leads with a dot: the notice's tone, the held record's ring. Its words may be a heading. */
export function DotTitle({ tone, children }: { tone: DotTone; children: ReactNode }) {
  return (
    <div data-dot-title="">
      {/* Dot's props are a union, a ring taking no size: each branch names its own. */}
      {tone === "ring" ? <Dot tone="ring" /> : <Dot tone={tone} />}
      {children}
    </div>
  );
}

/**
 * Pointing at or focusing what names some Instances outlines them on the page, and leaving
 * it clears them. Spread on the element: `onMouseOver`, never `onMouseEnter`, which React
 * drops for a pointer that comes straight from an App Router page.
 */
export function hovering(onHover: (ids: string[]) => void, ids: string[]) {
  return {
    onMouseOver: () => onHover(ids),
    onMouseLeave: () => onHover([]),
    onFocus: () => onHover(ids),
    onBlur: () => onHover([]),
  };
}
