// Tag: a few words that qualify what they sit beside, as a pill (ADR 0003). Presentational:
// a `span` with its words, which a screen reader reads where they stand. No UI SDK part
// fits, and none is needed. See tag.md.

import type { ReactNode } from "react";
import type { DataAttributes } from "../data-attributes.js";

/**
 * `plain`: a `sunk` pill, 11px muted. `reason`: why, quoted in 10px mono, its detail in
 * the title. `picked`: chosen, in the accent's wash. `amber`: out of date. `ring`: held
 * aside, a pencil ring. `dashed`: not there now. `empty`: nothing written, dashed in ink.
 */
export type TagLook = "plain" | "reason" | "picked" | "amber" | "ring" | "dashed" | "empty";

export type TagProps = {
  look?: TagLook;
  /** More than the words say, on hover. Never the only place something is said. */
  title?: string;
  className?: string;
  children: ReactNode;
} & DataAttributes;

export function Tag({ look = "plain", title, className, children, ...rest }: TagProps) {
  return (
    <span {...rest} data-tag-look={look} title={title} className={className}>
      {children}
    </span>
  );
}
