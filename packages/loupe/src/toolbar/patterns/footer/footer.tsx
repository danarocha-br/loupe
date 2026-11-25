// PanelFooter (ADR 0003, DESIGN.md "Layout", "Undo"): the panel's pinned footer card. Its tally:
// how many changes the Proposal will list, the State props it shows held, Reset all, and
// the undo offer after a reset. Under it, light or dark, and Copy Proposal in its slot.
//
// It draws panel-view's footer and words (`FooterWords`) and builds none. It writes
// nothing: Reset all, Undo and the theme call back, and the view keeps the offer, moves
// focus between Reset all and Undo through the refs, and says the count as it changes.
// Copy Proposal is the view's, drawn from the Copy flow's patterns. See footer.md.

import type { ReactNode, Ref } from "react";
import type { FooterView, FooterWords } from "../../panel-view/index.js";
import { Button, ContrastIcon, Dot, ResetIcon, Toggle } from "@loupe/ui";

export type PanelFooterProps = {
  /** panel-view's footer: the count and its words, the held chip, and what Reset all discards. */
  footer: FooterView;
  words: FooterWords;
  /** What the last reset dropped, said beside its Undo; null while there is no offer. */
  undo: string | null;
  theme: "light" | "dark";
  /** The footer card: Copy Proposal's popovers stand over it. */
  ref?: Ref<HTMLElement>;
  resetAllRef?: Ref<HTMLButtonElement>;
  undoRef?: Ref<HTMLButtonElement>;
  onResetAll(): void;
  onUndo(): void;
  onTheme(): void;
  /** Copy Proposal, beside the theme. */
  copy: ReactNode;
};

export function PanelFooter({ footer, words, undo, theme, ref, resetAllRef, undoRef, onResetAll, onUndo, onTheme, copy }: PanelFooterProps) {
  return (
    <footer ref={ref} data-footer="">
      <div data-footer-tally="">
        <span data-footer-count="">
          {/* Said once, whole: the figure and its word are for the eye. */}
          <span className="sr-only">{footer.countText}</span>
          <span data-footer-figure="" aria-hidden="true">
            {footer.changes.count}
          </span>
          <span data-footer-word="" aria-hidden="true">
            {footer.changes.word}
          </span>
          {footer.states.chip && (
            <span data-footer-held="" aria-hidden="true" title={footer.states.title}>
              <Dot tone="amber" small />
              {footer.states.chip}
            </span>
          )}
        </span>
        <Button data-footer-reset="" ref={resetAllRef} disabled={footer.resetAll.length === 0} onClick={onResetAll}>
          <ResetIcon />
          {words.resetAll}
        </Button>
        <span data-footer-undo="">
          {undo !== null && (
            <>
              <span data-footer-undo-what="">{undo}</span>
              <button type="button" data-footer-undo-button="" ref={undoRef} onClick={onUndo}>
                {words.undo}
              </button>
            </>
          )}
        </span>
      </div>
      <div data-footer-act="">
        {/* Pressed in dark, unmarked: the whole panel says it. */}
        <Toggle
          size="large"
          iconOnly
          marksPressed={false}
          data-footer-theme=""
          pressed={theme === "dark"}
          onPressedChange={() => onTheme()}
          title={theme === "dark" ? words.theme.toLight : words.theme.toDark}
        >
          <ContrastIcon />
          <span className="sr-only">{words.theme.label}</span>
        </Toggle>
        {copy}
      </div>
    </footer>
  );
}
