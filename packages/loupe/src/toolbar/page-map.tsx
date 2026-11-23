import { type CSSProperties, useContext, useEffect, useRef, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { appLang } from "./app-lang.js";
import { boxesOf, PageSignalContext, type PageSignal } from "./page-signal.js";
import type { GroupItem } from "./panel-view/types.js";

type Box = { left: number; top: number; width: number; height: number };

/** How long the page has to stay still before the map reads its boxes again. */
const SETTLE_MS = 120;
/** The first read again, once the column has opened beside the page. */
const OPENED_MS = 400;

/** Each mounted Instance's largest box worth drawing, as the page outlines it. */
function readBoxes(signal: PageSignal | null, debug: LoupeDebug, ids: readonly string[]): ReadonlyMap<string, Box> {
  const boxes = new Map<string, Box>();
  for (const id of ids) {
    const [best] = signal ? signal.boxes(id) : boxesOf(debug.nodes(id));
    if (best) boxes.set(id, { left: best.left, top: best.top, width: best.width, height: best.height });
  }
  return boxes;
}

/**
 * The boxes the map draws: read when it opens, and again once the page has stayed
 * still for a moment after the Instances change or the page signal says a box may
 * have moved (a resize, a scroll, an animation). The map is an overview: it
 * doesn't follow a menu's animation frame by frame, nor read every box on every
 * version of the page. They are state, not read in render: React Compiler keeps
 * what a render computed until an input changes, and a box moving isn't one.
 */
function useSettledBoxes(signal: PageSignal | null, debug: LoupeDebug, ids: readonly string[]): ReadonlyMap<string, Box> {
  const key = ids.join("\n");
  const [boxes, setBoxes] = useState(() => readBoxes(signal, debug, ids));
  const opened = useRef(false);
  useEffect(() => {
    const read = () => setBoxes(readBoxes(signal, debug, key === "" ? [] : key.split("\n")));
    let timer = setTimeout(read, opened.current ? SETTLE_MS : OPENED_MS);
    opened.current = true;
    const stop = signal?.onLayout(() => {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    });
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [signal, debug, key]);
  return boxes;
}

type Props = {
  debug: LoupeDebug;
  groups: GroupItem[];
  /** The component pointed at, here or on its row: its blocks light, the rest fade. */
  lit: string | null;
  onPoint(group: GroupItem | null): void;
  onSelect(id: string | null): void;
};

/** Seven hues, one per component, in the order the list shows them (styles.ts `MAP_HUES`). */
const HUES = 7;
export const hueOf = (index: number) => `hue-${index % HUES}`;

/**
 * Where the arrow keys go from the block `from`, among `order` (the blocks as a page
 * reads, top to bottom and left to right): Right and Down to the next, Left and Up to
 * the one before, Home and End to the ends. Nothing past an end, so a key that can't go
 * anywhere stays put. A key the map doesn't use, or one held with a modifier (Alt and
 * Left is the browser's Back), is null.
 */
export function stepFrom(order: readonly string[], from: string, event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">): string | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const at = order.indexOf(from);
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      return order[Math.min(order.length - 1, at + 1)] ?? null;
    case "ArrowLeft":
    case "ArrowUp":
      return order[Math.max(0, at - 1)] ?? null;
    case "Home":
      return order[0] ?? null;
    case "End":
      return order.at(-1) ?? null;
    default:
      return null;
  }
}

/**
 * Every component on screen as a tinted block where it sits, fit into a dotted well over
 * the rows of "On this page": the rows are its legend. Point to find, click to inspect. Nothing is drawn
 * while nothing has a box (an Instance that isn't mounted, or a page with no layout).
 *
 * The blocks are one Tab stop (a roving tabindex), not one each: the list below is
 * what Tab goes through, and the map is a shortcut into it. The arrow keys move between
 * blocks in the order a page reads, Home and End to the ends, and a block takes focus
 * with the same effect as the pointer on it: its component's row lights and the page outlines it.
 * Each block is named for the Instance it stands for, so a screen reader tells five Buttons apart.
 */
export function PageMap({ debug, groups, lit, onPoint, onSelect }: Props) {
  const signal = useContext(PageSignalContext);
  const mounted = groups.flatMap((group) => group.instances.filter((item) => item.mounted).map((item) => item.id));
  const measured = useSettledBoxes(signal, debug, mounted);
  // The block Tab lands on: the one last focused, or the first while that one is gone.
  const [current, setCurrent] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const blocks = groups
    .flatMap((group, index) => {
      const here = group.instances.filter((item) => item.mounted);
      return here.map((item, nth) => ({
        id: item.id,
        group,
        hue: hueOf(index),
        box: measured.get(item.id) ?? null,
        // Loupe's words, and then the Instance's own: what it shows on screen is the app's, in its language and direction.
        lead: `Inspect ${group.component} ${nth + 1} of ${here.length}, `,
        who: item.name ?? item.label,
        shows: item.name !== null,
      }));
    })
    .filter((b): b is typeof b & { box: Box } => b.box !== null);
  if (blocks.length === 0) return null;
  const boxes = blocks.map((b) => b.box);
  const minLeft = Math.max(0, Math.min(...boxes.map((b) => b.left)));
  const minTop = Math.max(0, Math.min(...boxes.map((b) => b.top)));
  const W = Math.max(...boxes.map((b) => b.left + b.width)) + minLeft;
  const H = Math.max(...boxes.map((b) => b.top + b.height)) + minTop;
  const order = [...blocks].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left).map((b) => b.id);
  const stop = current !== null && order.includes(current) ? current : order[0];
  // The largest first, so a small block inside a large one stays on top to be pointed at.
  blocks.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  return (
    <div className="map-sheet" role="toolbar" aria-label="Page map" data-lit={lit ? "" : undefined} onMouseLeave={() => onPoint(null)}>
      {/* The page's shape, fit into the well: blocks sit at their place in it. */}
      <div className="fit" style={{ "--ratio": W / H } as CSSProperties}>
        {blocks.map((b) => (
          <button
            key={`${b.group.component}:${b.id}`}
            type="button"
            ref={(node) => {
              if (node) nodes.current.set(b.id, node);
              else nodes.current.delete(b.id);
            }}
            className={`blk ${b.hue}${lit === b.group.component ? " lit" : ""}`}
            style={{ left: `${(b.box.left / W) * 100}%`, top: `${(b.box.top / H) * 100}%`, width: `${(b.box.width / W) * 100}%`, height: `${(b.box.height / H) * 100}%` }}
            title={`${b.group.component} ${b.group.count}`}
            tabIndex={b.id === stop ? 0 : -1}
            onMouseOver={() => onPoint(b.group)}
            onFocus={() => {
              setCurrent(b.id);
              onPoint(b.group);
            }}
            onBlur={() => onPoint(null)}
            onKeyDown={(event) => {
              const to = stepFrom(order, b.id, event.nativeEvent);
              if (to === null) return;
              event.preventDefault();
              nodes.current.get(to)?.focus();
            }}
            onClick={() => onSelect(b.id)}
          >
            {/* Its name is its content, not an `aria-label`, so the app's words keep the app's language. */}
            <span className="sr-only">
              {b.lead}
              <span dir="auto" lang={b.shows ? appLang() : undefined}>
                {b.who}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
