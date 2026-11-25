// Outlines on the page (2026-11-20, after the designer's reference: an element
// picker's plain outlines in place of the revision clouds, so the page reads clean).
// The selected Instance gets a solid outline, tagged with its component and size
// ("Button · 32 × 32"); at a group or page scope every other Instance it reaches is
// dashed, and one left out is dashed grey (PER-134). The boxes are read again when
// the page signal says one may have moved (`page-signal.ts`): a scroll, a resize, a
// new version, and every frame of a menu's or a dialog's animation, never on a still page.
//
// A change lands, then steps back: when a value changes, every Instance it reaches
// is outlined for a moment (`LINGER`), and then its outline fades, the selection's
// too, so the page shows the change as it will ship. Selecting an Instance a change
// reaches, or pointing at the change or the Instance in the panel, outlines it again.
// The numbers stay in the panel and the Proposal.
//
// While a select tool is armed (2026-11-20, after the Claude Browser's element
// picker), the Instance under the pointer is outlined and tagged with its
// component, and in Select multiple so is every Instance a click would select:
// that preview stands in for the selection's outline until the pointer leaves.
//
// Hide marks (2026-11-20) takes off what stays on the page, the selection's
// outlines and the changes', even before they fade; what follows the pointer, a
// pick's preview or a hovered row's outline, still shows.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { pageWidth } from "./dock.js";
import { type Member, OUTLINE_WORDS, sameMembers } from "./panel-view/index.js";
import { inView, type PageSignal } from "./page-signal.js";
import { type Hovered, NOT_PICKING, type PickPreview, pickPreview, type SelectMode, useHovered } from "./picker.js";
import { ChangeOutline, type OutlineKind, PageOutline, PickTag } from "./patterns/index.js";
import { HOST_ATTRIBUTE } from "./styles.js";
import { useToolbar } from "./toolbar-store.js";

type Tag = Pick<PickPreview, "name" | "detail">;
type Target = { id: string; label: string | null; kind: OutlineKind; tag: Tag | null };
type Box = { top: number; left: number; width: number; height: number };
type Ring = Box & { key: string; id: string; label: string | null; kind: OutlineKind; tag: Tag | null };
/** An Instance a change reaches, where it shows. */
type Mark = Box & { key: string; id: string; text: string };

/** How long a change's outlines stay after it lands, before they fade. Tests shorten it. */
export const LINGER = { ms: 2000 };

/** How far an outline stands off its Instance's box. */
const RING_GAP = 3;
/** Under this far from the top of the window, the selection's tag goes under its outline. */
const TAG_ROOM = 24;
/** The pick tag's distance from its ring, and from the edges of the page it stays inside. */
const TAG_GAP = 4;
const TAG_EDGE = 6;
/** The size tag is 11px mono: about this wide a character, plus its padding. */
const LABEL_CHAR = 6.7;
const LABEL_PAD = 12;

/** "Button · 32 × 32": the selected Instance's name and rendered size, in panel-view's words. */
export function labelText(ring: Box & { label: string | null }): string {
  return OUTLINE_WORDS.size(ring.label ?? "", Math.round(ring.width), Math.round(ring.height));
}

/**
 * The size tag sits on the outline's top right, under it near the window's top, and
 * from the outline's left where ending at its right would run it off the left edge
 * (a small Instance at the page's left, or in an RTL layout).
 */
export function labelPlace(ring: Box & { label: string | null }): { below: boolean; start: boolean } {
  const right = ring.left + ring.width + RING_GAP + 2;
  return { below: ring.top - RING_GAP < TAG_ROOM, start: right < labelText(ring).length * LABEL_CHAR + LABEL_PAD };
}

/**
 * Where the pick tag goes for a ring, as the browser's element picker places
 * its tag: on the ring's top left; below the ring when there is no room above;
 * inside its top when there is none below either (a box taller than the page);
 * slid sideways to stay on the page.
 */
export function tagPlace(ring: Box, tag: { width: number; height: number }, page: { width: number; height: number }) {
  let top = ring.top - TAG_GAP - tag.height;
  if (top < TAG_EDGE) {
    const below = ring.top + ring.height + TAG_GAP;
    top = below + tag.height <= page.height - TAG_EDGE ? below : Math.max(TAG_EDGE, ring.top + TAG_GAP);
  }
  const left = Math.max(TAG_EDGE, Math.min(ring.left, page.width - TAG_EDGE - tag.width));
  return { top, left };
}

const sameBoxes = <T extends { key: string; top: number; left: number }>(a: T[], b: T[]) =>
  a.length === b.length &&
  a.every((item, i) => {
    const other = b[i] as T & Partial<Box>;
    const box = item as T & Partial<Box>;
    return item.key === other.key && item.top === other.top && item.left === other.left && box.width === other.width && box.height === other.height;
  });

/**
 * The Instances whose change has just landed: for `LINGER` after a value that
 * reaches one changes (its stamp moves), or after it is selected.
 */
