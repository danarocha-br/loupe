import { Frame, States } from "@loupe/ui/workbench";
import { ChangeList } from "../../src/index.js";
import { CHANGES, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** ChangeList: two changes, the last one's Instance not mounted. */
export function ChangeListStates() {
  const { say, Said } = useSaid();
  return (
    <States>
      <Frame title="ChangeList: the last change's Instance isn't mounted">
        <ChangeList changes={CHANGES} words={WORDS.list} onSelect={(id) => say(`select ${id}`)} onHover={() => {}} />
      </Frame>
      <Said />
    </States>
  );
}
