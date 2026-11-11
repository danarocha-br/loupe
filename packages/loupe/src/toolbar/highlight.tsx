// Rings over the selected Instance and the hovered ones. The nodes are found once
// per change; only their boxes are re-read each frame, as menus and dialogs animate.

import { useEffect, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";

type Target = { id: string; node: Element; label: string | null; hover: boolean };
type Ring = { key: string; top: number; left: number; width: number; height: number; label: string | null; hover: boolean };

function targetsFor(debug: LoupeDebug, id: string, hover: boolean, label: string | null): Target[] {
  return debug.nodes(id).map((node, index) => ({ id, node, label: index === 0 ? label : null, hover }));
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
  selectedLabel,
  hovered,
}: {
  debug: LoupeDebug;
  version: number;
  selected: string | null;
  selectedLabel: string | null;
  hovered: readonly string[];
}) {
  const [rings, setRings] = useState<Ring[]>([]);
  const hoveredKey = hovered.join("\n");
  useEffect(() => {
    const targets = [
      ...(selected === null ? [] : targetsFor(debug, selected, false, selectedLabel)),
      ...hoveredKey
        .split("\n")
        .filter((id) => id !== "" && id !== selected)
        .flatMap((id) => targetsFor(debug, id, true, null)),
    ];
    if (targets.length === 0) {
      setRings([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      const next = targets.flatMap((target, index): Ring[] => {
        const rect = target.node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return [];
        const { top, left, width, height } = rect;
        return [{ key: `${index}:${target.id}`, top, left, width, height, label: target.label, hover: target.hover }];
      });
      setRings((previous) => (same(previous, next) ? previous : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [debug, selected, selectedLabel, hoveredKey, version]);

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
