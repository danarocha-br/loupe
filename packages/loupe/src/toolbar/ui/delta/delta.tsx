// Delta: the triangle a drawing's revision carries its number in (ADR 0003, DESIGN.md
// "Shapes"). Numbered, it is one image named by its caller ("Change 1"); empty and
// dashed, it repeats in shape what the words beside it say, so it is hidden. No UI SDK
// part fits: it is a picture with a name, not a control. See delta.md.

import type { DataAttributes } from "../data-attributes.js";

type Common = {
  /** More on hover: where the number appears. Never the only place it is said. */
  title?: string;
  className?: string;
} & DataAttributes;

export type DeltaProps = Common &
  (
    | {
        /** The number, set at the triangle's base. */
        n: number;
        /** Its accessible name: the number with what it numbers ("Change 1"); a bare number means nothing. */
        label: string;
      }
    | {
        /** Empty: a dashed triangle with no number, hidden from assistive technology. */
        n?: undefined;
        label?: undefined;
      }
  );

export function Delta({ n, label, title, className, ...rest }: DeltaProps) {
  const numbered = n !== undefined;
  return (
    <span
      {...rest}
      data-delta=""
      data-empty={numbered ? undefined : ""}
      role={numbered ? "img" : undefined}
      aria-label={numbered ? label : undefined}
      aria-hidden={numbered ? undefined : true}
      title={title}
      className={className}
    >
      <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true" focusable="false">
        <path d="M10 1.6 18.6 16.4H1.4Z" strokeLinejoin="round" />
      </svg>
      {numbered && <span data-delta-n="">{n}</span>}
    </span>
  );
}
