import { type CSSProperties, useEffect, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import type { GroupItem } from "./panel-view/types.js";

type Box = { left: number; top: number; width: number; height: number };

/** Re-reads the page's boxes as it resizes or scrolls. */
function useRemeasure() {
  const [, set] = useState(0);
  useEffect(() => {
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => set((n) => n + 1));
    };
    bump();
    const late = setTimeout(bump, 400);
    addEventListener("resize", bump);
    addEventListener("scroll", bump, true);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(bump);
    ro?.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      removeEventListener("resize", bump);
      removeEventListener("scroll", bump, true);
      ro?.disconnect();
    };
  }, []);
}

/** An Instance's largest box worth drawing, as the page outlines it. */
function bestNode(debug: LoupeDebug, ids: readonly string[]): { node: Element; box: Box } | null {
  const viewport = innerWidth * innerHeight;
  let best: { node: Element; box: Box } | null = null;
  for (const id of ids) {
    for (const node of debug.nodes(id)) {
      const r = node.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < 16 || area >= viewport * 0.9) continue;
      if (!best || area > best.box.width * best.box.height) best = { node, box: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }
  }
  return best;
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
 * Every component on screen as a tinted block where it sits, fit into a dotted well over
 * the rows of "On this page": the rows are its legend. Point to find, click to inspect. Nothing is drawn
 * while nothing has a box (an Instance that isn't mounted, or a page with no layout).
 */
export function PageMap({ debug, groups, lit, onPoint, onSelect }: Props) {
  useRemeasure();
  const blocks = groups
    .flatMap((group, index) =>
      group.instances
        .filter((item) => item.mounted)
        .map((item) => ({ id: item.id, group, hue: hueOf(index), box: bestNode(debug, [item.id])?.box ?? null })),
    )
    .filter((b): b is typeof b & { box: Box } => b.box !== null);
  if (blocks.length === 0) return null;
  const boxes = blocks.map((b) => b.box);
  const minLeft = Math.max(0, Math.min(...boxes.map((b) => b.left)));
  const minTop = Math.max(0, Math.min(...boxes.map((b) => b.top)));
  const W = Math.max(...boxes.map((b) => b.left + b.width)) + minLeft;
  const H = Math.max(...boxes.map((b) => b.top + b.height)) + minTop;
  // The largest first, so a small block inside a large one stays on top to be pointed at.
  blocks.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  return (
    <div className="map-sheet" data-lit={lit ? "" : undefined} onMouseLeave={() => onPoint(null)}>
      {/* The page's shape, fit into the well: blocks sit at their place in it. */}
      <div className="fit" style={{ "--ratio": W / H } as CSSProperties}>
        {blocks.map((b) => (
          <button
            key={`${b.group.component}:${b.id}`}
            type="button"
            className={`blk ${b.hue}${lit === b.group.component ? " lit" : ""}`}
            style={{ left: `${(b.box.left / W) * 100}%`, top: `${(b.box.top / H) * 100}%`, width: `${(b.box.width / W) * 100}%`, height: `${(b.box.height / H) * 100}%` }}
            title={`${b.group.component} ${b.group.count}`}
            aria-label={`Inspect this ${b.group.component}`}
            onMouseOver={() => onPoint(b.group)}
            onFocus={() => onPoint(b.group)}
            onBlur={() => onPoint(null)}
            onClick={() => onSelect(b.id)}
          />
        ))}
      </div>
    </div>
  );
}