function useLanded(marks: readonly { id: string; stamp: string }[], selection: readonly string[]): ReadonlySet<string> {
  const latest = useRef({ marks, selection });
  latest.current = { marks, selection };
  const stampsKey = marks.map((mark) => `${mark.id}\n${mark.stamp}`).join("\n\n");
  const selectionKey = selection.join("\n");
  const seen = useRef(new Map<string, string>());
  const until = useRef(new Map<string, number>());
  const lastSelection = useRef<string | null>(null);
  const [landed, setLanded] = useState<ReadonlySet<string>>(() => new Set());
  // Before the frame is painted, so a change never shows a frame without its outline.
  useLayoutEffect(() => {
    const now = Date.now();
    const stamps = new Map(latest.current.marks.map((mark) => [mark.id, mark.stamp]));
    for (const [id, stamp] of stamps) if (seen.current.get(id) !== stamp) until.current.set(id, now + LINGER.ms);
    if (lastSelection.current !== selectionKey) {
      lastSelection.current = selectionKey;
      for (const id of latest.current.selection) if (stamps.has(id)) until.current.set(id, now + LINGER.ms);
    }
    seen.current = stamps;
    for (const id of [...until.current.keys()]) if (!stamps.has(id)) until.current.delete(id);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const at = Date.now();
      const next = new Set<string>();
      let soonest = Number.POSITIVE_INFINITY;
      for (const [id, end] of until.current) {
        if (end <= at) continue;
        next.add(id);
        soonest = Math.min(soonest, end);
      }
      setLanded((previous) => (sameMembers(previous, next) ? previous : next));
      if (soonest !== Number.POSITIVE_INFINITY) timer = setTimeout(update, soonest - at);
    };
    update();
    return () => clearTimeout(timer);
  }, [stampsKey, selectionKey]);
  return landed;
}

