// Selecting by clicking the page. Only while Pick is on: otherwise the Toolbar
// never touches the page's events, so the page keeps its own behaviour.

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";

export type Picker = {
  picking: boolean;
  /** The Instance under the pointer while picking. */
  hovered: string | null;
  toggle(): void;
  stop(): void;
};

// Pressing a menu trigger opens it on `pointerdown` or `mousedown`, before any
// `click`, so all of them stop at the window while picking.
const SWALLOWED = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick", "contextmenu"] as const;

export function usePicker(debug: LoupeDebug, host: Element, onPicked: (id: string) => void): Picker {
  const [picking, setPicking] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const picked = useRef(onPicked);
  useEffect(() => {
    picked.current = onPicked;
  });

  const stop = useCallback(() => {
    setPicking(false);
    setHovered(null);
  }, []);

  useEffect(() => {
    if (!picking) return;
    const fromToolbar = (event: Event) => event.composedPath().includes(host);
    const targetOf = (event: Event): Element | null => {
      const target = event.composedPath()[0];
      return target instanceof Element ? target : null;
    };
    // `pick` can walk the whole fiber tree, so at most once a frame.
    let frame = 0;
    let latest: Element | null = null;
    const onMove = (event: PointerEvent) => {
      if (fromToolbar(event)) return;
      latest = targetOf(event);
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setHovered(latest ? debug.pick(latest) : null);
      });
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      stop();
    };
    window.addEventListener("pointermove", onMove, true);
    for (const type of SWALLOWED) window.addEventListener(type, swallow, true);
    window.addEventListener("keydown", onKey, true);
    const cursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = "crosshair";
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove, true);
      for (const type of SWALLOWED) window.removeEventListener(type, swallow, true);
      window.removeEventListener("keydown", onKey, true);
      document.documentElement.style.cursor = cursor;
    };
  }, [picking, debug, host, stop]);

  return { picking, hovered, toggle: () => (picking ? stop() : setPicking(true)), stop };
}
