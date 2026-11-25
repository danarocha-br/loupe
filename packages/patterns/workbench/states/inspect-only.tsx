import { Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { InspectOnly, PropRow } from "../../src/index.js";
import { INSPECT_ONLY, INSPECT_ONLY_SHARED, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** InspectOnly: the props nothing can change, folded with their reasons, and open on the one reason they share. */
export function InspectOnlyStates() {
  const { say, Said } = useSaid();
  const pairRow = (item: (typeof INSPECT_ONLY.rows)[number]) => (
    <PropRow
      key={item.name}
      item={item}
      look="pair"
      words={WORDS.inspector}
      onSet={(write, value) => say(`set ${write.prop} to ${JSON.stringify(value)}`)}
      onText={(write, text) => say(`typed ${JSON.stringify(text)} in ${write.prop}`)}
      onReset={(write) => say(`reset ${write.prop}`)}
      onSelect={(id) => say(`select ${id}`)}
      onHover={() => {}}
    />
  );
  return (
    <States>
      <Frame title="InspectOnly: folded, its reasons for each prop">
        <Card look="divided">
          <InspectOnly inspect={INSPECT_ONLY} row={pairRow} />
        </Card>
      </Frame>
      <Frame title="InspectOnly: open, with the one reason every prop shares">
        <Card look="divided">
          <InspectOnly inspect={INSPECT_ONLY_SHARED} row={pairRow} />
        </Card>
      </Frame>
      <Said />
    </States>
  );
}
