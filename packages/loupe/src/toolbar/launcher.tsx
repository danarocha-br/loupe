// The collapsed Toolbar (2026-11-22): a dark pill with Loupe's L, in place of the
// "Show Loupe" tab. A click opens the panel, which grows out of the pill
// (`morph.ts`). Dragged, it follows the pointer; near a side, the side reaches for it
// with a neck of the same dark stuff, and let go while the neck holds, the side takes
// it and it sits flush, flaring into the edge (after the designer's reference). Dropped
// anywhere else it stays free where it was let go (`launcher-place.ts`). The arrow keys
// glue it to the side they point at, so it moves without a pointer too.

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import {
  along,
  type Box,
  bodyRect,
  centreOf,
  dragging,
  type Edge,
  freePlace,
  gapTo,
  glue,
  layout,
  MAGNET,
  MAGNET_RELEASE,
  neckPath,
  nearestEdge,
  type Place,
  PLACE_KEY,
  readPlace,
  SNAP,
  type Viewport,
} from "./launcher-place.js";

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

type Drag = { pointer: number; startX: number; startY: number; fromX: number; fromY: number; moved: boolean };

/** How long the pill travels when a side takes it or lets it go, mid-drag. */
const MAGNET_MS = 180;

type Held = { x: number; y: number; flush: Edge | null; near: Edge | null };

/**
 * Where a drag is now: flush on a side once within `MAGNET` of it, held there until pulled
 * `MAGNET_RELEASE` out; otherwise free, with the side it is within `SNAP` of reaching for it.
 */
function holdAt(x: number, y: number, viewport: Viewport, flush: Edge | null): Held {
  if (flush !== null && gapTo(flush, x, y, viewport) <= MAGNET_RELEASE) return { x, y, flush, near: flush };
  const { edge, gap } = nearestEdge(x, y, viewport);
  return { x, y, flush: gap <= MAGNET ? edge : null, near: gap < SNAP ? edge : null };
}

/** The pill's body in the viewport, read where it is stored: where a closing panel lands. */
export function pillRect(): Rect {
  return bodyRect(storedPlace(), viewportNow());
}

export type Rect = { left: number; top: number; width: number; height: number };

export function Launcher({ onOpen }: { onOpen(from: Rect): void }) {
  const viewport = useViewport();
  const [place, setPlace] = useState<Place>(storedPlace);
  const [held, setHeld] = useState<Held | null>(null);
  // Pointer moves can outrun a render: each reads the drag as the last one left it.
  const latest = useRef<Held | null>(null);
  const hold = (next: Held | null) => {
    latest.current = next;
    setHeld(next);
  };
  // For a moment as a side takes the pill or lets it go, it travels there instead of jumping.
  const [easing, setEasing] = useState(false);
  const easeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<Drag | null>(null);
  // The click that ends a drag isn't a click on the pill.
  const swallowClick = useRef(false);
  useEffect(() => () => clearTimeout(easeTimer.current), []);

  const settle = (next: Place) => {
    setPlace(next);
    keep(next);
  };
  const ease = () => {
    setEasing(true);
    clearTimeout(easeTimer.current);
    easeTimer.current = setTimeout(() => setEasing(false), MAGNET_MS);
  };

  const box: Box = held
    ? held.flush
      ? layout(glue(held.flush, along(held.flush, held.x, held.y), viewport), viewport)
      : dragging(held.x, held.y, viewport)
    : layout(place, viewport);
  const neck = held && !held.flush && held.near ? neckPath(held.near, held.x, held.y, viewport) : null;

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    swallowClick.current = false;
    const centre = centreOf(place, viewport);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: centre.x, fromY: centre.y, moved: false };
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
    // Picked up from a side, it starts flush there: it peels off once pulled `MAGNET_RELEASE` out.
    const before = latest.current ? latest.current.flush : place.edge;
    current.moved = true;
    const next = holdAt(current.fromX + dx, current.fromY + dy, viewport, before);
    if (next.flush !== before) ease();
    hold(next);
  };
  /** Let go while the neck holds, or flush, and the side takes it; anywhere else it stays free. */
  const drop = () => {
    const last = latest.current;
    if (last) {
      const side = last.flush ?? last.near;
      if (side && last.flush === null) ease();
      settle(side ? glue(side, along(side, last.x, last.y), viewport) : freePlace(last.x, last.y, viewport));
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
    drop();
  };
  const cancel = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.moved) drop();
    else hold(null);
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const edge = ARROWS[event.key];
    if (!edge) return;
    event.preventDefault();
    const centre = centreOf(place, viewport);
    ease();
    settle(glue(edge, along(edge, centre.x, centre.y), viewport));
  };

  const classes = ["launcher", held && "dragging", easing && "easing"].filter(Boolean).join(" ");
  return (
    <>
      {neck && (
        <svg className="neck" aria-hidden="true" focusable="false" viewBox={`0 0 ${viewport.width} ${viewport.height}`} data-edge={held?.near ?? undefined}>
          <path d={neck} />
        </svg>
      )}
      <button
        type="button"
        className={classes}
        data-edge={box.edge ?? "free"}
        // Placed by translate, not left and top, so its travel stays off layout.
        style={{ translate: `${box.left}px ${box.top}px`, width: box.width, height: box.height }}
        aria-label="Show Loupe"
        title="Show Loupe · drag it anywhere, or to a side to keep it there"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onKeyDown={key}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          onOpen(bodyRect(place, viewport));
        }}
      >
        <svg className="shape" width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} aria-hidden="true" focusable="false">
          <path d={box.path} />
        </svg>
        <span className="mark" style={{ left: box.body.x, top: box.body.y }}>
          <LoupeL />
        </span>
      </button>
    </>
  );
}
