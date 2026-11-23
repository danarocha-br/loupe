// Leaving a selection the way Figma does (2026-11-20): Esc, or a click on the page
// outside the selected Instances, goes back to the component list. Unlike picking,
// Loupe only listens here: the key and the click reach the app as they would
// without it, never stopped or delayed, since a click on the page is usually the
// designer using the app.

import { useEffect, useRef } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { useEscape } from "./escape.js";

/** What the app opens over its page and closes on Esc itself: while one is open, Esc is the app's. */
const APP_OVERLAYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], dialog[open]';

/** A field Esc may mean something in (clearing it, closing its suggestions): Esc stays the field's. */
const TEXT_FIELDS = 'textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
const NOT_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"]);

function inTextField(target: EventTarget | undefined): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(TEXT_FIELDS)) return true;
  return target instanceof HTMLInputElement && !NOT_TEXT.has(target.type);
}

/** Whether an element is on screen: a closed menu some libraries keep mounted is hidden, not gone. */
function shown(element: Element): boolean {
  if (typeof (element as { checkVisibility?: () => boolean }).checkVisibility === "function") {
    return (element as Element & { checkVisibility(): boolean }).checkVisibility();
  }
  return element.closest("[hidden]") === null && getComputedStyle(element).display !== "none";
}

function appOverlayOpen(): boolean {
  return [...document.querySelectorAll(APP_OVERLAYS)].some(shown);
}

/**
 * Deselects on Esc, or on a click on the page outside `ids` (the selection and,
 * at a group or page scope, every Instance it reaches), while `active`: something
 * is selected and no select tool is armed (picking has its own Esc and clicks).
 *
 * Esc is left to the app while it has a menu or dialog open, and to a text field
 * with focus; Loupe's own layers above the selection, picking and Copy Proposal's
 * popover, take it first (escape.ts). Only a pointer click counts: one
 * from the keyboard (Enter on an app's button) or from a script has no
 * `detail`. Nothing in the panel counts.
 */
export function useDeselect({
  debug,
  host,
  ids,
  active,
  onDeselect,
}: {
  debug: LoupeDebug;
  host: Element;
  ids: readonly string[];
  active: boolean;
  onDeselect(): void;
}): void {
  // Read when the key or click comes, so the listeners stay put while the selection's scope changes.
  const latest = useRef({ ids, onDeselect });
  useEffect(() => {
    latest.current = { ids, onDeselect };
  });

  useEscape("selection", active, (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    if (inTextField(event.composedPath()[0])) return false;
    if (appOverlayOpen()) return false;
    latest.current.onDeselect();
  });

  useEffect(() => {
    if (!active) return;
    const fromToolbar = (event: Event) => event.composedPath().includes(host);
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0 || event.button !== 0 || fromToolbar(event)) return;
      const nodes = new Set<EventTarget>(latest.current.ids.flatMap((id) => debug.nodes(id)));
      if (event.composedPath().some((target) => nodes.has(target))) return;
      latest.current.onDeselect();
    };
    // Capture, so an app's handler that stops the event doesn't hide it; it never prevents or stops it.
    window.addEventListener("click", onClick, { capture: true, passive: true });
    return () => {
      window.removeEventListener("click", onClick, { capture: true });
    };
  }, [active, debug, host]);
}
