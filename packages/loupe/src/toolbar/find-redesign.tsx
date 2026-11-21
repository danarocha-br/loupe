import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

type Props = { debug: LoupeDebug; groups: GroupItem[]; onHover(ids: string[]): void; onSelect(id: string | null): void };

const HUES = 7;
export const hueOf = (index: number) => `hue-${index % HUES}`;

/** Every component on the page as a tinted block where it sits: point to find, click to inspect. */
export function PageMap({ debug, groups, onHover, onSelect }: Props) {
  useRemeasure();
  const [lit, setLit] = useState<string | null>(null);
  const placed = groups.map((group, index) => ({
    group,
    hue: hueOf(index),
    blocks: group.instances
      .filter((item) => item.mounted)
      .map((item) => ({ id: item.id, box: bestNode(debug, [item.id])?.box ?? null }))
      .filter((b): b is { id: string; box: Box } => b.box !== null),
  }));
  const all = placed.flatMap((p) => p.blocks.map((b) => b.box));
  if (all.length === 0) return null;
  const minLeft = Math.max(0, Math.min(...all.map((b) => b.left)));
  const minTop = Math.max(0, Math.min(...all.map((b) => b.top)));
  const W = Math.max(...all.map((b) => b.left + b.width)) + minLeft;
  const H = Math.max(...all.map((b) => b.top + b.height)) + minTop;
  const blocks = placed
    .flatMap((p) => p.blocks.map((b) => ({ ...b, group: p.group, hue: p.hue })))
    .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  const point = (group: GroupItem | null) => {
    setLit(group?.component ?? null);
    onHover(group ? group.outlineIds : []);
  };
  return (
    <div className="section page-map" onMouseLeave={() => point(null)}>
      <div className="head">
        <h3>Page map</h3>
        <span className="meta">Point to find · click to inspect</span>
      </div>
      <div className="map-sheet" style={{ aspectRatio: `${W} / ${H}` }} data-lit={lit ? "" : undefined}>
        {blocks.map((b) => (
          <button
            key={`${b.group.component}:${b.id}`}
            type="button"
            className={`blk ${b.hue}${lit === b.group.component ? " lit" : ""}`}
            style={{ left: `${(b.box.left / W) * 100}%`, top: `${(b.box.top / H) * 100}%`, width: `${(b.box.width / W) * 100}%`, height: `${(b.box.height / H) * 100}%` }}
            title={`${b.group.component} ${b.group.count}`}
            aria-label={`Inspect this ${b.group.component}`}
            onMouseOver={() => point(b.group)}
            onFocus={() => point(b.group)}
            onBlur={() => point(null)}
            onClick={() => onSelect(b.id)}
          />
        ))}
      </div>
      <ul className="map-legend" aria-label="Components by colour">
        {placed.map((p) => (
          <li key={p.group.component}>
            <button
              type="button"
              className={`${p.hue}${lit === p.group.component ? " lit" : ""}${p.blocks.length === 0 ? " unseen" : ""}`}
              title={p.blocks.length === 0 ? "Not on screen until someone opens it" : undefined}
              onMouseOver={() => point(p.group)}
              onFocus={() => point(p.group)}
              onBlur={() => point(null)}
              onClick={() => {
                const first = p.group.instances.find((item) => item.mounted);
                if (first) onSelect(first.id);
              }}
            >
              <i className="swatch" />
              {p.group.component}
              <span className="n">{p.group.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const FIND_CSS = `
/* Find · A · Page map */
.hue-0 { --hue: #8276CF; } .hue-1 { --hue: #27917E; } .hue-2 { --hue: #D08A16; } .hue-3 { --hue: #D2577A; }
.hue-4 { --hue: #3D7FD9; } .hue-5 { --hue: #7A9A2E; } .hue-6 { --hue: #A05ED1; }
.page-map { gap: 12px; }
.map-sheet { position: relative; width: 100%; border-radius: 12px; background: var(--sheet); background-image: radial-gradient(var(--rule) 1px, transparent 1px); background-size: 12px 12px; box-shadow: inset 0 0 0 1px var(--edge); overflow: hidden; }
.map-sheet .blk { position: absolute; min-width: 5px; min-height: 5px; padding: 0; border-radius: 4px; background: color-mix(in srgb, var(--hue) 18%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hue) 75%, transparent); transition: opacity 140ms ease-out, background-color 140ms ease-out, box-shadow 140ms ease-out; }
.map-sheet[data-lit] .blk { opacity: 0.22; }
.map-sheet[data-lit] .blk.lit { opacity: 1; background: color-mix(in srgb, var(--hue) 50%, transparent); box-shadow: inset 0 0 0 2px var(--hue), 0 0 0 3px color-mix(in srgb, var(--hue) 22%, transparent); }
.map-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.map-legend button { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px 0 9px; border-radius: 999px; background: var(--sunk); font-weight: 500; font-size: calc(12 * var(--loupe-px)); transition: background-color 120ms ease-out; }
.map-legend button.lit { background: color-mix(in srgb, var(--hue) 24%, var(--card)); }
.map-legend .swatch { width: 10px; height: 10px; border-radius: 3px; background: var(--hue); }
.map-legend .unseen .swatch { background: none; box-shadow: inset 0 0 0 1.5px var(--hue); }
.map-legend .unseen { color: var(--muted); }
.map-legend .n { font: 400 calc(11 * var(--loupe-px))/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
.cname .hue-dot { display: inline-block; width: 9px; height: 9px; margin-right: 8px; border-radius: 3px; background: var(--hue); vertical-align: 0; }
`;
