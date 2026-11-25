import { Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { Legend, PropRow } from "../../src/index.js";
import { PROP_ITEMS, TONE_AT_SCOPE, TYPE_INSPECT_ONLY, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** PropRow: a row per prop as the Inspector draws them, a scope's row, and a pair in Inspect only. Each write is said, not made. */
export function PropRowStates() {
  const { say, Said } = useSaid();
  const calls = {
    onSet: (write: { prop: string }, value: unknown) => say(`set ${write.prop} to ${JSON.stringify(value)}`),
    onText: (write: { prop: string }, text: string) => say(`typed ${JSON.stringify(text)} in ${write.prop}`),
    onReset: (write: { prop: string }) => say(`reset ${write.prop}`),
    onSelect: (id: string) => say(`select ${id}`),
    onHover: () => {},
  };
  return (
    <States>
      <Frame title="PropRow: variant overridden, size, text, a switch and a held state, then the Legend">
        <Card look="divided">
          {PROP_ITEMS.map((item) => (
            <PropRow key={item.name} item={item} words={WORDS.inspector} {...calls} />
          ))}
          <Legend words={WORDS.inspector} app />
        </Card>
      </Frame>
      <Frame title="PropRow at a scope: its counts per option; and a pair, as Inspect only lists it">
        <Card look="divided">
          <PropRow item={TONE_AT_SCOPE} words={WORDS.inspector} {...calls} />
          <div className="wb-pairs">
            <PropRow item={TYPE_INSPECT_ONLY} look="pair" words={WORDS.inspector} {...calls} />
          </div>
        </Card>
      </Frame>
      <Said />
    </States>
  );
}
