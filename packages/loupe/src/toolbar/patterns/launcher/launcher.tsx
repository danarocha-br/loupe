// LauncherPill (ADR 0003, DESIGN.md "Collapsed"): the collapsed Toolbar, a flat dark pill
// with Loupe's L, and its Goo, the body it is drawn in, where it runs together with the
// window's edge like two drops of ink while it glues, and lets go once parked.
//
// It draws where the view puts it and builds no word: the view (launcher.tsx) owns the
// pointer, the drag, the docking maths and the timers, and says through attributes what
// the pill is doing (`data-edge`, `data-dragging`, `data-settling`, `data-leaving`), which
// its CSS times. Its words are panel-view's (`LauncherWords`). See launcher.md.
//
// Imported by its own path, never through `patterns/index.js`: the collapsed pill loads no
// other pattern.

import type { ComponentPropsWithoutRef, Ref } from "react";

/** The pill's body: always this wide and this tall, ends fully round. The place maths (launcher-place.ts) lays it out. */
export const PILL = { width: 44, height: 32 } as const;

/** A side of the window the pill can dock on. */
export type PillSide = "top" | "right" | "bottom" | "left";

/** The window's sides, in the order the Goo draws a body for each. */
export const PILL_SIDES: readonly PillSide[] = ["left", "right", "top", "bottom"];

export type LauncherPillProps = Omit<ComponentPropsWithoutRef<"button">, "className" | "style" | "children" | "type" | "title" | "aria-label"> & {
  /** The side it is docked on; `free` held under the pointer, or let go away from a side. */
  edge: PillSide | "free";
  /** Held under the pointer: rigid, and the Goo's sides follow at once. */
  dragging: boolean;
  /** Travelling to its place after a drop, a dock or a key. */
  settling: boolean;
  /** Tucking into its side as the panel opens: it takes no pointer and no focus. */
  leaving: boolean;
  /** Its body's top left in the window, in px: placed by `translate`, so its travel stays off layout. */
  at: { x: number; y: number };
  /** How far each side's body stands off the window's edge: the pill's gap to that side, and more once parked. */
  gaps: Record<PillSide, number>;
  /** panel-view's `LauncherWords`, the tooltip's shortcut filled in. */
  words: { label: string; title: string };
  ref?: Ref<HTMLButtonElement>;
};

export function LauncherPill({ edge, dragging, settling, leaving, at, gaps, words, ref, ...rest }: LauncherPillProps) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      data-launcher=""
      data-edge={edge}
      data-dragging={dragging ? "" : undefined}
      data-settling={settling ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      style={{ translate: `${at.x}px ${at.y}px` }}
      aria-label={words.label}
      title={words.title}
    >
      <Goo gaps={gaps} />
      <span data-launcher-mark="">
        <LoupeL />
      </span>
    </button>
  );
}

/** Loupe's L, from the wordmark, in `currentColor`. */
export const LoupeL = () => (
  <svg data-launcher-glyph="" width="11" height="18" viewBox="1 1 126 208" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M81.955 189.73C89.305 189.73 95.71 187.652 101.17 183.496C106.84 179.151 110.095 171.5 110.935 160.542H127C126.58 170.744 124.48 179.529 120.7 186.896C116.92 194.075 111.565 199.554 104.635 203.332C97.915 207.111 89.41 209 79.12 209C70.51 209 62.53 207.489 55.18 204.466C47.83 201.254 41.845 196.059 37.225 188.88C32.815 181.701 30.61 171.972 30.61 159.692V127.67C25.99 129.182 21.16 130.599 16.12 131.921C11.08 133.243 6.04 134.471 1 135.605V118.886C6.46 117.563 11.605 116.241 16.435 114.918C21.265 113.407 25.99 111.99 30.61 110.668V42.9401C30.61 35.1944 32.08 28.2044 35.02 21.97C38.17 15.5468 43 10.446 49.51 6.66757C56.23 2.88919 65.05 1 75.97 1C88.15 1 97.81 4.68392 104.95 12.0518C112.3 19.2307 115.975 29.4323 115.975 42.6567C115.975 54.9364 113.35 66.1771 108.1 76.3788C103.06 86.3915 96.025 95.1762 86.995 102.733C77.965 110.29 67.78 116.241 56.44 120.586V158.842C56.44 168.288 58.435 175.845 62.425 181.512C66.625 186.991 73.135 189.73 81.955 189.73ZM94.87 43.5068C94.87 34.8165 93.295 28.2988 90.145 23.9537C86.995 19.6085 82.27 17.436 75.97 17.436C67.99 17.436 62.74 19.8919 60.22 24.8038C57.7 29.5268 56.44 35.7611 56.44 43.5068V102.45C69.04 96.4042 78.595 88.4696 85.105 78.6458C91.615 68.822 94.87 57.109 94.87 43.5068Z" />
  </svg>
);

const round = (n: number) => Math.round(n * 10) / 10;

/** Room around the pill for its blur to spread into (3 blurs), and for the edge's neck to form in. */
const GOO_PAD = 32;
/** The edge's body sits this far past the window's edge, so nothing of it shows along the edge alone. */
const WALL_OFF = 2;
const GOO_W = PILL.width + GOO_PAD * 2;
const GOO_H = PILL.height + GOO_PAD * 2;

/** Where each side's body sits, relative to a pill touching that side: it moves out by the pill's gap to it. */
const WALLS: Record<PillSide, { x: number; y: number; axis: "x" | "y"; sign: 1 | -1 }> = {
  right: { x: GOO_PAD + PILL.width + WALL_OFF, y: 0, axis: "x", sign: 1 },
  left: { x: GOO_PAD - WALL_OFF - GOO_W, y: 0, axis: "x", sign: -1 },
  bottom: { x: 0, y: GOO_PAD + PILL.height + WALL_OFF, axis: "y", sign: 1 },
  top: { x: 0, y: GOO_PAD - WALL_OFF - GOO_H, axis: "y", sign: -1 },
};

/**
 * The pill's body, drawn with a body for each side of the window, through a blur and an alpha
 * threshold: apart they are their own shapes; within about 10px they run together into one, a
 * neck that fills in as they close and snaps as they part, as two drops of ink do. The
 * shapes themselves are laid over the result, so the pill stays a crisp stadium and only
 * the neck is liquid. Each side's body is placed by the pill's real gap to that side, so it
 * stays put on the window's edge, even while the pill travels: both move by `translate` on
 * the same curve (launcher.css). Parked, the view draws them back past where they can join.
 */
function Goo({ gaps }: { gaps: Record<PillSide, number> }) {
  return (
    <svg data-launcher-goo="" width={GOO_W} height={GOO_H} viewBox={`0 0 ${GOO_W} ${GOO_H}`} aria-hidden="true" focusable="false">
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
        <rect data-launcher-body="" x={GOO_PAD} y={GOO_PAD} width={PILL.width} height={PILL.height} rx={PILL.height / 2} />
        {PILL_SIDES.map((side) => {
          const wall = WALLS[side];
          const by = round(wall.sign * gaps[side]);
          return (
            <rect
              key={side}
              data-launcher-wall={side}
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
