// The page map's view (ADR 0006): it measures where each mounted Instance sits on the page
// and hands the boxes to the PageMap pattern (patterns/page-map/), which draws them. The
// pattern reads neither the page nor the runtime; this does, and nothing else.

import { useContext, useEffect, useRef, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { appLang } from "./app-lang.js";
import { boxesOf, PageSignalContext, type PageSignal } from "./page-signal.js";
import { LIST_WORDS } from "./panel-view/index.js";
import type { GroupItem } from "@loupe/patterns";
import { type MapBox, PageMap } from "@loupe/patterns";

/** How long the page has to stay still before the map reads its boxes again. */
const SETTLE_MS = 120;
/** The first read again, once the column has opened beside the page. */
const OPENED_MS = 400;

/** Each mounted Instance's largest box worth drawing, as the page outlines it. */
function readBoxes(signal: PageSignal | null, debug: LoupeDebug, ids: readonly string[]): ReadonlyMap<string, MapBox> {
  const boxes = new Map<string, MapBox>();
  for (const id of ids) {
    const [best] = signal ? signal.boxes(id) : boxesOf(debug.nodes(id));
    if (best) boxes.set(id, { left: best.left, top: best.top, width: best.width, height: best.height });
  }
  return boxes;
}

/**
 * The boxes the map draws: read when it opens, and again once the page has stayed
 * still for a moment after the Instances change or the page signal says a box may
 * have moved (a resize, a scroll once it settles, an animation), never in the
 * middle of a scroll. The map is an overview: it doesn't follow a menu's animation
 * frame by frame, nor read every box on every version of the page. They are state, not read in render: React Compiler keeps
 * what a render computed until an input changes, and a box moving isn't one.
 */
function useSettledBoxes(signal: PageSignal | null, debug: LoupeDebug, ids: readonly string[]): ReadonlyMap<string, MapBox> {
  const key = ids.join("\n");
  const [boxes, setBoxes] = useState(() => readBoxes(signal, debug, ids));
  const opened = useRef(false);
  useEffect(() => {
    const read = () => {
      // Mid-scroll: the layout tick that settles it brings a read.
      if (signal?.scrolling) return;
      setBoxes(readBoxes(signal, debug, key === "" ? [] : key.split("\n")));
    };
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

/** The page map over the rows of "On this page": the page measured here, drawn by the pattern. */
export function PageMapView({ debug, groups, lit, onPoint, onSelect }: Props) {
  const signal = useContext(PageSignalContext);
  const mounted = groups.flatMap((group) => group.instances.filter((item) => item.mounted).map((item) => item.id));
  const boxes = useSettledBoxes(signal, debug, mounted);
  return <PageMap groups={groups} boxes={boxes} lit={lit} words={LIST_WORDS} nameLang={appLang()} onPoint={onPoint} onSelect={onSelect} />;
}
