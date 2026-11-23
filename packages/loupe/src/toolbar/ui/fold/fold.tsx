// Fold: a row that shows and hides what's under it (ADR 0003). A disclosure on UI SDK's
// `collapsible`, behind Loupe's own interface: the Fold owns the open state, the
// trigger's ARIA and its keys; the caller owns the trigger's and the panel's content.
// See fold.md.

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type DataAttributes = { [name: `data-${string}`]: string | undefined };

export type FoldProps = {
  /** Open now: pass it, with `onOpenChange`, to keep the state yourself. */
  open?: boolean;
  /** Open at first, when the Fold keeps its own state. */
  defaultOpen?: boolean;
  onOpenChange?(open: boolean): void;
  className?: string;
  children: ReactNode;
} & DataAttributes;

export type FoldTriggerProps = Omit<ComponentPropsWithoutRef<"button">, "type" | "className" | "children"> & {
  /** Sits in a line of other controls at its own width, instead of filling the row. */
  inline?: boolean;
  className?: string;
  children: ReactNode;
} & DataAttributes;

/**
 * No class: the panel's box is the Fold's. Closed, it is `hidden="until-found"`, which
 * keeps its box in the layout (content-visibility, not display), so padding, a border or
 * a gap of the caller's would show under a closed row. Style an element inside it.
 */
export type FoldPanelProps = Omit<ComponentPropsWithoutRef<"div">, "className" | "style" | "children" | "hidden"> & {
  children: ReactNode;
} & DataAttributes;

export function Fold({ open, defaultOpen, onOpenChange, className, children, ...data }: FoldProps) {
  const state = open === undefined ? { defaultOpen } : { open };
  return (
    <Collapsible {...data} {...state} onOpenChange={(next) => onOpenChange?.(next)} className={className} data-fold="">
      {children}
    </Collapsible>
  );
}

/** The row that opens and closes the Fold: a native button that says whether it's open. */
export function FoldTrigger({ inline, className, children, ...rest }: FoldTriggerProps) {
  return (
    <CollapsibleTrigger {...rest} className={className} data-fold-trigger="" data-inline={inline ? "" : undefined}>
      {children}
    </CollapsibleTrigger>
  );
}

/**
 * What the Fold shows. Closed, it stays in the page, hidden until found, as a closed
 * `<details>` does: the browser's find in page opens it, and its content keeps its state.
 */
export function FoldPanel({ children, ...rest }: FoldPanelProps) {
  return (
    <CollapsiblePanel {...rest} hiddenUntilFound data-fold-panel="">
      {children}
    </CollapsiblePanel>
  );
}

/** The chevron every fold says it opens with: it points at the row closed, and down open. */
export function FoldChevron() {
  return (
    <svg
      data-fold-chevron=""
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
