import { Frame, States } from "@loupe/ui/workbench";
import { HeldForReview } from "../../src/index.js";
import { HELD, HELD_META, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** HeldForReview: records that apply to nothing on this page, each with its values and a Discard. */
export function HeldForReviewStates() {
  const { say, Said } = useSaid();
  return (
    <States>
      <Frame title="HeldForReview">
        <HeldForReview items={HELD} meta={HELD_META} words={WORDS.list} onDiscard={(target) => say(`discard ${JSON.stringify(target)}`)} />
      </Frame>
      <Said />
    </States>
  );
}
