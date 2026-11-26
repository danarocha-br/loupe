// PageMap (ADR 0003, ADR 0006, DESIGN.md "On this page"): every component on screen as a
// tinted block where it sits, fit into a dotted well over the rows of "On this page": the
// rows are its legend. Point to find, click to inspect. Nothing is drawn while nothing has
// a box (an Instance that isn't mounted, or a page with no layout).
//
// It draws the boxes the view measured on the page (`boxes`) and the words `panelView()`
// decided, and reads neither the page nor the runtime: pointing and choosing go out
// through its callbacks. See page-map.md.

import { type CSSProperties, type RefObject, useLayoutEffect, useRef, useState } from "react";
import type { GroupItem, ListWords } from "../view.js";

/** An Instance's box on the page, in the window's pixels. */
export type MapBox = { left: number; top: number; width: number; height: number };

export type PageMapProps = {
  groups: readonly GroupItem[];
  /** Each mounted Instance's box on the page, by id: one that has none isn't drawn. */
  boxes: ReadonlyMap<string, MapBox>;
  /** The component pointed at, here or on its row: its blocks light, the rest fade. */
  lit: string | null;
  words: Pick<ListWords, "onPage">;
  /** The app's language, for what an Instance shows on screen. */
  nameLang?: string;
  /** A block pointed at or focused, its component; null as it is left. */
  onPoint(group: GroupItem | null): void;
  /** A block pressed: inspect its Instance. */
  onSelect(id: string): void;
};

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
 * The block focus is on as this render begins, by its Instance. Read while rendering, before
 * React moves the blocks: a block whose place in the page's reading order changes is moved
 * in the DOM, and a moved node loses focus. A hook of its own because it reads a ref in
 * render, so React Compiler skips it rather than `PageMap`.
 */
function useFocusedBlock(nodes: RefObject<Map<string, HTMLButtonElement>>): RefObject<string | null> {
  const focused = useRef<string | null>(null);
  focused.current = null;
  for (const [id, node] of nodes.current) {
    const root = node.getRootNode() as Document | ShadowRoot;
    if (root.activeElement === node) focused.current = id;
  }
  return focused;
}

/**
 * The blocks are one Tab stop (a roving tabindex, ADR 0006), not one each: the list below is
 * what Tab goes through, and the map is a shortcut into it. The arrow keys move between
 * blocks in the order a page reads, Home and End to the ends, and a block takes focus
 * with the same effect as the pointer on it: its component's row lights and the page outlines it.
 * Each block is named for the Instance it stands for, so a screen reader tells five Buttons apart.
 */
export function PageMap({ groups, boxes, lit, words, nameLang, onPoint, onSelect }: PageMapProps) {
  // The block Tab lands on: the one last focused, or the first while that one is gone.
  const [current, setCurrent] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const focused = useFocusedBlock(nodes);
  // The focused block, moved to its new place in reading order, takes focus back, unless focus went elsewhere meanwhile.
  useLayoutEffect(() => {
    const node = focused.current === null ? undefined : nodes.current.get(focused.current);
    if (!node) return;
    const root = node.getRootNode() as Document | ShadowRoot;
    if (root.activeElement !== node && (root.activeElement === null || root.activeElement === (root as Document).body)) node.focus({ preventScroll: true });
  });
  const blocks = groups.flatMap((group) =>
    group.instances.flatMap((item) => {
      const box = boxes.get(item.id);
      return item.block && box ? [{ id: item.id, group, box, name: item.block }] : [];
    }),
  );
  if (blocks.length === 0) return null;
  // The page's shape: as far right and down as its Instances reach, with the margin before the first kept on the far side too.
  const all = blocks.map((b) => b.box);
  const minLeft = Math.max(0, Math.min(...all.map((b) => b.left)));
  const minTop = Math.max(0, Math.min(...all.map((b) => b.top)));
  const pageWidth = Math.max(...all.map((b) => b.left + b.width)) + minLeft;
  const pageHeight = Math.max(...all.map((b) => b.top + b.height)) + minTop;
  // Above the blocks larger than it, so a small block inside a large one stays on top to be pointed at. The
  // map is a stacking context of its own (page-map.css), so these ranks never reach what overlays it.
  const stack = new Map([...blocks].sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height).map((b, at) => [b.id, at + 1]));
  // Drawn in the order a page reads, as the arrow keys go: a screen reader's virtual cursor
  // reads the blocks in the DOM's order, and the stacking is `z-index`'s.
  blocks.sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  const order = blocks.map((b) => b.id);
  const tabStop = current !== null && order.includes(current) ? current : order[0];
  return (
    <div data-page-map="" role="toolbar" aria-label={words.onPage.map} data-lit={lit ? "" : undefined} onMouseLeave={() => onPoint(null)}>
      {/* The page's shape, fit into the well: blocks sit at their place in it. */}
      <div data-map-fit="" style={{ "--ratio": pageWidth / pageHeight } as CSSProperties}>
        {blocks.map((b) => (
          <button
            key={`${b.group.component}:${b.id}`}
            type="button"
            ref={(node) => {
              if (node) nodes.current.set(b.id, node);
              else nodes.current.delete(b.id);
            }}
            // The Instance it stands for: what a view finds it by again, its words being the app's, which change.
            data-map-block={b.id}
            data-hue={b.group.hue}
            data-lit={lit === b.group.component ? "" : undefined}
            style={{ left: `${(b.box.left / pageWidth) * 100}%`, top: `${(b.box.top / pageHeight) * 100}%`, width: `${(b.box.width / pageWidth) * 100}%`, height: `${(b.box.height / pageHeight) * 100}%`, zIndex: stack.get(b.id) }}
            title={b.group.mapTitle}
            tabIndex={b.id === tabStop ? 0 : -1}
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
            <span data-map-name="">
              {b.name.lead}
              <span dir="auto" lang={b.name.own ? nameLang : undefined}>
                {b.name.who}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
