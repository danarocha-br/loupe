// Rings over the selected Instance and the hovered ones; at a group or page scope,
// over every Instance it reaches, dashed for those left out (PER-134). The nodes are
// found once per change; only their boxes are re-read each frame, as menus and
// dialogs animate.

import { useEffect, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import type { Member } from "./scopes.js";

/** `hover`: dashed grey; `out`: left out of the scope, dashed. */
type Kind = "ring" | "hover" | "out";
type Target = { id: string; node: Element; label: string | null; kind: Kind };
type Ring = { key: string; top: number; left: number; width: number; height: number; label: string | null; kind: Kind };


function targetsFor(debug: LoupeDebug, id: string, kind: Kind, label: string | null): Target[] {
  return debug.nodes(id).map((node, index) => ({ id, node, label: index === 0 ? label : null, kind }));
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
  members,
}: {
  debug: LoupeDebug;
  version: number;
  selected: string | null;
  selectedLabel: string | null;
  hovered: readonly string[];
  /** At a group or page scope, every Instance it reaches; null at This instance. */
  members: readonly Member[] | null;
}) {
  const [rings, setRings] = useState<Ring[]>([]);
  const hoveredKey = hovered.join("\n");
  const membersKey = members === null ? null : members.map((member) => `${member.out ? "-" : "+"}${member.id}`).join("\n");
  useEffect(() => {
    const hoveredIds = hoveredKey.split("\n").filter((id) => id !== "");
    const scoped = membersKey === null ? null : membersKey.split("\n").filter((entry) => entry !== "");
    let targets: Target[];
    if (scoped !== null && hoveredIds.length > 0) {
      // Hovering a row of the scope's Instances list rings only that one, dashed if it is left out.
      const out = new Set(scoped.filter((entry) => entry.startsWith("-")).map((entry) => entry.slice(1)));
      targets = hoveredIds.flatMap((id) => targetsFor(debug, id, out.has(id) ? "out" : "ring", id === selected ? selectedLabel : null));
    } else if (scoped !== null) {
      targets = scoped.flatMap((entry) => {
        const id = entry.slice(1);
        return targetsFor(debug, id, entry.startsWith("-") ? "out" : "ring", id === selected ? selectedLabel : null);
      });
    } else {
      targets = [
        ...(selected === null ? [] : targetsFor(debug, selected, "ring", selectedLabel)),
        ...hoveredIds.filter((id) => id !== selected).flatMap((id) => targetsFor(debug, id, "hover", null)),
      ];
    }
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
        return [{ key: `${index}:${target.kind}:${target.id}`, top, left, width, height, label: target.label, kind: target.kind }];
      });
      setRings((previous) => (same(previous, next) ? previous : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [debug, selected, selectedLabel, hoveredKey, membersKey, version]);

  return (
    <>
      {rings.map((ring) => (
        <div
          key={ring.key}
          className={ring.kind === "ring" ? "ring" : `ring ${ring.kind}`}
          data-ring={ring.kind}
          style={{ top: ring.top - 2, left: ring.left - 2, width: ring.width + 4, height: ring.height + 4 }}
        >
          {ring.label && <span className="label">{ring.label}</span>}
        </div>
      ))}
    </>
  );
}
