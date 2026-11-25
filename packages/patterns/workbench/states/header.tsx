import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { PanelHeader, type SelectMode, StatusStrip } from "../../src/index.js";
import { HEADER_PAGE, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** PanelHeader and its StatusStrip: the tools, Hide marks and the strip's words; and an Instance selected. */
export function HeaderStates() {
  const { say, Said } = useSaid();
  const [mode, setMode] = useState<SelectMode>("one");
  const [armed, setArmed] = useState(false);
  const [marksHidden, setMarksHidden] = useState(false);
  // What the strip says, as panel-view's `stripParts` picks it: picking first, then the marks hidden.
  const strip = armed ? WORDS.header.strip.pick[mode] : marksHidden ? WORDS.header.strip.marksHidden : null;
  return (
    <States>
      <Frame title="PanelHeader and StatusStrip: pick a tool, press it again to arm it, hide the marks">
        <PanelHeader
          page={HEADER_PAGE}
          mode={mode}
          armed={armed}
          marksHidden={marksHidden}
          words={WORDS.header}
          onTool={(next) => {
            setArmed(next === mode ? !armed : true);
            setMode(next);
          }}
          onMarks={() => setMarksHidden(!marksHidden)}
          onHide={() => say("hide")}
        />
        <StatusStrip parts={strip} />
      </Frame>
      <Frame title="PanelHeader: an Instance selected (no page), the strip with a key">
        <PanelHeader page={null} mode="many" armed marksHidden={false} words={WORDS.header} onTool={() => {}} onMarks={() => {}} onHide={() => {}} />
        <StatusStrip parts={WORDS.header.strip.covered} />
      </Frame>
      <Said />
    </States>
  );
}
