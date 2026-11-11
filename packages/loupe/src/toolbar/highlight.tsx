// Rings over the selected Instance and the ones hovered in the list or under the
// picker. Positions are re-read every frame while anything is ringed, since menus
// and dialogs move as they animate.

import { useEffect, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";

type Ring = { key: string; top: number; left: number; width: number; height: number; label: string | null; hover: boolean };

function ringsFor(debug: LoupeDebug, id: string, hover: boolean): Ring[] {
  let label: string | null = hover ? null : id.split(" › ").at(-1)?.replace(/\[\d+\].*$/, "") ?? null;
  return debug.nodes(id).flatMap((node, index) => {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return [];
    const ring: Ring = { key: `${hover ? "h" : "s"}:${id}:${index}`, top: rect.top, left: rect.left, width: rect.width, height: rect.height, label, hover };
    label = null;
    return [ring];
  });
}

const same = (a: Ring[], b: Ring[]) =>
  a.length === b.length &&
  a.every((ring, i) => {
    const other = b[i] as Ring;
    return ring.key === other.key && ring.top === other.top && ring.left === other.left && ring.width === other.width && ring.height === other.height;
  });

export function Highlight({
  debug,
  version,
  selected,
  hovered,
}: {
  debug: LoupeDebug;
  version: number;
  selected: string | null;
  hovered: readonly string[];
}) {
  const [rings, setRings] = useState<Ring[]>([]);
  useEffect(() => {
    const ids = [...hovered.filter((id) => id !== selected)];
    if (selected === null && ids.length === 0) {
      setRings([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      const next = [
        ...(selected === null ? [] : ringsFor(debug, selected, false)),
        ...ids.flatMap((id) => ringsFor(debug, id, true)),
      ];
      setRings((previous) => (same(previous, next) ? previous : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [debug, selected, hovered, version]);

  return (
    <>
      {rings.map((ring) => (
        <div
          key={ring.key}
          className={ring.hover ? "ring hover" : "ring"}
          style={{ top: ring.top - 2, left: ring.left - 2, width: ring.width + 4, height: ring.height + 4 }}
        >
          {ring.label && <span className="label">{ring.label}</span>}
        </div>
      ))}
    </>
  );
}
