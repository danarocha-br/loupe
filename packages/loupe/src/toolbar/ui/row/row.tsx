// Row: a line inside a card (ADR 0003): an optional glyph in a fixed 20px column, then a
// line of its name, its value and a trailing action, then whatever sits under the line.
// Presentational: no UI SDK part fits, and none is needed. A parent with child parts,
// so the caller places its marks and tags between them. See row.md.

import type { AriaRole, ReactNode } from "react";
import type { DataAttributes } from "../data-attributes.js";

/**
 * `inset`: padded 14px, for a card with no padding of its own (the divided card, which
 * draws the hairline). `ruled`: a hairline above, padded only above and below, for a
 * padded card. `pair`: ruled and tight, its line a name and a value in two mono columns.
 */
export type RowLook = "inset" | "ruled" | "pair";

export type RowProps = {
  look?: RowLook;
  /** A 20px glyph in a column of its own, so the names line up whatever the glyph. Hidden from assistive technology. */
  glyph?: ReactNode;
  /** `li` in a list. */
  as?: "div" | "li";
  /** The view's, when the row is more than a line: a `note`. */
  role?: AriaRole;
  className?: string;
  children: ReactNode;
} & DataAttributes;

type Part = {
  /** More than the words say, on hover. Never the only place something is said. */
  title?: string;
  className?: string;
  children: ReactNode;
} & DataAttributes;

export type RowNameProps = Part & {
  /** The name as written in code, faint and mono, after the name; hidden in a `pair`. */
  code?: string;
  /** Set in mono: the name is code itself (a flag's key). */
  mono?: boolean;
};

export function Row({ look = "inset", glyph, as: Element = "div", role, className, children, ...rest }: RowProps) {
  return (
    <Element {...rest} role={role} data-row={look} data-glyphed={glyph === undefined ? undefined : ""} className={className}>
      {glyph !== undefined && (
        <span data-row-glyph="" aria-hidden="true">
          {glyph}
        </span>
      )}
      {children}
    </Element>
  );
}

/** The row's line: its name, what qualifies it, its value and its action, wrapping when they don't fit. */
export function RowLine({ title, className, children, ...rest }: Part) {
  return (
    <div {...rest} data-row-line="" title={title} className={className}>
      {children}
    </div>
  );
}

export function RowName({ code, mono, title, className, children, ...rest }: RowNameProps) {
  return (
    <span {...rest} data-row-name="" data-mono={mono ? "" : undefined} title={title} className={className}>
      <span>{children}</span>
      {code && <span data-row-code=""> {code}</span>}
    </span>
  );
}

/** The value, at the line's right in mono: what the row reads now. */
export function RowValue({ title, className, children, ...rest }: Part) {
  return (
    <span {...rest} data-row-value="" title={title} className={className}>
      {children}
    </span>
  );
}

/** What acts on the row, at the line's right edge: a reset, a switch. */
export function RowAction({ className, children, ...rest }: Omit<Part, "title">) {
  return (
    <span {...rest} data-row-action="" className={className}>
      {children}
    </span>
  );
}
