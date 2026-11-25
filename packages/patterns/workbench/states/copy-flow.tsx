import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { CopySplit, type CopyState, CopyToast, DetailsForm, NotCopied, PanelFooter } from "../../src/index.js";
import { COPIED_TITLE, FOOTER, REFUSED, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/**
 * Copy Proposal's parts: the split button in each state, the toast over the footer as a copy
 * lands, and the popover's bodies (the details form and Not copied) in a card as the popover
 * draws them, without the popover. Its state machine is the view's: here each part is drawn.
 */
export function CopyFlowStates() {
  const { say, Said } = useSaid();
  const [title, setTitle] = useState("");
  const [designer, setDesigner] = useState("");
  const [missing, setMissing] = useState(true);
  const split = (state: CopyState, disabled = false) => (
    <CopySplit state={state} busy={false} disabled={disabled} expanded={false} words={WORDS.copy} onCopy={() => say(`copy (${state})`)} onDetails={() => say("details")} />
  );
  return (
    <States>
      <Frame title="CopySplit: idle, copied, refused, and with nothing to copy">
        <div className="wb-line">{split("idle")}</div>
        <div className="wb-line">{split("copied")}</div>
        <div className="wb-line">{split("failed")}</div>
        <div className="wb-line">{split("idle", true)}</div>
      </Frame>
      <Frame title="CopyToast: over the footer as a copy lands">
        <div className="wb-toast-room">
          <PanelFooter
            footer={FOOTER}
            words={WORDS.footer}
            undo={null}
            theme="light"
            onResetAll={() => {}}
            onUndo={() => {}}
            onTheme={() => {}}
            copy={
              <>
                {split("copied")}
                <CopyToast title={COPIED_TITLE} words={WORDS.copy} />
              </>
            }
          />
        </div>
      </Frame>
      <Frame title="DetailsForm: copied with no title, until one is typed">
        <div className="wb-popover">
          <DetailsForm
            title={title}
            designer={designer}
            missing={missing}
            busy={false}
            words={WORDS.copy}
            onTitle={(next) => {
              setTitle(next);
              if (next.trim() !== "") setMissing(false);
            }}
            onDesigner={setDesigner}
            onSubmit={() => (title.trim() === "" ? setMissing(true) : say(`copy "${title}" by ${designer || "—"}`))}
          />
        </div>
      </Frame>
      <Frame title="NotCopied: with the Proposal's text, and without">
        <div className="wb-popover">
          <NotCopied said={WORDS.copy.notCopiedText(REFUSED.reason, true)} text={REFUSED.text} busy={false} words={WORDS.copy} onRetry={() => say("try again")} />
        </div>
        <div className="wb-popover">
          <NotCopied said={REFUSED.reason} text="" busy={false} words={WORDS.copy} onRetry={() => say("try again")} />
        </div>
      </Frame>
      <Said />
    </States>
  );
}
