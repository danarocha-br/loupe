// Where the collapsed Toolbar sits (2026-11-22): a small dark pill with Loupe's L that
// can be dragged anywhere on the window. Near a side it is drawn to it, as to a magnet:
// it leans in faster than the pointer, and the side of it that faces the edge flattens.
// Docked, that side goes flush and two small fillets grow out of the edge to hold it,
// so the pill reads as part of the window's frame. Dropped anywhere else, or flicked
// short of a side, it stays free.
//
// Pure geometry, so it can be tested without a layout: a place is kept in fractions
// of the viewport, so it holds across a resize, and laid out in px for the viewport there is.

export type Edge = "top" | "right" | "bottom" | "left";

/** Glued to a side at `at` (0–1 along it), or free with its centre at `x`, `y` (0–1 of the viewport). */
export type Place = { edge: Edge; at: number } | { edge: null; x: number; y: number };

export type Viewport = { width: number; height: number };

/** The pill's body: always this wide and this tall, ends fully round. */
export const BODY = { width: 44, height: 32 } as const;
/** The concave fillets where a glued pill flares into its side. */
export const FILLET = 8;
/** Within this of a side, the pill is drawn to it, and let go, docks there. */
export const REACH = 56;
/** Shown this close while held, it is docked already; it lets go only past `UNDOCK`. */
export const DOCK = 4;
export const UNDOCK = 10;
/** How far a free pill, or a glued one's fillets, keep from the window's edges and corners. */
export const MARGIN = 8;

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
  const half = sizeOn(edge).length / 2 + FILLET + MARGIN;
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
 * where it was already leaning in; otherwise free where it was let go. `x`, `y` are the
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

const EDGES: readonly Edge[] = ["left", "right", "top", "bottom"];

/** The side the body is closest to, and how close. */
export function nearestEdge(x: number, y: number, viewport: Viewport): { edge: Edge; gap: number } {
  return EDGES.map((edge) => ({ edge, gap: gapTo(edge, x, y, viewport) })).reduce((nearest, next) => (next.gap < nearest.gap ? next : nearest));
}

/** The body's centre measured along a side. */
export const along = (edge: Edge, x: number, y: number) => (horizontal(edge) ? x : y);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * The magnet: how close the body is shown to a side it is `gap` from. Out of reach, where
 * the pointer puts it; in reach, closer, so it leans in faster than the pointer moves and
 * meets the edge before the pointer does. Continuous at `REACH`, so nothing jumps.
 */
export function leanGap(gap: number): number {
  if (gap >= REACH) return gap;
  if (gap <= 0) return 0;
  return gap * (gap / REACH) ** 0.6;
}

/** The corner on the side facing the edge, at the gap shown: round out of reach, nearly square at the edge. */
export function nearRadius(shown: number): number {
  const t = Math.min(1, Math.max(0, shown / REACH));
  return lerp(2, BODY.height / 2, t * t * (3 - 2 * t));
}

/** A held body's centre, drawn toward `edge` from where the pointer put it. */
export function leanCentre(edge: Edge, x: number, y: number, viewport: Viewport): { x: number; y: number } {
  const free = freeCentre(x, y, viewport);
  const shown = leanGap(gapTo(edge, x, y, viewport));
  switch (edge) {
    case "left":
      return { x: BODY.width / 2 + shown, y: free.y };
    case "right":
      return { x: viewport.width - BODY.width / 2 - shown, y: free.y };
    case "top":
      return { x: free.x, y: BODY.height / 2 + shown };
    case "bottom":
      return { x: free.x, y: viewport.height - BODY.height / 2 - shown };
  }
}

/**
 * The pill's outline in its own box (`BODY`, origin top left), facing `edge`: the far
 * corners round, the near ones at `near`, and once docked, a concave `fillet` each side
 * growing out of the edge, drawn past the box. Only one of `near` and `fillet` is ever
 * above 0, so one arc per corner turns from convex into concave through a square corner.
 * Free and far from every side, it is a stadium. Drawn as if on the bottom side, then mapped.
 */
export function pillPath(edge: Edge | null, near: number, fillet: number): string {
  const facing = edge ?? "bottom";
  const { length: l, depth: d } = sizeOn(facing);
  const r = Math.min(BODY.height / 2, l / 2);
  const concave = fillet > 0;
  const k = concave ? fillet : Math.min(near, r);
  const out = concave ? fillet : -k;
  // Bottom drawing: y grows toward the edge, the near side at y = d.
  const points: [string, number, number][] = [
    ["M", -out, d],
    ["N", 0, d - k],
    ["L", 0, r],
    ["F", r, 0],
    ["L", l - r, 0],
    ["F", l, r],
    ["L", l, d - k],
    ["N", l + out, d],
  ];
  const map: Record<Edge, { at(x: number, y: number): [number, number]; mirror: boolean }> = {
    bottom: { at: (x, y) => [x, y], mirror: false },
    top: { at: (x, y) => [x, d - y], mirror: true },
    right: { at: (x, y) => [y, x], mirror: true },
    left: { at: (x, y) => [d - y, x], mirror: false },
  };
  const { at, mirror } = map[facing];
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${points
    .map(([command, x, y]) => {
      const [px, py] = at(x, y).map(round) as [number, number];
      if (command === "M" || command === "L") return `${command}${px} ${py}`;
      // F: a far corner, convex. N: a near corner, convex until it is a fillet, then concave.
      const radius = command === "F" ? r : round(k);
      const convex = command === "F" || !concave;
      return `A${radius} ${radius} 0 0 ${Number(convex) ^ Number(mirror)} ${px} ${py}`;
    })
    .join("")}Z`;
}

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
      return { x: along, y: depth / 2 };
    case "bottom":
      return { x: along, y: viewport.height - depth / 2 };
    case "left":
      return { x: depth / 2, y: along };
    case "right":
      return { x: viewport.width - depth / 2, y: along };
  }
}

/** Where the pill was left is kept in this browser, as the theme is. */
export const PLACE_KEY = "loupe:launcher";

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
