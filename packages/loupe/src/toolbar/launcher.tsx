// The collapsed Toolbar (2026-11-22): a dark pill with Loupe's L, in place of the
// "Show Loupe" tab. A click opens the panel: the pill tucks into its side as the panel
// slides out of its own, a handle and its drawer. Dragged, it stays rigid and exactly
// under the pointer; within reach of a side, a faint copy shows where it would dock, as
// a window shows where it will snap (`launcher-place.ts`). In the last few px to a side,
// the pill and the window's edge run together like two drops of ink (2026-11-23, after
// the designer's "gooey effect" reference): a liquid neck that fills in as they close and
// holds it docked, a few px off its side, and stretches and snaps when it is pulled away.
// Let go or flicked within reach of a side, it travels into that place; anywhere else it
// stays free. The arrow keys dock it on the side they
// point at, so it moves without a pointer too.

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import {
  along,
  BODY,
  bodyRect,
  centreOf,
  EDGES,
  type Edge,
  gapTo,
  glue,
  nearestEdge,
  type Place,
  PLACE_KEY,
  placeFor,
  REACH,
  readPlace,
  type Rect,
  type Viewport,
} from "./launcher-place.js";

export type { Rect };

/** A press that travels further than this is a drag, not a click. */
const DRAG_THRESHOLD = 4;

const ARROWS: Record<string, Edge> = { ArrowUp: "top", ArrowRight: "right", ArrowDown: "bottom", ArrowLeft: "left" };

/** The window less its scrollbars: a glued pill sits against what the page shows, not under a scrollbar. */
function viewportNow(): Viewport {
  const root = document.documentElement;
  return { width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight };
}

