import { useState } from "react";
import { Fold, FoldChevron, FoldPanel, FoldTrigger } from "../../src/index.js";
import { Frame, States } from "./frame.js";

/** Fold's states: closed, open, kept by the caller at its own width, and one inside another. */
export function FoldStates() {
  const [open, setOpen] = useState(false);
  return (
    <States>
      <Frame title="Closed: Enter or Space opens it, focus stays on the row">
        <Fold>
          <FoldTrigger className="wb-fold-row">
            <span>Order details</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <p className="wb-fold-body">Still in the page while closed: find in page opens it.</p>
          </FoldPanel>
        </Fold>
      </Frame>
      <Frame title="Open at first, with a fold inside">
        <Fold defaultOpen>
          <FoldTrigger className="wb-fold-row">
            <span>Inspect only · 3</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <div className="wb-fold-body">
              <Fold>
                <FoldTrigger className="wb-fold-row wb-fold-small">
                  <FoldChevron />
                  <span>1 set by the library</span>
                </FoldTrigger>
                <FoldPanel>
                  <p className="wb-fold-body">aria-expanded · false</p>
                </FoldPanel>
              </Fold>
            </div>
          </FoldPanel>
        </Fold>
      </Frame>
      <Frame title="Inline, the caller keeps the state">
        <Fold open={open} onOpenChange={setOpen}>
          <div className="wb-fold-line">
            <span>Reaches 4 of 4</span>
            <FoldTrigger inline className="wb-fold-row">
              <span>4 Instances</span>
              <FoldChevron />
            </FoldTrigger>
          </div>
          <FoldPanel>
            <p className="wb-fold-body">{open ? "Opened by the caller’s state." : ""}</p>
          </FoldPanel>
        </Fold>
      </Frame>
    </States>
  );
}
