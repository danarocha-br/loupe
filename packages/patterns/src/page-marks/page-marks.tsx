// The page's marks (ADR 0003, DESIGN.md "On the page"): what Loupe draws over the app, outside
// the panel. PageOutline rings an Instance: the one selected, solid and tagged with its size;
// the others its scope reaches, dashed; left-out and hovered ones, dashed grey; and, while a
// select tool is armed, what a click would select, washed. ChangeOutline rings an Instance a
// change reached, for a moment as it lands. PickTag names the Instance under the pointer.
//
// They draw boxes and words the view decided and build none: the view (highlight.tsx) reads
// the page, measures each box, places the tags and times a change's outlines; `panelView()`
// words them (`OutlineWords`). Marks for the eye only: the panel says what is selected and
// what a change reached, so each is hidden from assistive technology. See page-marks.md.

import type { Ref } from "react";
import type { OutlineWords } from "../view.js";

/**
 * `ring`: the selected Instance, solid and tagged; `member`: another Instance the selection
 * reaches, dashed; `out`: left out of the scope, dashed grey; `hover`: named by a row of the
 * panel, dashed grey; `pick`: what a click on the page would select, washed.
 */
export type OutlineKind = "ring" | "member" | "out" | "hover" | "pick";

/** Where an outline goes in the window, in px: the Instance's box, stood off it. */
export type OutlineBox = { top: number; left: number; width: number; height: number };

/** The selected Instance's size tag: its words, under the outline near the window's top, from its start near the left edge. */
export type SizeTag = { text: string; below: boolean; start: boolean };

export type PageOutlineProps = {
  kind: OutlineKind;
  box: OutlineBox;
  /** Stepped back once its change has landed: it fades out. */
  quiet: boolean;
  /** The size tag, on the selected Instance's largest box; null on any other. */
  tag: SizeTag | null;
  /** The view moves the outline with a scroll from it, until it places the outline again. */
  ref?: Ref<HTMLDivElement>;
};

export function PageOutline({ kind, box, quiet, tag, ref }: PageOutlineProps) {
  return (
    <div ref={ref} data-ring={kind} data-quiet={quiet ? "" : undefined} style={box} aria-hidden="true">
      {tag && (
        <span data-ring-label="" data-below={tag.below ? "" : undefined} data-at-start={tag.start ? "" : undefined}>
          {tag.text}
        </span>
      )}
    </div>
  );
}

export type ChangeOutlineProps = {
  /** The numbers of the changes that reach it, as the panel and the Proposal number them: "1 3". */
  keys: string;
  box: OutlineBox;
  quiet: boolean;
  /** The view moves the outline with a scroll from it, until it places the outline again. */
  ref?: Ref<HTMLDivElement>;
};

export function ChangeOutline({ keys, box, quiet, ref }: ChangeOutlineProps) {
  return <div ref={ref} data-mark={keys} data-quiet={quiet ? "" : undefined} style={box} aria-hidden="true" />;
}

export type PickTagProps = {
  /** The Instance it names. */
  id: string;
  /** Its component: "Button". */
  name: string;
  /** What a click would do beyond it: "4 from this call site", "Inspect only"; null for nothing. */
  detail: string | null;
  /** Its top left in the window, which the view works out from the tag's own size. */
  place: { top: number; left: number };
  words: OutlineWords;
  /** The view reads the tag's size from it, and moves the tag with a scroll. */
  ref?: Ref<HTMLDivElement>;
};

export function PickTag({ id, name, detail, place, words, ref }: PickTagProps) {
  return (
    <div ref={ref} data-pick-tag={id} aria-hidden="true" style={place}>
      {name}
      {detail && (
        <span data-pick-detail="">
          {words.detailLead}
          {detail}
        </span>
      )}
    </div>
  );
}
