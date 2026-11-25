import { Frame, States } from "@loupe/ui/workbench";
import { AppearsOnInteraction } from "../../src/index.js";
import { INTERACTION, WORDS } from "../../src/samples.js";

/** AppearsOnInteraction: the components the page draws only once it is used. */
export function InteractionStates() {
  return (
    <States>
      <Frame title="AppearsOnInteraction">
        <AppearsOnInteraction components={INTERACTION} words={WORDS.list} />
      </Frame>
    </States>
  );
}
