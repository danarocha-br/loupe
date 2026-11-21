// Undo for what the panel drops at once (critique 2026-11-19): Reset all acts on
// the first click, and the footer then offers to put back what it dropped for a
// few seconds. One offer at a time: a newer one replaces it.

import { useSyncExternalStore } from "react";

/** How long an offer stays. */
export const UNDO_MS = 8000;

export type UndoOffer = { id: number; text: string };

type Offer = UndoOffer & { undo(): void };

let offer: Offer | null = null;
let next = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Offers to undo what was just dropped: `text` says what, `undo` puts it back. */
export function offerUndo(text: string, undo: () => void): void {
  clearTimeout(timer);
  offer = { id: next++, text, undo };
  timer = setTimeout(dismissUndo, UNDO_MS);
  emit();
}

/** Puts back what the current offer dropped, once. */
export function takeUndo(): void {
  const taken = offer;
  dismissUndo();
  taken?.undo();
}

export function dismissUndo(): void {
  clearTimeout(timer);
  if (offer === null) return;
  offer = null;
  emit();
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
