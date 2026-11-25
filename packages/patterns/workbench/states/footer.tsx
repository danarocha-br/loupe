import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { CopySplit, PanelFooter } from "../../src/index.js";
import { FOOTER, FOOTER_EMPTY, UNDO_OFFER, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** PanelFooter: two changes and a held state with the undo offer after Reset all, the theme working; and nothing changed. */
export function FooterStates() {
  const { say, Said } = useSaid();
  const [undo, setUndo] = useState<string | null>(UNDO_OFFER);
  const [dark, setDark] = useState(false);
  const split = (disabled: boolean) => (
    <CopySplit state="idle" busy={false} disabled={disabled} expanded={false} words={WORDS.copy} onCopy={() => say("copy")} onDetails={() => say("details")} />
  );
  return (
    <States>
      <Frame title="PanelFooter: two changes, a held state, the undo offer after Reset all">
        <PanelFooter
          footer={FOOTER}
          words={WORDS.footer}
          undo={undo}
          theme={dark ? "dark" : "light"}
          onResetAll={() => setUndo(UNDO_OFFER)}
          onUndo={() => setUndo(null)}
          onTheme={() => setDark(!dark)}
          copy={split(false)}
        />
      </Frame>
      <Frame title="PanelFooter: nothing changed, nothing to copy">
        <PanelFooter footer={FOOTER_EMPTY} words={WORDS.footer} undo={null} theme="light" onResetAll={() => {}} onUndo={() => {}} onTheme={() => {}} copy={split(true)} />
      </Frame>
      <Said />
    </States>
  );
}
