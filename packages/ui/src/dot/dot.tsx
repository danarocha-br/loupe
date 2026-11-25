// Dot: a small round mark beside words that say what it marks (ADR 0003). Presentational:
// no UI SDK part fits, and none is needed. Always `aria-hidden`: the words beside it carry
// its meaning, so a screen reader hears them and nobody needs the colour. See dot.md.

import type { DataAttributes } from "../data-attributes.js";

/**
 * `alert`: a failure, in alert orange. `amber`: a warning. `lilac`: on, in the revision
 * colour (a flag previewing). `hollow`: off, an empty ring. `ring`: held aside, a 10px pencil ring.
 */
export type DotTone = "alert" | "amber" | "lilac" | "hollow" | "ring";

type DotCommon = {
  className?: string;
} & DataAttributes;

export type DotProps = DotCommon &
  (
    | {
        tone: Exclude<DotTone, "ring">;
        /** 6px rather than 8px. */
        small?: boolean;
      }
    // A ring is always 10px: a size it can't take is a type error, not a prop quietly dropped.
    | { tone: "ring"; small?: never }
  );

export function Dot({ tone, small, className, ...rest }: DotProps) {
  return <span {...rest} aria-hidden="true" data-dot={tone} data-small={small ? "" : undefined} className={className} />;
}