export function Highlight({
  debug,
  signal,
  version,
  selected,
  selectedLabel,
  members,
  marks,
  pick,
}: {
  debug: LoupeDebug;
  /** The page signal: boxes by id, and when to read them again. */
  signal: PageSignal;
  version: number;
  selected: string | null;
  selectedLabel: string | null;
  /** At a group or page scope, every Instance it reaches; null at This instance. */
  members: readonly Member[] | null;
  /** Per Instance a change reaches, its numbers and the stamp of what its changes set. */
  marks: readonly { id: string; keys: readonly number[]; stamp: string }[];
  /** While a select tool is armed: the Instance under the pointer, and the tool. */
  pick: { hovered: Hovered; mode: SelectMode } | null;
}) {
  // From the Toolbar's store: the Instances a row of the panel names while the pointer is
  // on it, and Hide marks (no outline for the selection or the changes until it is off).
  const hovered = useToolbar((state) => state.hovered);
  const marksHidden = useToolbar((state) => state.marksHidden);
  const [rings, setRings] = useState<Ring[]>([]);
  const [pins, setPins] = useState<Mark[]>([]);
  const picked = useHovered(pick?.hovered ?? NOT_PICKING);
  const mode = pick?.mode ?? "one";
  // `version` is the trigger: the call site's Instances change with the page.
  const preview = useMemo(() => (picked === null ? null : pickPreview(debug, picked, mode)), [debug, picked, mode, version]);
  const hoveredKey = hovered.join("\n");
  const membersKey = members === null ? null : members.map((member) => `${member.out ? "-" : "+"}${member.id}`).join("\n");
  const marksKey = marks.map((mark) => `${mark.id}=${mark.keys.join(",")}`).join("\n");
  const selection = useMemo(
    () => (selected === null ? [] : [selected, ...(membersKey ?? "").split("\n").filter((entry) => entry !== "").map((entry) => entry.slice(1))]),
    [selected, membersKey],
  );
  const landed = useLanded(marks, selection);
  // Measured before the frame is painted, so an outline lands with the pointer.
  useLayoutEffect(() => {
    const hoveredIds = hoveredKey.split("\n").filter((id) => id !== "");
    const scoped = membersKey === null ? null : membersKey.split("\n").filter((entry) => entry !== "");
    const target = (id: string, kind: OutlineKind, label: string | null, tag: Tag | null = null): Target => ({ id, label, kind, tag });
    const reached = (id: string, out: boolean): OutlineKind => (out ? "out" : id === selected ? "ring" : "member");
    let targets: Target[];
    if (preview !== null) {
      // Picking, over an Instance: what a click would select stands in for the selection.
      // The tag goes on the one under the pointer.
      targets = preview.members.map((member) =>
        target(member.id, member.out ? "out" : "pick", null, member.id === preview.id ? { name: preview.name, detail: preview.detail } : null),
      );
    } else if (scoped !== null && hoveredIds.length > 0) {
      // Hovering a row of the scope's Instances list outlines only that one, dashed grey if it is left out.
      // Picking again, an Instance outside the scope is a hover, as at This instance.
      const out = new Set(scoped.filter((entry) => entry.startsWith("-")).map((entry) => entry.slice(1)));
      const member = new Set(scoped.map((entry) => entry.slice(1)));
      targets = hoveredIds.map((id) =>
        target(id, member.has(id) ? reached(id, out.has(id)) : "hover", id === selected ? selectedLabel : null),
      );
    } else if (marksHidden) {
      targets = hoveredIds.map((id) => target(id, "hover", null));
    } else if (scoped !== null) {
      targets = scoped.map((entry) => {
        const id = entry.slice(1);
        return target(id, reached(id, entry.startsWith("-")), id === selected ? selectedLabel : null);
      });
    } else {
      targets = [
        ...(selected === null ? [] : [target(selected, "ring", selectedLabel)]),
        ...hoveredIds.filter((id) => id !== selected).map((id) => target(id, "hover", null)),
      ];
    }
    const keyed = (marksHidden ? "" : marksKey)
      .split("\n")
      .filter((entry) => entry !== "")
      .map((entry) => {
        const at = entry.lastIndexOf("=");
        const id = entry.slice(0, at);
        return { id, text: entry.slice(at + 1).split(",").join(" ") };
      });
    if (targets.length === 0 && keyed.length === 0) {
      setRings([]);
      setPins([]);
      return;
    }
    const measure = () => {
      const next = targets.flatMap((one, index): Ring[] => {
        const boxes = signal.boxes(one.id);
        // The selection's outline isn't drawn over an app's menu or dialog that covers it.
        if (one.kind !== "pick" && one.kind !== "hover" && boxes[0] && !inView(boxes[0], HOST_ATTRIBUTE)) return [];
        // The label goes on the largest box, the one a designer reads as the Instance.
        return boxes.map(({ node: _node, ...box }, nth) => ({
          ...box,
          key: `${index}:${nth}:${one.kind}:${one.id}`,
          id: one.id,
          label: nth === 0 ? one.label : null,
          kind: one.kind,
          tag: nth === 0 ? one.tag : null,
        }));
      });
      const nextPins = keyed.flatMap((one): Mark[] => {
        const [box] = signal.boxes(one.id);
        if (!box || !inView(box, HOST_ATTRIBUTE)) return [];
        const { node: _node, ...rest } = box;
        return [{ ...rest, key: one.id, id: one.id, text: one.text }];
      });
      // The same rings can change hands: in Select multiple, the tag moves between members.
      setRings((previous) =>
        sameBoxes(previous, next) &&
        previous.every((ring, i) => ring.label === next[i]?.label && ring.tag?.name === next[i]?.tag?.name && ring.tag?.detail === next[i]?.tag?.detail)
          ? previous
          : next,
      );
      setPins((previous) => (sameBoxes(previous, nextPins) && previous.every((pin, i) => pin.text === nextPins[i]?.text) ? previous : nextPins));
    };
    measure();
    return signal.onLayout(measure);
  }, [signal, selected, selectedLabel, hoveredKey, membersKey, marksKey, version, preview, marksHidden]);

  // The pick tag is placed from its own size, read once its text has rendered.
  const tagRef = useRef<HTMLDivElement>(null);
  const [tagSize, setTagSize] = useState({ width: 0, height: 0 });
  const tagged = rings.find((ring) => ring.tag !== null);
  useLayoutEffect(() => {
    const tag = tagRef.current;
    if (!tag) return;
    const width = tag.offsetWidth;
    const height = tag.offsetHeight;
    setTagSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
  });

  const pointed = new Set(hovered);
  const changed = new Set(pins.map((pin) => pin.id));
  // An Instance a change reaches has stepped back once the change has landed, unless the panel points at it.
  const quiet = (id: string) => changed.has(id) && !landed.has(id) && !pointed.has(id);
  // Where the selection outlines an Instance, its change needs no outline of its own.
  const selectionOutlined = new Set(rings.filter((ring) => ring.kind !== "hover").map((ring) => ring.id));
  const outline = (box: Box) => ({
    top: box.top - RING_GAP,
    left: box.left - RING_GAP,
    width: box.width + RING_GAP * 2,
    height: box.height + RING_GAP * 2,
  });
  return (
    <>
      {rings.map((ring) => {
        // A row pointed at outlines a changed Instance as its change does, not grey.
        if (ring.kind === "hover" && changed.has(ring.id)) return null;
        const steps = (ring.kind === "ring" || ring.kind === "member") && quiet(ring.id);
        return (
          <PageOutline
            key={ring.key}
            kind={ring.kind}
            box={outline(ring)}
            quiet={steps}
            tag={ring.label ? { text: labelText(ring), ...labelPlace(ring) } : null}
          />
        );
      })}
      {tagged?.tag && (
        <PickTag
          ref={tagRef}
          id={tagged.id}
          name={tagged.tag.name}
          detail={tagged.tag.detail}
          words={OUTLINE_WORDS}
          place={tagPlace(outline(tagged), tagSize, { width: pageWidth() || window.innerWidth, height: window.innerHeight })}
        />
      )}
      {pins
        .filter((pin) => !selectionOutlined.has(pin.id))
        .map((pin) => (
          <ChangeOutline key={pin.key} keys={pin.text} box={outline(pin)} quiet={quiet(pin.id)} />
        ))}
    </>
  );
}
