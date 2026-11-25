import { Button, Card, CardHead } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { PanelFooter, PanelHeader, Sheet, StatusStrip } from "../../src/index.js";
import { FOOTER_EMPTY, HEADER_PAGE, SHEET_WIDTH, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/**
 * The Sheet, in a stage that stands in for the window: docked as a column, peeking, or over the
 * page where the window is too narrow for one. One sheet, since it is a named region of its own.
 */
export function SheetStates() {
  const { say, Said } = useSaid();
  const [peeking, setPeeking] = useState(false);
  const [docked, setDocked] = useState(true);
  return (
    <States>
      <Frame title="Sheet: docked, its header, a card in the middle, its footer; Peek to see through, or put it over the page">
        <div className="wb-line">
          <Button size="small" onClick={() => setPeeking(!peeking)}>
            {peeking ? "Stop peeking" : "Peek"}
          </Button>
          <Button size="small" onClick={() => setDocked(!docked)}>
            {docked ? "Over the page" : "Docked"}
          </Button>
        </div>
        <div className="wb-stage wb-stage-sheet">
          <Sheet
            docked={docked}
            peeking={peeking}
            closing={false}
            width={SHEET_WIDTH - 40}
            words={WORDS.sheet}
            header={
              docked ? (
                <>
                  <PanelHeader page={HEADER_PAGE} mode="one" armed={false} marksHidden={false} words={WORDS.header} onTool={() => {}} onMarks={() => {}} onHide={() => say("hide")} />
                  <StatusStrip parts={WORDS.header.strip.marksHidden} />
                </>
              ) : (
                <StatusStrip parts={WORDS.header.strip.covered} />
              )
            }
            footer={docked ? <PanelFooter footer={FOOTER_EMPTY} words={WORDS.footer} undo={null} theme="light" onResetAll={() => {}} onUndo={() => {}} onTheme={() => {}} copy={null} /> : null}
          >
            <Card>
              <CardHead>
                <h3>A card</h3>
              </CardHead>
            </Card>
          </Sheet>
        </div>
      </Frame>
      <Said />
    </States>
  );
}
