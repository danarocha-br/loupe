import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { type SelectMode, StartCard } from "../../src/index.js";
import { WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** StartCard: the guided start, its mode checked; pressed again, armed. */
export function StartCardStates() {
  const { say, Said } = useSaid();
  const [mode, setMode] = useState<SelectMode>("one");
  const [armed, setArmed] = useState(false);
  return (
    <States>
      <Frame title="StartCard: the mode checked; pressed again, armed">
        <StartCard
          words={WORDS.list}
          mode={mode}
          armed={armed}
          onTool={(next) => {
            setArmed(next === mode ? !armed : true);
            setMode(next);
            say(`tool ${next}`);
          }}
        />
      </Frame>
      <Frame title="StartCard: armed, as when Select multiple is picking">
        <StartCard words={WORDS.list} mode="many" armed onTool={(next) => say(`tool ${next}`)} />
      </Frame>
      <Said />
    </States>
  );
}
