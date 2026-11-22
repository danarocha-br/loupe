// The collapsed Toolbar (2026-11-22): a dark pill with Loupe's L, in place of the
// "Show Loupe" tab. A click opens the panel: the pill tucks into its side as the panel
// slides out of its own, a handle and its drawer. Dragged, it follows the pointer;
// near a side it is drawn in as to a magnet, its facing side flattening, and docked,
// two small fillets grow out of the edge to hold it (`launcher-place.ts`). Let go or
// flicked within reach of a side, it docks there; anywhere else it stays free. The
// arrow keys dock it on the side they point at, so it moves without a pointer too.

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import {
  along,
  BODY,
  bodyRect,
  centreOf,
  DOCK,
  type Edge,
  FILLET,
  freePlace,
  gapTo,
  glue,
  leanCentre,
  leanGap,
  nearestEdge,
  nearRadius,
  type Place,
  PLACE_KEY,
  pillPath,
  placeFor,
  REACH,
  readPlace,
  type Rect,
  UNDOCK,
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
/** The fillets growing out of the edge as it docks, and going back as it leaves. */
const FILLET_IN_MS = 220;
const FILLET_OUT_MS = 120;
/** A release faster than this (px/ms) is a flick: the pill carries on as far as it would coast. */
const FLICK = 0.3;
const COAST_MS = 140;

/** A number that eases to `target` over `ms`, from wherever it is when the target changes. */
function useTween(target: number, ms: number): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (typeof requestAnimationFrame !== "function" || ms === 0 || reducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    // Timed from its first frame: a frame's timestamp can come before `performance.now()` read here.
    let start: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      // The same strong ease-out as the travel: most of it at once, a soft finish.
      const eased = 1 - (1 - t) ** 4;
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A held pill: where the pointer puts its centre, the side drawing it in (if one is), and whether that side has it. */
type Held = { x: number; y: number; edge: Edge | null; docked: boolean };

function holdAt(x: number, y: number, viewport: Viewport, wasDocked: Edge | null): Held {
  const { edge, gap } = nearestEdge(x, y, viewport);
  if (gap >= REACH) return { x, y, edge: null, docked: false };
  const shown = leanGap(gap);
  // Docked while held, it stays docked until it is pulled out past `UNDOCK`, so it doesn't flicker on the line.
  const docked = wasDocked === edge ? shown <= UNDOCK : shown <= DOCK;
  return { x, y, edge, docked };
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

  // What shows: docked, flush on its side; held in reach, leaning in, its facing side flattening; else where it is.
  const docked = held ? held.docked : place.edge !== null;
  const facing = held ? held.edge : place.edge;
  const centre = held
    ? held.edge
      ? held.docked
        ? centreOf(glue(held.edge, along(held.edge, held.x, held.y), viewport), viewport)
        : leanCentre(held.edge, held.x, held.y, viewport)
      : centreOf(freePlace(held.x, held.y, viewport), viewport)
    : centreOf(place, viewport);
  const fillet = useTween(docked ? FILLET : 0, docked ? FILLET_IN_MS : FILLET_OUT_MS);
  const near = held?.edge && !held.docked ? nearRadius(leanGap(gapTo(held.edge, held.x, held.y, viewport))) : docked ? 0 : BODY.height / 2;
  const path = pillPath(facing, near, fillet > 0.05 ? fillet : 0);

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
    // Picked up from a side, it starts docked there, and comes away once pulled past `UNDOCK`.
    const before = latest.current ? (latest.current.docked ? latest.current.edge : null) : place.edge;
    current.moved = true;
    const next = holdAt(current.fromX + dx, current.fromY + dy, viewport, before);
    if (next.docked !== (before !== null) || (next.docked && next.edge !== before)) travel();
    hold(next);
  };
  /** Let go: within reach of a side, docked there; flicked, as far as it would coast; else where it is. */
  const drop = (current: Drag) => {
    const last = latest.current;
    if (last) {
      const [first, end] = [current.samples[0], current.samples.at(-1)];
      // Under a frame's worth of samples there is no telling a speed: not a flick.
      const dt = first && end && end.t - first.t >= 16 ? end.t - first.t : 0;
      const vx = dt > 0 && first && end ? (end.x - first.x) / dt : 0;
      const vy = dt > 0 && first && end ? (end.y - first.y) / dt : 0;
      const flicked = Math.hypot(vx, vy) > FLICK;
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
    <button
      type="button"
      className={classes}
      data-edge={docked && facing ? facing : "free"}
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
      <svg className="shape" width={BODY.width} height={BODY.height} viewBox={`0 0 ${BODY.width} ${BODY.height}`} aria-hidden="true" focusable="false">
        <path d={path} />
      </svg>
      <span className="mark">
        <LoupeL />
      </span>
    </button>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
