// The peek: holding Alt (Option on a Mac) makes the panel see-through, so what runs under
// it shows: an app's own dialog or toast is fixed to the viewport, not to the page the
// panel's column narrows.
//
// Only a lone Alt (2026-11-26, the frontend review). Alt is also half of other people's
// keys: Loupe's own Alt+Shift+L, the system's Alt+Tab, and Option-typing on a Mac, where
// Option+E starts an accent in the app's field. So the peek waits a moment for Alt to
// stay alone: another key or a pointer button, held already or pressed during the wait,
// the window losing focus or the tab going hidden calls it off before it shows, and a
// chord's next key comes sooner than the wait, so the panel never flashes. Once it shows it is what it was: on while Alt is held,
// letting clicks through, off on release; another key, a blur or a hidden tab end it too.

import { useEffect, useState } from "react";
import { inTextField } from "./deselect.js";

/** How long Alt is held alone before the panel peeks, in ms: longer than the gap between a chord's keys. */
export const PEEK_DELAY = 200;

/** The keys that only change another: held with Alt, the events' own flags say so, or they say nothing a peek needs. */
const MODIFIERS = new Set(["Alt", "AltGraph", "Shift", "Control", "Meta", "OS", "CapsLock", "Fn", "FnLock", "Hyper", "Super", "Symbol", "SymbolLock", "NumLock", "ScrollLock"]);

/** The focused element, looking through shadow roots: a field in Loupe's own panel included. */
function deepActive(): Element | null {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}

/** Whether the panel peeks: a lone Alt held for `PEEK_DELAY`, outside a text field, and not yet released. */
export function usePeek(): boolean {
  const [peeking, setPeeking] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The other keys held, by physical key, and the pointers pressed, by id: an Alt that joins
    // either is the app's (Space+Alt on a canvas, Alt-drag, Alt-click, a second finger).
    const keys = new Set<string>();
    const pointers = new Set<number>();
    const wait = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const cancel = () => {
      wait();
      setPeeking(false);
    };
    const down = (event: KeyboardEvent) => {
      if (event.key !== "Alt") {
        // Any other key makes the Alt a chord's.
        if (!MODIFIERS.has(event.key)) keys.add(event.code || event.key);
        return cancel();
      }
      // A held Alt repeats on some systems: it never starts the wait again, nor revives a peek called off.
      if (event.repeat) return;
      cancel();
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.isComposing || keys.size > 0 || pointers.size > 0) return;
      // Option-typing in a field, the app's or Loupe's own: the Alt is the field's.
      if (inTextField(event.composedPath()[0])) return;
      timer = setTimeout(() => {
        timer = undefined;
        // The app can move focus to a field during the wait, a dialog's autofocus: the Alt is that field's now.
        if (inTextField(deepActive() ?? undefined)) return;
        setPeeking(true);
      }, PEEK_DELAY);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") return cancel();
      keys.delete(event.code || event.key);
      // macOS sends no keyup for a key let go while Cmd is held: Cmd's own keyup is the last word on them.
      if (event.key === "Meta") keys.clear();
    };
    const press = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      // Before the peek shows, a press calls it off; once it shows, clicks go through it to the page.
      wait();
    };
    const release = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
    };
    // Alt+Tab, or a click into another window: the Alt's keyup goes elsewhere, so it would never end,
    // and so do the keyups and pointerups of anything else held.
    const hidden = () => {
      keys.clear();
      pointers.clear();
      cancel();
    };
    // Capture, so an app's handler that stops the key doesn't hide it from Loupe.
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", hidden);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", hidden);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  return peeking;
}
