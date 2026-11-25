// Where the collapsed Toolbar sits (2026-11-22): a small dark pill with Loupe's L that
// can be dragged anywhere on the window. It stays rigid under the pointer: within reach
// of a side, a faint copy of it shows where it would dock, and let go there it travels
// into that place, a few px off the side, where a liquid neck holds it to the window's
// edge (launcher.tsx, Goo). Dropped anywhere else, or flicked short of a side, it stays free.
//
// Pure geometry, so it can be tested without a layout: a place is kept in fractions
// of the viewport, so it holds across a resize, and laid out in px for the viewport there is.

import { PILL, PILL_SIDES, type PillSide } from "@loupe/patterns/launcher";

export type Edge = PillSide;

/** Glued to a side at `at` (0–1 along it), or free with its centre at `x`, `y` (0–1 of the viewport). */
export type Place = { edge: Edge; at: number } | { edge: null; x: number; y: number };

export type Viewport = { width: number; height: number };

/** The pill's body: always this wide and this tall, ends fully round, as its pattern draws it. */
export const BODY = PILL;
/** Within this of a side, the held pill shows where it would dock, and let go, docks there. */
export const REACH = 56;
/** How far a free pill, or a glued one's ends, keep from the window's edges and corners. */
export const MARGIN = 8;
/** How wide the liquid neck that holds a docked pill spreads along its side, past the pill's ends (launcher.tsx, Goo). */
export const FLARE = 8;
/** A docked pill floats this far off its side, so the neck that holds it to the edge shows. */
export const DOCK_GAP = 6;

/** Where it starts: on the right side, low, where the "Show Loupe" tab used to sit. */
export const DEFAULT_PLACE: Place = { edge: "right", at: 0.85 };

export type Rect = { left: number; top: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => (max < min ? (min + max) / 2 : Math.min(max, Math.max(min, value)));
const horizontal = (edge: Edge) => edge === "top" || edge === "bottom";

/** The body's length along a side and its depth out from it: the pill never turns, so a side edge meets its short end. */
function sizeOn(edge: Edge): { length: number; depth: number } {
  return horizontal(edge) ? { length: BODY.width, depth: BODY.height } : { length: BODY.height, depth: BODY.width };
}

/** The range a glued body's centre can take along its side, keeping its fillets clear of the corners. */
function alongRange(edge: Edge, viewport: Viewport): [number, number] {
  const side = horizontal(edge) ? viewport.width : viewport.height;
  const half = sizeOn(edge).length / 2 + FLARE + MARGIN;
  return [half, side - half];
}

/** A free body's centre, kept inside the window. */
function freeCentre(x: number, y: number, viewport: Viewport): { x: number; y: number } {
  return {
    x: clamp(x, BODY.width / 2 + MARGIN, viewport.width - BODY.width / 2 - MARGIN),
    y: clamp(y, BODY.height / 2 + MARGIN, viewport.height - BODY.height / 2 - MARGIN),
  };
}

/**
 * Where a drop lands: docked on the nearest side when the body is within `REACH` of it,
 * where its preview was showing; otherwise free where it was let go. `x`, `y` are the
 * body's centre in px, where the pointer put it (or a flick would carry it).
 */
export function placeFor(x: number, y: number, viewport: Viewport): Place {
  const { edge, gap } = nearestEdge(x, y, viewport);
  return gap < REACH ? glue(edge, along(edge, x, y), viewport) : freePlace(x, y, viewport);
}

/** Free where it was let go, kept inside the window. */
export function freePlace(x: number, y: number, viewport: Viewport): Place {
  const centre = freeCentre(x, y, viewport);
  return { edge: null, x: centre.x / viewport.width, y: centre.y / viewport.height };
}

/** How far the body's side facing `edge` is from it, in px; negative once past it. */
export function gapTo(edge: Edge, x: number, y: number, viewport: Viewport): number {
  switch (edge) {
    case "left":
      return x - BODY.width / 2;
    case "right":
      return viewport.width - x - BODY.width / 2;
    case "top":
      return y - BODY.height / 2;
    case "bottom":
      return viewport.height - y - BODY.height / 2;
  }
}

export const EDGES: readonly Edge[] = PILL_SIDES;

/** The side the body is closest to, and how close. */
export function nearestEdge(x: number, y: number, viewport: Viewport): { edge: Edge; gap: number } {
  return EDGES.map((edge) => ({ edge, gap: gapTo(edge, x, y, viewport) })).reduce((nearest, next) => (next.gap < nearest.gap ? next : nearest));
}

/** The body's centre measured along a side. */
export const along = (edge: Edge, x: number, y: number) => (horizontal(edge) ? x : y);

/** Glued to `edge` with the body's centre at `along` px on it, kept clear of the corners. */
export function glue(edge: Edge, along: number, viewport: Viewport): Place {
  const side = horizontal(edge) ? viewport.width : viewport.height;
  const [min, max] = alongRange(edge, viewport);
  return { edge, at: side === 0 ? 0.5 : clamp(along, min, max) / side };
}

/** The pill's body as a box in the viewport. */
export function bodyRect(place: Place, viewport: Viewport): Rect {
  const centre = centreOf(place, viewport);
  return { left: centre.x - BODY.width / 2, top: centre.y - BODY.height / 2, width: BODY.width, height: BODY.height };
}

/** The body's centre in px, wherever the place puts it. */
export function centreOf(place: Place, viewport: Viewport): { x: number; y: number } {
  if (place.edge === null) return freeCentre(place.x * viewport.width, place.y * viewport.height, viewport);
  const { depth } = sizeOn(place.edge);
  const [min, max] = alongRange(place.edge, viewport);
  const along = clamp(place.at * (horizontal(place.edge) ? viewport.width : viewport.height), min, max);
  switch (place.edge) {
    case "top":
      return { x: along, y: DOCK_GAP + depth / 2 };
    case "bottom":
      return { x: along, y: viewport.height - DOCK_GAP - depth / 2 };
    case "left":
      return { x: DOCK_GAP + depth / 2, y: along };
    case "right":
      return { x: viewport.width - DOCK_GAP - depth / 2, y: along };
  }
}

/** Where the pill was left is kept in this browser, as the theme is. */
export const PLACE_KEY = "loupe:launcher";

/** And whether the panel was left open ("open") or closed ("closed"): closed on a first visit. */
export const OPEN_KEY = "loupe:open";

/** A stored place, if it is one; anything else (another version, a hand edit) falls back to the default. */
export function readPlace(stored: string | null): Place {
  if (stored === null) return DEFAULT_PLACE;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return DEFAULT_PLACE;
    const place = value as Record<string, unknown>;
    const fraction = (n: unknown): n is number => typeof n === "number" && n >= 0 && n <= 1;
    if (place.edge === null && fraction(place.x) && fraction(place.y)) return { edge: null, x: place.x, y: place.y };
    if (["top", "right", "bottom", "left"].includes(place.edge as string) && fraction(place.at)) return { edge: place.edge as Edge, at: place.at };
    return DEFAULT_PLACE;
  } catch {
    return DEFAULT_PLACE;
  }
}
