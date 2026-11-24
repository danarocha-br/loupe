// Card: the surface the sheet's content stands on (ADR 0003). Presentational: a `div` in
// the card's white, its corners and its lift, padded by its look. No UI SDK part fits,
// and none is needed. It takes no heading: the view puts its own, at its own level, in
// CardHead. See card.md.

import type { ReactNode, Ref } from "react";
import type { DataAttributes } from "../data-attributes.js";

/**
 * `plain`: padded, its parts 10px apart. `list`: no side padding, so the rows in it run
 * edge to edge; its head keeps the text's 14px. `divided`: no padding at all, each part
 * after the first on a 1px hairline.
 */
export type CardLook = "plain" | "list" | "divided";

export type CardProps = {
  look?: CardLook;
  /** The card's element, for a view that moves focus within it. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
  children: ReactNode;
} & DataAttributes;

export type CardHeadProps = {
  className?: string;
  children: ReactNode;
} & DataAttributes;

export function Card({ look = "plain", ref, className, children, ...rest }: CardProps) {
  return (
    <div {...rest} ref={ref} data-card={look} className={className}>
      {children}
    </div>
  );
}

/**
 * The card's head: its title at the left, what counts it at the right, on one baseline.
 * Not a heading: the view puts its own `h2` or `h3` (or plain words) inside.
 */
export function CardHead({ className, children, ...rest }: CardHeadProps) {
  return (
    <div {...rest} data-card-head="" className={className}>
      {children}
    </div>
  );
}
