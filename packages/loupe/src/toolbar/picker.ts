// Selecting by clicking the page. Only while Pick is on: otherwise the Toolbar
// never touches the page's events, so the page keeps its own behaviour.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { useEscape } from "./escape.js";
import { scopeView } from "./panel-view/scopes.js";
import type { Member } from "./panel-view/types.js";
import { PICK_INSPECT_ONLY, pickCount } from "./panel-view/words.js";

/**
 * The header's select tool, the way Figma selects (2026-11-20): one Instance, or
 * every Instance from its call site. It is the scope a selection opens at, kept
 * for the page load and never stored.
 */
export type SelectMode = "one" | "many";

/**
 * The Instance under the pointer while picking, as a store rather than state: a
 * move redraws the outline (`useHovered`), never the panel.
 */
export type Hovered = { get(): string | null; subscribe(listener: () => void): () => void };

export type Picker = {
  picking: boolean;
  hovered: Hovered;
  start(): void;
  stop(): void;
};

/** No Instance under the pointer, ever: what the outline reads while nothing is picking. */
export const NOT_PICKING: Hovered = { get: () => null, subscribe: () => () => {} };

/** The Instance under the pointer. A store's change renders at once, before the frame is painted. */
export function useHovered(hovered: Hovered): string | null {
  return useSyncExternalStore(hovered.subscribe, hovered.get, hovered.get);
}

function hoveredStore(): Hovered & { set(id: string | null): void } {
  let current: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(id) {
      if (id === current) return;
      current = id;
      for (const listener of listeners) listener();
    },
  };
}

// Pressing a menu trigger opens it on `pointerdown` or `mousedown`, before any
// `click`, so all of them stop at the window while picking.
const SWALLOWED = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick", "contextmenu"] as const;

export function usePicker(debug: LoupeDebug, host: Element, onPicked: (id: string) => void): Picker {
  const [picking, setPicking] = useState(false);
  // An inline function: React Compiler skips a hook whose useMemo takes a reference.
  const hovered = useMemo(() => hoveredStore(), []);
  const picked = useRef(onPicked);
  useEffect(() => {
    picked.current = onPicked;
  });

  const stop = useCallback(() => {
    setPicking(false);
    hovered.set(null);
  }, [hovered]);

  useEffect(() => {
    if (!picking) return;
    const fromToolbar = (event: Event) => event.composedPath().includes(host);
    const targetOf = (event: Event): Element | null => {
      const target = event.composedPath()[0];
      return target instanceof Element ? target : null;
    };
    // `pick` walks the whole fiber tree, so at most once a frame, and only once the
    // pointer is over another element. Over the panel, nothing on the page is hovered.
    let frame = 0;
    let latest: Element | null = null;
    let shown: Element | null = null;
    const onMove = (event: PointerEvent) => {
      latest = fromToolbar(event) ? null : targetOf(event);
      if (frame !== 0 || latest === shown) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        shown = latest;
        hovered.set(latest ? debug.pick(latest) : null);
      });
    };
    // Leaving the window leaves the page.
    const onOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      cancelAnimationFrame(frame);
      frame = 0;
      latest = shown = null;
      hovered.set(null);
    };
    const swallow = (event: Event) => {
      if (fromToolbar(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.type !== "click") return;
      const target = targetOf(event);
      const id = target ? debug.pick(target) : null;
      if (id === null) return;
      picked.current(id);
      stop();
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerout", onOut, true);
    for (const type of SWALLOWED) window.addEventListener(type, swallow, true);
    const cursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = "crosshair";
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerout", onOut, true);
      for (const type of SWALLOWED) window.removeEventListener(type, swallow, true);
      document.documentElement.style.cursor = cursor;
    };
  }, [picking, debug, host, hovered, stop]);

  // Esc ends picking, and stops there: the app never hears it (escape.ts).
  useEscape("picking", picking, (event) => {
    event.stopPropagation();
    stop();
  });

  return { picking, hovered, start: () => setPicking(true), stop };
}

/** What a click on the hovered Instance would select, and what its tag says. */
export type PickPreview = {
  id: string;
  /** Who the click selects: the Instance, or in Select multiple every one from its call site, left-out ones dashed. */
  members: Member[];
  /** The component: "Button". */
  name: string;
  /** "4 from this call site" when a click selects the call site; "Inspect only" when no Override can reach it. */
  detail: string | null;
};

/**
 * What a click would select, the way the panel will scope it: Select multiple
 * opens at the call site only for an Instance an Override can reach (an adapted
 * one, with Overrides on, at an anchored call site); any other opens alone.
 */
export function pickPreview(debug: LoupeDebug, id: string, mode: SelectMode): PickPreview | null {
  const rows = debug.list();
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) return null;
  const alone: PickPreview = { id, members: [{ id, out: false }], name: row.component, detail: row.editable ? null : PICK_INSPECT_ONLY };
  if (mode === "one" || !row.adapted || !debug.status.overrides) return alone;
  const group = scopeView(rows, debug.records(), row, "group");
  if (group === null || group.members.length === 0) return alone;
  return { ...alone, members: group.members, detail: pickCount(group.members.length) };
}
