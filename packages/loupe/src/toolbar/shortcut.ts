// The keyboard's way into Loupe (2026-11-23, the architecture review): the toolbar's host is
// the last element in <body>, so without a shortcut a keyboard reaches it only after
// tabbing through the whole page. Alt+Shift+L moves focus to the toolbar, to its pill while
// collapsed and to the panel's heading while open (where Show and Hide already put it);
// the same keys again, or Esc, give it back to the element it came from.
//
// Why these keys (ADR 0006): the host app's own keys come first, so it is a combination
// nothing common uses. No Ctrl or Cmd chord (the browser's and the page's), no bare Alt
// (Windows' menus), no Ctrl+Option (VoiceOver's modifier), nothing on Insert or CapsLock
// (NVDA's, JAWS's and Narrator's). Chrome's Alt+Shift chords are I, A and N and Firefox's
// accesskeys need a page that sets one; L, for Loupe, is free. It is read from the
// physical key (`code`), so Option's special characters on a Mac and other layouts don't move it.

import { useCallback, useEffect, useRef, useState } from "react";
import { inTextField } from "./deselect.js";
import { useEscape } from "./escape.js";

/** The shortcut for assistive technology: `aria-keyshortcuts`'s own spelling. */
export const SHORTCUT_ARIA = "Alt+Shift+L";

function onApple(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform);
}

/** What a designer reads: "⌥⇧L" on a Mac, "Alt+Shift+L" elsewhere. */
export function shortcutLabel(): string {
  return onApple() ? "⌥⇧L" : "Alt+Shift+L";
}

/** Alt and Shift and L, and nothing else held: a held key doesn't repeat it, and IME composition isn't it. */
export function isShortcut(event: KeyboardEvent): boolean {
  return event.code === "KeyL" && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.repeat && !event.isComposing;
}

/** The focused element, looking through shadow roots: the page's own, not the host of the one it is in. */
function deepActive(): Element | null {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}

/**
 * Alt+Shift+L: focus goes to the toolbar through `focusToolbar`, and the element that
 * had it is remembered; from inside the toolbar the same keys, or Esc (the "focus" layer
 * of escape.ts: below picking and the copy popover, above the selection), put focus back
 * there. Focus moving to the page by any other way, a click or a Tab out, forgets it,
 * so a later Esc is not pulled back to a place the designer has left.
 */
export function useFocusShortcut(host: HTMLElement, focusToolbar: () => void): void {
  // The element focus came from, and whether the toolbar holds focus on loan.
  const from = useRef<Element | null>(null);
  const [borrowed, setBorrowed] = useState(false);
  const latest = useRef(focusToolbar);
  useEffect(() => {
    latest.current = focusToolbar;
  });

  const inside = useCallback(() => (host.shadowRoot?.activeElement ?? null) !== null, [host]);
  const giveBack = useCallback(() => {
    const target = from.current;
    from.current = null;
    setBorrowed(false);
    if (target && target !== document.body && target.isConnected && "focus" in target) (target as HTMLElement).focus({ preventScroll: true });
    // Nowhere to go back to (focus was on the page itself, or the element is gone): let go.
    else (host.shadowRoot?.activeElement as HTMLElement | null)?.blur();
  }, [host]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      event.preventDefault();
      if (inside()) {
        giveBack();
        return;
      }
      from.current = deepActive();
      setBorrowed(true);
      latest.current();
    };
    // Capture, so an app's handler that stops the key doesn't hide it from Loupe.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [inside, giveBack]);

  useEffect(() => {
    if (!borrowed) return;
    const onFocusIn = (event: FocusEvent) => {
      if (event.composedPath().includes(host)) return;
      from.current = null;
      setBorrowed(false);
    };
    window.addEventListener("focusin", onFocusIn, true);
    return () => window.removeEventListener("focusin", onFocusIn, true);
  }, [borrowed, host]);

  // Esc is the field's while one has focus (its own clearing, as at the selection's layer).
  useEscape("focus", borrowed, (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    if (inTextField(event.composedPath()[0]) || !inside()) return false;
    giveBack();
  });
}
