// Where the collapsed Toolbar sits (2026-11-22, after the designer's "agent blob"
// reference): a small dark pill with Loupe's L that can be dragged anywhere on the
// window. Dropped near a side, it glues to it: the side of the pill that faces the edge
// goes flush and flares into it with two concave fillets, a tab growing out of the
// window's frame. Dropped anywhere else, it stays there as a free pill.
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
/** Dropped this close to a side, it glues to it. */
export const SNAP = 40;
/** How far a free pill, or a glued one's fillets, keep from the window's edges and corners. */
export const MARGIN = 8;

/** Where it starts: on the right side, low, where the "Show Loupe" tab used to sit. */
export const DEFAULT_PLACE: Place = { edge: "right", at: 0.85 };

/** The laid-out pill: its box on the viewport, the body's centre inside the box, and the outline to fill. */
export type Box = { left: number; top: number; width: number; height: number; edge: Edge | null; body: { x: number; y: number }; path: string };

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
 * Where a drop lands: glued to the nearest side when the body comes within `SNAP` of
 * it, otherwise free where it was let go. `x`, `y` are the body's centre in px.
 */
export function placeFor(x: number, y: number, viewport: Viewport): Place {
  const { edge, gap } = nearestEdge(x, y, viewport);
  return gap <= SNAP ? glue(edge, along(edge, x, y), viewport) : freePlace(x, y, viewport);
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

/** While dragging, a side starts to answer from this far off: its rail fades in as the pill comes closer. */
export const REACH = 120;
/** Once glued in a drag, it lets go of the side only this far out, so it doesn't flicker on the line. */
export const RELEASE = SNAP + 12;

/** How strongly a side pulls at this gap: 0 out of reach, rising to 1 where it glues. */
export function pullOf(gap: number): number {
  if (gap <= SNAP) return 1;
  if (gap >= REACH) return 0;
  return 1 - (gap - SNAP) / (REACH - SNAP);
}

/** The rail a side shows while the pill is dragged near it: a short dark band along the edge, centred on the pill. */
export const RAIL = { length: 200, thickness: 4 } as const;

export function railBox(edge: Edge, at: number, viewport: Viewport): { left: number; top: number; width: number; height: number } {
  const side = horizontal(edge) ? viewport.width : viewport.height;
  const start = clamp(at - RAIL.length / 2, 0, side - RAIL.length);
  const far = (horizontal(edge) ? viewport.height : viewport.width) - RAIL.thickness;
  switch (edge) {
    case "top":
      return { left: start, top: 0, width: RAIL.length, height: RAIL.thickness };
    case "bottom":
      return { left: start, top: far, width: RAIL.length, height: RAIL.thickness };
    case "left":
      return { left: 0, top: start, width: RAIL.thickness, height: RAIL.length };
    case "right":
      return { left: far, top: start, width: RAIL.thickness, height: RAIL.length };
  }
}

/** Glued to `edge` with the body's centre at `along` px on it, kept clear of the corners. */
export function glue(edge: Edge, along: number, viewport: Viewport): Place {
  const side = horizontal(edge) ? viewport.width : viewport.height;
  const [min, max] = alongRange(edge, viewport);
  return { edge, at: side === 0 ? 0.5 : clamp(along, min, max) / side };
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

/** A free body: a stadium, as wide as it is long, its ends fully round. */
function stadium(): string {
  const { width: w, height: h } = BODY;
  const r = h / 2;
  return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

/**
 * A glued body, drawn as if on the bottom side and then mapped onto its own: the far
 * end round, the near side flush, and a concave fillet each side flaring into the edge.
 */
function tab(edge: Edge): { path: string; width: number; height: number } {
  const { length: l, depth: d } = sizeOn(edge);
  const f = FILLET;
  // The free pill's own corner, so gluing changes only the side that meets the edge.
  const r = Math.min(BODY.height / 2, l / 2, d - f);
  // On the bottom side, the box is l + 2f wide and d tall; y grows away from the far end.
  const points: [string, number, number][] = [
    ["M", 0, d],
    ["A0", f, d - f],
    ["L", f, r],
    ["A1", f + r, 0],
    ["L", f + l - r, 0],
    ["A1", f + l, r],
    ["L", f + l, d - f],
    ["A0", l + 2 * f, d],
  ];
  // Each side's map from the bottom drawing, and whether it mirrors (which flips an arc's sweep).
  const map: Record<Edge, { at(x: number, y: number): [number, number]; mirror: boolean }> = {
    bottom: { at: (x, y) => [x, y], mirror: false },
    top: { at: (x, y) => [x, d - y], mirror: true },
    right: { at: (x, y) => [y, x], mirror: true },
    left: { at: (x, y) => [d - y, x], mirror: false },
  };
  const { at, mirror } = map[edge];
  const path = points
    .map(([command, x, y]) => {
      const [px, py] = at(x, y);
      if (command === "M" || command === "L") return `${command}${px} ${py}`;
      const radius = command === "A0" ? f : r;
      const sweep = Number(command === "A1") ^ Number(mirror);
      return `A${radius} ${radius} 0 0 ${sweep} ${px} ${py}`;
    })
    .join("");
  return horizontal(edge) ? { path: `${path}Z`, width: l + 2 * f, height: d } : { path: `${path}Z`, width: d, height: l + 2 * f };
}

/** The pill laid out for a viewport: where its box goes, where the body's centre is in it, and its outline. */
export function layout(place: Place, viewport: Viewport): Box {
  const centre = centreOf(place, viewport);
  if (place.edge === null) {
    const { width, height } = BODY;
    return { left: centre.x - width / 2, top: centre.y - height / 2, width, height, edge: null, body: { x: width / 2, y: height / 2 }, path: stadium() };
  }
  const { path, width, height } = tab(place.edge);
  const left = place.edge === "right" ? viewport.width - width : place.edge === "left" ? 0 : centre.x - width / 2;
  const top = place.edge === "bottom" ? viewport.height - height : place.edge === "top" ? 0 : centre.y - height / 2;
  return { left, top, width, height, edge: place.edge, body: { x: centre.x - left, y: centre.y - top }, path };
}

/** A free pill's box while it is being dragged, its centre following the pointer. */
export function dragging(x: number, y: number, viewport: Viewport): Box {
  const free = freeCentre(x, y, viewport);
  return layout({ edge: null, x: free.x / viewport.width, y: free.y / viewport.height }, viewport);
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
