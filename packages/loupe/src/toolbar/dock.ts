// The panel's column (critique 2026-11-19, P0): while the panel is open, the page
// gives it a column on the right, so the panel never covers the product it
// inspects. The page reflows into what is left, as it would beside DevTools. A
// viewport too narrow for both overlays the panel instead.
//
// The column is the root's right margin, set inline while the panel is open and
// put back as it was when it closes. The Proposal's viewport is the width the
// page is laid out at, so it reads `pageWidth()`.

import { useEffect, useLayoutEffect, useState } from "react";

/** The panel's width, and from `WIDE` on a little more. */
const WIDTH = 360;
const WIDE_WIDTH = 400;
const WIDE = 1600;
/** Below this many panel widths, the page keeps the whole viewport and the panel overlays it. */
const ROOM = 2;

let reserved = 0;

/** The column the page gives the panel now, in CSS pixels: 0 while it overlays or is hidden. */
export function reservedWidth(): number {
  return reserved;
}

/** The width the page is laid out at: the viewport less the panel's column. */
export function pageWidth(): number {
  return typeof window === "undefined" ? 0 : Math.max(0, window.innerWidth - reserved);
}

export type Column = { width: number; docked: boolean };

/**
 * The panel's width for a viewport, and whether the page makes room for it. Never
 * wider than the viewport: at 320px (WCAG 1.4.10) it overlays the whole width.
 */
export function columnFor(viewport: number): Column {
  const width = Math.min(viewport >= WIDE ? WIDE_WIDTH : WIDTH, viewport);
  return { width, docked: viewport >= width * ROOM };
}

/** Puts the root's right margin back as it was; null while nothing is reserved. */
let restore: (() => void) | null = null;

/**
 * Takes `width` px of the page for the panel's column, now: called from the click that
 * opens the panel, before it renders, so nothing measures the page at its full width.
 * Idempotent; a second call with another width (the viewport crossed `WIDE`) just resizes it.
 */
export function reserveColumn(width: number): void {
  if (typeof document === "undefined" || width === 0) return;
  const root = document.documentElement;
  if (restore === null) {
    const before = root.style.getPropertyValue("margin-right");
    const priority = root.style.getPropertyPriority("margin-right");
    restore = () => {
      if (before === "") root.style.removeProperty("margin-right");
      else root.style.setProperty("margin-right", before, priority);
    };
  }
  root.style.setProperty("margin-right", `${width}px`);
  reserved = width;
}

/** Gives the column back, now: called in the same callback that unmounts the panel. */
export function releaseColumn(): void {
  restore?.();
  restore = null;
  reserved = 0;
}

/** The column a viewport this wide gives the panel: 0 where the panel overlays it. */
export function columnWidthFor(viewport: number): number {
  const column = columnFor(viewport);
  return column.docked ? column.width : 0;
}

/**
 * Reserves the column while `open`; returns the panel's width and whether it is docked.
 * In a layout effect, so the page has its new width before the frame is painted.
 */
export function useColumn(open: boolean): Column {
  const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const column = columnFor(viewport);
  const margin = open && column.docked ? column.width : 0;
  useLayoutEffect(() => {
    if (margin === 0) return;
    reserveColumn(margin);
    return releaseColumn;
  }, [margin]);
  return column;
}
