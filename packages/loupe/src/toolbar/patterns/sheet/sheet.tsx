// Sheet (ADR 0003, DESIGN.md "Layout", "Opening and closing"): the panel's sheet, in the
// column the page makes room for (dock.ts), or over the page where the window is too
// narrow for one. The header at its top and the footer at its foot stay; the middle
// between them scrolls, its cards keeping their height.
//
// It draws what the view says through attributes and builds no word: the view measures
// the column, holds Alt for a peek, and slides the drawer out on Hide and waits for it
// (index.tsx); the CSS times the drawer from `data-closing`. Its name is panel-view's
// (`SheetWords`). See sheet.md.

import type { ReactNode, Ref } from "react";
import type { SheetWords } from "../../panel-view/index.js";

export type SheetProps = {
  /** In the column the page makes room for; false over the page, where the window is too narrow for one. */
  docked: boolean;
  /** Alt held: see through to what runs under the column. */
  peeking: boolean;
  /** Hide was pressed: the drawer slides back out of the window, and takes nothing meanwhile. */
  closing: boolean;
  /** Its width in px: the column's, less its inset. */
  width: number;
  words: SheetWords;
  /** The middle, which scrolls: the view brings it back to the top on a new selection. */
  middleRef?: Ref<HTMLDivElement>;
  /** The header card and the strip under it. */
  header: ReactNode;
  /** The footer card. */
  footer: ReactNode;
  /** The middle's cards. */
  children: ReactNode;
};

const flag = (on: boolean) => (on ? "" : undefined);

export function Sheet({ docked, peeking, closing, width, words, middleRef, header, footer, children }: SheetProps) {
  return (
    <section
      data-sheet=""
      data-overlay={flag(!docked)}
      data-peek={flag(peeking)}
      data-closing={flag(closing)}
      aria-label={words.label}
      inert={closing || undefined}
      style={{ width }}
    >
      {header}
      <div data-sheet-middle="" ref={middleRef}>
        {children}
      </div>
      {footer}
    </section>
  );
}