function useViewport(): Viewport {
  const [viewport, setViewport] = useState(viewportNow);
  useEffect(() => {
    const resize = () => setViewport(viewportNow());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return viewport;
}

/** Storage can throw (a private window, blocked site data): it then starts where it always does. */
function storedPlace(): Place {
  try {
    return readPlace(localStorage.getItem(PLACE_KEY));
  } catch {
    return readPlace(null);
  }
}

function keep(place: Place) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {
    // Not remembered: it stays where it is for this page load.
  }
}

/** Loupe's L, from the wordmark, in `currentColor`. */
export const LoupeL = () => (
  <svg className="glyph" width="11" height="18" viewBox="1 1 126 208" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M81.955 189.73C89.305 189.73 95.71 187.652 101.17 183.496C106.84 179.151 110.095 171.5 110.935 160.542H127C126.58 170.744 124.48 179.529 120.7 186.896C116.92 194.075 111.565 199.554 104.635 203.332C97.915 207.111 89.41 209 79.12 209C70.51 209 62.53 207.489 55.18 204.466C47.83 201.254 41.845 196.059 37.225 188.88C32.815 181.701 30.61 171.972 30.61 159.692V127.67C25.99 129.182 21.16 130.599 16.12 131.921C11.08 133.243 6.04 134.471 1 135.605V118.886C6.46 117.563 11.605 116.241 16.435 114.918C21.265 113.407 25.99 111.99 30.61 110.668V42.9401C30.61 35.1944 32.08 28.2044 35.02 21.97C38.17 15.5468 43 10.446 49.51 6.66757C56.23 2.88919 65.05 1 75.97 1C88.15 1 97.81 4.68392 104.95 12.0518C112.3 19.2307 115.975 29.4323 115.975 42.6567C115.975 54.9364 113.35 66.1771 108.1 76.3788C103.06 86.3915 96.025 95.1762 86.995 102.733C77.965 110.29 67.78 116.241 56.44 120.586V158.842C56.44 168.288 58.435 175.845 62.425 181.512C66.625 186.991 73.135 189.73 81.955 189.73ZM94.87 43.5068C94.87 34.8165 93.295 28.2988 90.145 23.9537C86.995 19.6085 82.27 17.436 75.97 17.436C67.99 17.436 62.74 19.8919 60.22 24.8038C57.7 29.5268 56.44 35.7611 56.44 43.5068V102.45C69.04 96.4042 78.595 88.4696 85.105 78.6458C91.615 68.822 94.87 57.109 94.87 43.5068Z" />
  </svg>
);

type Drag = { pointer: number; startX: number; startY: number; fromX: number; fromY: number; moved: boolean; samples: { t: number; x: number; y: number }[] };

/** How long a dock, or a flick's travel, takes: quick out, a soft landing. */
const SETTLE_MS = 260;
/** A release faster than this (px/ms) is a flick: the pill carries on as far as it would coast. */
const FLICK = 0.3;
const COAST_MS = 140;

/** A held pill: where the pointer puts its centre, and the side it would dock on if let go now. */
type Held = { x: number; y: number; edge: Edge | null };

function holdAt(x: number, y: number, viewport: Viewport): Held {
  const { edge, gap } = nearestEdge(x, y, viewport);
  return { x, y, edge: gap < REACH ? edge : null };
}

/** A held body's centre: where the pointer puts it, its box kept on the window. */
function onWindow(x: number, y: number, viewport: Viewport): { x: number; y: number } {
  const keep = (value: number, half: number, side: number) => Math.min(side - half, Math.max(half, value));
  return { x: keep(x, BODY.width / 2, viewport.width), y: keep(y, BODY.height / 2, viewport.height) };
}

/** The pill's body in the viewport, read where it is stored. */
export function pillRect(): Rect {
  return bodyRect(storedPlace(), viewportNow());
}

export function Launcher({ onOpen, leaving = false }: { onOpen(): void; leaving?: boolean }) {
  const viewport = useViewport();
  const [place, setPlace] = useState<Place>(storedPlace);
  const [held, setHeld] = useState<Held | null>(null);
  // Pointer moves can outrun a render: each reads the drag as the last one left it.
  const latest = useRef<Held | null>(null);
  const hold = (next: Held | null) => {
    latest.current = next;
    setHeld(next);
  };
  // For a moment after a drop, a dock or a key, it travels to its place instead of jumping.
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<Drag | null>(null);
  // The click the browser sends after a drag isn't a click on the pill.
  const swallowClick = useRef(false);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const travel = () => {
    setSettling(true);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
  };
  const settle = (next: Place) => {
    setPlace(next);
    keep(next);
  };

  // Held, it is exactly where the pointer puts it (only kept on the window); let go, where its place is.
  const centre = held ? onWindow(held.x, held.y, viewport) : centreOf(place, viewport);
  // Where it would dock if let go now: the docked place on the side in reach. Once out of
  // reach, or let go, the preview fades where it last was rather than jumping away.
  const shown = held?.edge ? { edge: held.edge, at: centreOf(glue(held.edge, along(held.edge, held.x, held.y), viewport), viewport) } : null;
  const lastGhost = useRef(shown);
  if (shown) lastGhost.current = shown;
  const ghost = lastGhost.current;
  // How far the pill shows from each side: the edge's body for that side sits that far out.
  const gaps = Object.fromEntries(EDGES.map((edge) => [edge, Math.max(0, gapTo(edge, centre.x, centre.y, viewport))])) as Record<Edge, number>;

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || leaving) return;
    swallowClick.current = false;
    const from = centreOf(place, viewport);
    drag.current = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      fromX: from.x,
      fromY: from.y,
      moved: false,
      samples: [{ t: performance.now(), x: event.clientX, y: event.clientY }],
    };
    try {
      // Moves keep coming to the pill even when the pointer outruns it.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // The pointer is already gone (lifted, or synthetic): the drag still works while it is over the pill.
    }
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    const now = performance.now();
    current.samples = [...current.samples.filter((sample) => now - sample.t < 100), { t: now, x: event.clientX, y: event.clientY }];
    current.moved = true;
    // Nothing travels while held: it is where the pointer puts it, rigid, its preview showing where it would dock.
    hold(holdAt(current.fromX + dx, current.fromY + dy, viewport));
  };
  /** Let go: within reach of a side, into its preview there; flicked, as far as it would coast; else where it is. */
  const drop = (current: Drag) => {
    const last = latest.current;
    if (last) {
      const [first, end] = [current.samples[0], current.samples.at(-1)];
      // Under a frame's worth of samples there is no telling a speed: not a flick.
      const dt = first && end && end.t - first.t >= 16 ? end.t - first.t : 0;
      const vx = dt > 0 && first && end ? (end.x - first.x) / dt : 0;
      const vy = dt > 0 && first && end ? (end.y - first.y) / dt : 0;
      // A preview showing is a promise: let go there, it lands in it, however fast it was moving.
      const flicked = last.edge === null && Math.hypot(vx, vy) > FLICK;
      const x = last.x + (flicked ? vx * COAST_MS : 0);
      const y = last.y + (flicked ? vy * COAST_MS : 0);
      travel();
      settle(placeFor(x, y, viewport));
    }
    hold(null);
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    if (!current.moved) return;
    // Only the click the browser sends right after this release; a later one (Enter, say) is a click.
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 0);
    drop(current);
  };
  const cancel = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.moved) drop(current);
    else hold(null);
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const edge = ARROWS[event.key];
    if (!edge) return;
    event.preventDefault();
    const at = centreOf(place, viewport);
    travel();
    settle(glue(edge, along(edge, at.x, at.y), viewport));
  };

  const classes = ["launcher", held && "dragging", settling && "settling", leaving && "leaving"].filter(Boolean).join(" ");
  return (
    <>
      {/* Under the pill, mounted while it is, so it can fade out as well as in. */}
      <span
        className={shown ? "dock-ghost shown" : "dock-ghost"}
        data-edge={ghost?.edge}
        aria-hidden="true"
        style={ghost ? { translate: `${round(ghost.at.x - BODY.width / 2)}px ${round(ghost.at.y - BODY.height / 2)}px` } : undefined}
      />
      <button
        type="button"
        className={classes}
        data-edge={held ? "free" : (place.edge ?? "free")}
        // Placed by translate, not left and top, so its travel stays off layout.
        style={{ translate: `${round(centre.x - BODY.width / 2)}px ${round(centre.y - BODY.height / 2)}px` }}
        aria-label="Show Loupe"
        title="Show Loupe · drag it anywhere, or to a side to keep it there"
        tabIndex={leaving ? -1 : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onKeyDown={key}
        onClick={() => {
          if (swallowClick.current || leaving) {
            swallowClick.current = false;
            return;
          }
          onOpen();
        }}
      >
        <Goo gaps={gaps} />
        <span className="mark">
          <LoupeL />
        </span>
      </button>
    </>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Room around the pill for its blur to spread into (3 blurs), and for the edge's neck to form in. */
const GOO_PAD = 32;
/** The edge's body sits this far past the window's edge, so nothing of it shows along the edge alone. */
const WALL_OFF = 2;
const GOO_W = BODY.width + GOO_PAD * 2;
const GOO_H = BODY.height + GOO_PAD * 2;

/** Where each side's body sits, relative to a pill touching that side: it moves out by the pill's gap to it. */
const WALLS: Record<Edge, { x: number; y: number; axis: "x" | "y"; sign: 1 | -1 }> = {
  right: { x: GOO_PAD + BODY.width + WALL_OFF, y: 0, axis: "x", sign: 1 },
  left: { x: GOO_PAD - WALL_OFF - GOO_W, y: 0, axis: "x", sign: -1 },
  bottom: { x: 0, y: GOO_PAD + BODY.height + WALL_OFF, axis: "y", sign: 1 },
  top: { x: 0, y: GOO_PAD - WALL_OFF - GOO_H, axis: "y", sign: -1 },
};

/**
 * The pill's body, drawn with a body for each side of the window, through a blur and an alpha
 * threshold: apart they are their own shapes; within about 10px they run together into one, a
 * neck that fills in as they close and snaps as they part, as two drops of ink do. The
 * shapes themselves are laid over the result, so the pill stays a crisp stadium and only
 * the neck is liquid. Each side's body is placed by the pill's real gap to that side, so it
 * stays put on the window's edge, even while the pill travels: both move by `translate` on
 * the same curve.
 */
function Goo({ gaps }: { gaps: Record<Edge, number> }) {
  return (
    <svg className="goo" width={GOO_W} height={GOO_H} viewBox={`0 0 ${GOO_W} ${GOO_H}`} aria-hidden="true" focusable="false">
      <defs>
        <filter id="loupe-goo" x="0" y="0" width={GOO_W} height={GOO_H} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          {/* Cut sharply at half: a straight edge stays where it is drawn, the neck's edge is crisp, and only gaps narrower than ~1 blur fill in. */}
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 90 -44.5" result="goo" />
          <feMerge>
            <feMergeNode in="goo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#loupe-goo)">
        <rect className="body" x={GOO_PAD} y={GOO_PAD} width={BODY.width} height={BODY.height} rx={BODY.height / 2} />
        {EDGES.map((edge) => {
          const wall = WALLS[edge];
          const by = round(wall.sign * gaps[edge]);
          return (
            <rect
              key={edge}
              className="wall"
              x={wall.x}
              y={wall.y}
              width={GOO_W}
              height={GOO_H}
              style={{ translate: wall.axis === "x" ? `${by}px 0px` : `0px ${by}px` }}
            />
          );
        })}
      </g>
    </svg>
  );
}
