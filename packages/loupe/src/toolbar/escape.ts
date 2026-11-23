// Esc at the window, in one place (ADR 0003, "Esc between layers"). Four of Loupe's
// layers answer it: picking, Copy Proposal's popover, focus on loan from the page (the
// Alt+Shift+L shortcut, `shortcut.ts`) and the selection. Each claims
// Esc while it is up, and one key press goes to the topmost claim that takes it, so
// none has to look for another in the DOM. UI SDK's popups keep their own Esc; the
// app keeps every Esc no claim takes.

import { useEffect, useRef } from "react";

/**
 * The layers, topmost first: picking ends before a popover closes, a popover before focus
 * goes back to the page, and that before the selection goes: the more passing a state, the sooner Esc ends it.
 */
const ORDER = ["picking", "popover", "focus", "selection"] as const;

export type EscapeLayer = (typeof ORDER)[number];

/** Takes the key, or declines it (returns false) so the next layer down, or the app, has it. */
export type EscapeHandler = (event: KeyboardEvent) => boolean | void;

const claims = new Map<EscapeLayer, Set<{ current: EscapeHandler }>>();

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.isComposing) return;
  for (const layer of ORDER) {
    for (const handler of claims.get(layer) ?? []) {
      if (handler.current(event) !== false) return;
    }
  }
}

function claim(layer: EscapeLayer, handler: { current: EscapeHandler }): () => void {
  const first = [...claims.values()].every((set) => set.size === 0);
  let set = claims.get(layer);
  if (!set) {
    set = new Set();
    claims.set(layer, set);
  }
  set.add(handler);
  // Capture, so an app's handler that stops the key doesn't hide it from Loupe.
  if (first) window.addEventListener("keydown", onKeyDown, true);
  return () => {
    set.delete(handler);
    if ([...claims.values()].every((each) => each.size === 0)) window.removeEventListener("keydown", onKeyDown, true);
  };
}

/** Claims Esc for `layer` while `active`. The handler is read when the key comes, so it may change every render. */
export function useEscape(layer: EscapeLayer, active: boolean, handler: EscapeHandler): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    return claim(layer, latest);
  }, [layer, active]);
}
