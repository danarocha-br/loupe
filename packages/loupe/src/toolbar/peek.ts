// The peek: holding Alt (Option on a Mac) makes the panel see-through, so what runs under
// it shows: an app's own dialog or toast is fixed to the viewport, not to the page the
// panel's column narrows.
//
// Only a lone Alt (2026-11-26, the frontend review). Alt is also half of other people's
// keys: Loupe's own Alt+Shift+L, the system's Alt+Tab, and Option-typing on a Mac, where
// Option+E starts an accent in the app's field. So the peek waits a moment for Alt to
// stay alone: another key, a pointer button, the window losing focus or the tab going
// hidden calls it off before it shows, and a chord's next key comes sooner than the wait,
// so the panel never flashes. Once it shows it is what it was: on while Alt is held,
// letting clicks through, off on release; another key, a blur or a hidden tab end it too.

import { useEffect, useState } from "react";
import { inTextField } from "./deselect.js";

/** How long Alt is held alone before the panel peeks, in ms: longer than the gap between a chord's keys. */
export const PEEK_DELAY = 200;

/** Whether the panel peeks: a lone Alt held for `PEEK_DELAY`, outside a text field, and not yet released. */
export function usePeek(): boolean {
  const [peeking, setPeeking] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A pointer button held: an Alt pressed during a drag or a press is the app's (Alt-drag, Alt-click).
    let pressing = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
      setPeeking(false);
    };
    const down = (event: KeyboardEvent) => {
      // Any other key makes the Alt a chord's.
      if (event.key !== "Alt") return cancel();
      // A held Alt repeats on some systems: it never starts the wait again, nor revives a peek called off.
      if (event.repeat) return;
      cancel();
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.isComposing || pressing) return;
      // Option-typing in a field, the app's or Loupe's own: the Alt is the field's.
      if (inTextField(event.composedPath()[0])) return;
      timer = setTimeout(() => {
        timer = undefined;
        setPeeking(true);
      }, PEEK_DELAY);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") cancel();
    };
    const press = () => {
      pressing = true;
      // Before the peek shows, a press calls it off; once it shows, clicks go through it to the page.
      clearTimeout(timer);
      timer = undefined;
    };
    const release = () => {
      pressing = false;
    };
    // Alt+Tab, or a click into another window: the Alt's keyup goes elsewhere, so it would never end.
    const hidden = () => {
      pressing = false;
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
