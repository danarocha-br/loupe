import { Button, Card, CardHead } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { useEffect, useRef, useState } from "react";
import { PanelFooter, PanelHeader, Sheet, StatusStrip } from "../../src/index.js";
import { FOOTER_EMPTY, HEADER_PAGE, SHEET_WIDTH, WORDS } from "../../src/samples.js";

/**
 * The Sheet, in a stage that stands in for the window: docked as a column, peeking, over the
 * page where the window is too narrow for one, or closing once its Hide is pressed, as the
 * Panel draws it: its header and footer stay in every one. One sheet, since it is a named region
 * of its own. Open stands in for the pill: while the sheet closes it takes the focus Hide had
 * (the sheet is inert then), and opening gives it back to Hide.
 */
export function SheetStates() {
  const [peeking, setPeeking] = useState(false);
  const [docked, setDocked] = useState(true);
  const [closing, setClosing] = useState(false);
  const line = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Where focus goes once the sheet has closed or opened: set by the control that did it, so a first draw moves nothing.
  const focusNext = useRef<"open" | "hide" | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (next === "open") line.current?.querySelector<HTMLElement>("[data-open]")?.focus();
    if (next === "hide") stage.current?.querySelector<HTMLElement>(`[title="${WORDS.header.hide.title}"]`)?.focus();
  }, [closing]);
  const hide = () => {
    focusNext.current = "open";
    setClosing(true);
  };
  const open = () => {
    focusNext.current = "hide";
    setClosing(false);
  };
  return (
    <States>
      <Frame title="Sheet: docked, its header, a card in the middle, its footer; Peek to see through, put it over the page, or Hide it">
        <div className="wb-line" ref={line}>
          <Button size="small" onClick={() => setPeeking(!peeking)}>
            {peeking ? "Stop peeking" : "Peek"}
          </Button>
          <Button size="small" onClick={() => setDocked(!docked)}>
            {docked ? "Over the page" : "Docked"}
          </Button>
          {/* Closing, the sheet is inert: it opens again from here. */}
          {closing && (
            <Button size="small" data-open="" onClick={open}>
              Open
            </Button>
          )}
        </div>
        <div className="wb-stage wb-stage-sheet" ref={stage}>
          <Sheet
            docked={docked}
            peeking={peeking}
            closing={closing}
            width={SHEET_WIDTH - 40}
            words={WORDS.sheet}
            header={
              <>
                <PanelHeader page={HEADER_PAGE} mode="one" armed={false} marksHidden={false} words={WORDS.header} onTool={() => {}} onMarks={() => {}} onHide={hide} />
                <StatusStrip parts={docked ? WORDS.header.strip.marksHidden : WORDS.header.strip.covered} />
              </>
            }
            footer={<PanelFooter footer={FOOTER_EMPTY} words={WORDS.footer} undo={null} theme="light" onResetAll={() => {}} onUndo={() => {}} onTheme={() => {}} copy={null} />}
          >
            <Card>
              <CardHead>
                <h3>A card</h3>
              </CardHead>
            </Card>
          </Sheet>
        </div>
      </Frame>
    </States>
  );
}
