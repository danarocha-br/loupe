import { Frame, States } from "@loupe/ui/workbench";
import type { FlagsCardView } from "../../src/index.js";
import { FlagsCard } from "../../src/index.js";
import { FLAGS, FLAGS_CROWDED, FLAGS_OFF, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** FlagsCard and its FlagRows: one previewed and a write refused, a crowded flag, and previews off. */
export function FlagsCardStates() {
  const { say, Said } = useSaid();
  const onCopy = (text: string) => {
    say(`copy ${text}`);
    return Promise.resolve();
  };
  const card = (flags: FlagsCardView) => (
    <FlagsCard
      flags={flags}
      busy={false}
      onPreview={(key, value) => say(`preview ${key} ${JSON.stringify(value)}`)}
      onClear={(key) => say(`clear ${key}`)}
      onClearAll={() => say("clear all")}
      words={WORDS.command}
      onCopy={onCopy}
    />
  );
  return (
    <States>
      <Frame title="FlagsCard: one previewed, a write refused">{card(FLAGS)}</Frame>
      <Frame title="A crowded flag, what shows now under its options, words whole">{card(FLAGS_CROWDED)}</Frame>
      <Frame title="Previews off, folded to one line (open it for why)">{card(FLAGS_OFF)}</Frame>
      <Said />
    </States>
  );
}
