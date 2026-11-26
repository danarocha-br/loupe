// The collapsed Toolbar (2026-11-22): a dark pill with Loupe's L, in place of the
// "Show Loupe" tab. A click opens the panel: the pill tucks into its side as the panel
// slides out of its own, a handle and its drawer. Dragged, it stays rigid and exactly
// under the pointer (`launcher-place.ts`). In the last few px to a side, the pill and
// the window's edge run together like two drops of ink (2026-11-23, after the designer's
// "gooey effect" reference): a liquid neck that fills in as they close. It is only there
// while the pill is gluing: dragged near a side, landing on it, or peeled off it. Parked,
// the neck lets go and the pill sits clean, a few px off its side. Let go or flicked
// within reach of a side, it travels into that place; anywhere else it stays free. The
// arrow keys dock it on the side they point at, so it moves without a pointer too.

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
import { LAUNCHER_WORDS } from "./panel-view/chrome.js";
import { LauncherPill } from "@loupe/patterns/launcher";
import { SHORTCUT_ARIA, shortcutLabel } from "./shortcut.js";
import { DURATION } from "@loupe/ui/tokens";
import { useAnnounce } from "@loupe/ui/announcer";

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

type Drag = { pointer: number; startX: number; startY: number; fromX: number; fromY: number; moved: boolean; samples: { t: number; x: number; y: number }[] };

/** How long a dock, or a flick's travel, takes: quick out, a soft landing (launcher.css times it too). */
const SETTLE_MS = DURATION.settle;
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

export function Launcher({ onOpen, onPreload, leaving = false }: { onOpen(): void; onPreload?(): void; leaving?: boolean }) {
  const viewport = useViewport();
  const announce = useAnnounce();
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
  // How far the pill shows from each side: the edge's body for that side sits that far out,
  // while it is held or travelling. Parked, the edge's bodies draw back out of reach, so the
  // neck lets go once it has landed (the pattern's CSS times it).
  const gluing = held !== null || settling;
  const gaps = Object.fromEntries(EDGES.map((edge) => [edge, Math.max(0, gapTo(edge, centre.x, centre.y, viewport)) + (gluing ? 0 : PARKED_GAP)])) as Record<Edge, number>;

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
    // Nothing travels while held: it is where the pointer puts it, rigid.
    hold(holdAt(current.fromX + dx, current.fromY + dy, viewport));
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
      // Let go in reach of a side, it docks there, however fast it was moving.
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
    // Nothing on screen says where it went to a keyboard that can't see it: said.
    announce(LAUNCHER_WORDS.docked[edge]);
  };

  return (
    <LauncherPill
      edge={held ? "free" : (place.edge ?? "free")}
      dragging={held !== null}
      settling={settling}
      leaving={leaving}
      at={{ x: round(centre.x - BODY.width / 2), y: round(centre.y - BODY.height / 2) }}
      gaps={gaps}
      words={{ label: LAUNCHER_WORDS.label, title: LAUNCHER_WORDS.title(shortcutLabel()), keys: LAUNCHER_WORDS.keys }}
      aria-keyshortcuts={SHORTCUT_ARIA}
      tabIndex={leaving ? -1 : undefined}
      // About to be opened: the panel's module starts loading, so the click doesn't wait for it.
      onPointerEnter={onPreload}
      onFocus={onPreload}
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
    />
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Parked, the edge's bodies draw back this much further than the pill's gap, past where they can join it. */
const PARKED_GAP = 24;
