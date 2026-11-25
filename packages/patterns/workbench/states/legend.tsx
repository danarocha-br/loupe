import { Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { Legend } from "../../src/index.js";
import { WORDS } from "../../src/samples.js";

/** Legend: what the Inspector's marks mean, with the app's value when a chip rings it, and without. */
export function LegendStates() {
  return (
    <States>
      <Frame title="Legend: a chip on the card rings the app's value">
        <Card look="divided">
          <Legend words={WORDS.inspector} app />
        </Card>
      </Frame>
      <Frame title="Legend: none does">
        <Card look="divided">
          <Legend words={WORDS.inspector} app={false} />
        </Card>
      </Frame>
    </States>
  );
}
