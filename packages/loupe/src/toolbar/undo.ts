// Undo for what the panel drops at once (critique 2026-11-19): every reset and
// Discard acts on the first click, and the footer then offers to put back what it
// dropped. One offer at a time: a newer one replaces it. The offer has no timer
// (review 2026-11-20, WCAG 2.2.1): it stays until it is taken, replaced, or the
// Overrides change some other way, after which putting the old records back would
// undo that change too.

import { useSyncExternalStore } from "react";
import type { LoupeDebug } from "../runtime/debug.js";

export type UndoOffer = { id: number; text: string };

type Offer = UndoOffer & { undo(): void; after: string };

let offer: Offer | null = null;
let next = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * The Overrides as they stand, without which Instances are mounted: an Instance
 * unmounting (a menu closing) is not a change that ends an offer.
 */
export function recordsKey(debug: LoupeDebug): string {
  return JSON.stringify(debug.records().map(({ target, values, excluded, suspended }) => ({ target, values, excluded, suspended })));
}

/**
 * Offers to undo what was just dropped: `text` says what, `undo` puts it back, and
 * `after` is `recordsKey()` right after the drop, so the offer ends once they move on.
 */
export function offerUndo(text: string, undo: () => void, after: string): void {
  offer = { id: next++, text, undo, after };
  emit();
}

/** Puts back what the current offer dropped, once. */
export function takeUndo(): void {
  const taken = offer;
  dismissUndo();
  taken?.undo();
}

export function dismissUndo(): void {
  if (offer === null) return;
  offer = null;
  emit();
}

/** Ends the offer once the Overrides are no longer as the drop left them. */
export function keepUndoWhile(now: string): void {
  if (offer !== null && offer.after !== now) dismissUndo();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const current = (): UndoOffer | null => offer;

/** The offer the footer shows, or null. */
export function useUndoOffer(): UndoOffer | null {
  return useSyncExternalStore(subscribe, current, () => null);
}
