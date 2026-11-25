// Popover: a non-modal box over what opened it, pointing at it with a caret (ADR 0003).
// UI SDK's `popover`, in place in the DOM and in the browser's top layer, behind Loupe's
// own interface: the root owns the open state's dismissal (Escape, a press or focus
// outside), the panel its place, its caret and where focus goes. See popover.md.

import { PopoverContent, Popover as SdkPopover } from "@ui-sdk/react/popover";
import { createContext, type CSSProperties, type ReactNode, type RefObject, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DataAttributes } from "../data-attributes.js";

export type PopoverProps = {
  open: boolean;
  /** Escape or a press or focus outside asks to close it. The caller keeps the state. */
  onOpenChange(open: boolean): void;
  /**
   * Counts as inside: a press or focus here doesn't close it. The control that toggles
   * it, which opens and closes it itself.
   */
  inside?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

/** Where the caret sits along the panel's foot: under its middle, or near its end. */
export type PopoverCaret = "center" | "end";

export type PopoverPanelProps = {
  /** The dialog's accessible name. */
  label: string;
  /** What it stands over: above it, as wide as it less 8px a side. Read as it opens. */
  anchor: RefObject<HTMLElement | null>;
  /** Where focus goes back when it closes with focus inside: what opened it. */
  returnFocus: RefObject<HTMLElement | null>;
  /** Focused as it opens; the first focusable element inside without it. Either way, a field's text is not selected. */
  initialFocus?: RefObject<HTMLElement | null>;
  caret?: PopoverCaret;
  className?: string;
  children: ReactNode;
} & DataAttributes;

/** Whether an event happened on `element` or inside it, across shadow roots. */
function on(event: Event | undefined, element: HTMLElement | null): boolean {
  if (!event || !element) return false;
  if (event.composedPath().includes(element)) return true;
  const related = (event as FocusEvent).relatedTarget;
  return related instanceof Node && element.contains(related);
}

/** Whether the root is open, for the panel to read its anchor as it opens. */
const Open = createContext(false);

export function Popover({ open, onOpenChange, inside, children }: PopoverProps) {
  return (
    <Open value={open}>
      <SdkPopover
        open={open}
        onOpenChange={(next, details) => {
          // Escape still closes it from `inside`: only a press or focus there isn't leaving.
          const leaving = details.reason === "outside-press" || details.reason === "focus-out";
          if (!next && leaving && on(details.event as Event | undefined, inside?.current ?? null)) return details.cancel();
          onOpenChange(next);
        }}
      >
        {children}
      </SdkPopover>
    </Open>
  );
}

/** What the box stands over, and that element's width, which the box takes less its insets. */
type Over = { element: HTMLElement; width: number };

/**
 * The anchor's border-box width in its own CSS pixels, which is what the box's CSS width
 * means. Its client rect is drawn at whatever zoom or transform is around it, and the box,
 * inside the same, would be scaled twice. Fractional where the computed width is the laid-out
 * one; `offsetWidth` where it isn't (`auto` on an inline element), as UI SDK checks its own.
 */
function layoutWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const px = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
  const edges = style.boxSizing === "border-box" ? 0 : px("padding-left") + px("padding-right") + px("border-left-width") + px("border-right-width");
  const width = parseFloat(style.width) + edges;
  return Math.abs(width - element.offsetWidth) < 1 ? width : element.offsetWidth;
}

/** `element` as it measures now: `last` itself while that hasn't changed, so React skips the render. */
function measure(last: Over | null, element: HTMLElement): Over {
  const width = layoutWidth(element);
  return last?.element === element && last.width === width ? last : { element, width };
}

/** The box: a dialog over its anchor, with a caret on its foot. Mounted only while open. */
export function PopoverPanel({ label, anchor, returnFocus, initialFocus, caret = "center", className, children, ...data }: PopoverPanelProps) {
  // Read as it opens, before paint: an anchor around the panel has no element yet when the panel mounts.
  // Its width comes in the same render, and the box mounts only once both are known: UI SDK
  // places it as it mounts, and again only on its next frame, which a throttled tab may not
  // run for a second. Mounted sooner, the box stood at the viewport's corner until then; sized
  // by UI SDK's `--anchor-width`, which comes after that first measure, it stood off-centre.
  // Each open measures afresh: what was read last time is cleared as it closes, since the
  // anchor may have changed width since then with nothing yet observed.
  const open = useContext(Open);
  const [over, setOver] = useState<Over | null>(null);
  useLayoutEffect(() => {
    const element = open ? anchor.current : null;
    if (!element) {
      setOver(null);
      return;
    }
    setOver((last) => measure(last, element));
    // While it is open, the width follows the anchor.
    if (typeof ResizeObserver === "undefined") return;
    const resize = new ResizeObserver(() => setOver((last) => (last?.element === element ? measure(last, element) : last)));
    resize.observe(element);
    return () => resize.disconnect();
  }, [open, anchor]);
  const box = useRef<HTMLDivElement>(null);
  if (!over) return null;
  return (
    <PopoverContent
      {...data}
      side="top"
      align="center"
      sideOffset={10}
      anchor={over.element}
      style={{ "--popover-anchor-width": `${over.width}px` } as CSSProperties}
      // UI SDK selects a text field's value as it focuses it: the panel focuses its own.
      initialFocus="none"
      finalFocus={() => returnFocus.current}
      aria-label={label}
      className={className}
      data-popover=""
      data-caret={caret}
      ref={box}
    >
      <Focus target={initialFocus} box={box} />
      {children}
      <svg data-popover-caret="" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
        <path data-caret-fill="" d="M0 0H22L11 11Z" />
        <path data-caret-edge="" d="M0.5 0L11 10.5L21.5 0" />
      </svg>
    </PopoverContent>
  );
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Focuses `target`, else the first focusable thing in the box, else the box, as the content mounts: as it opens. */
function Focus({ target, box }: { target?: RefObject<HTMLElement | null>; box: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const element = target?.current ?? box.current?.querySelector<HTMLElement>(FOCUSABLE) ?? box.current;
    element?.focus();
  }, [target, box]);
  return null;
}
