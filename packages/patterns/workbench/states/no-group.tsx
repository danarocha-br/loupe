import { Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { Identity, NoGroup } from "../../src/index.js";
import { IDENTITY, NO_GROUP, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** NoGroup: Select multiple on an Instance with no call site, under its Identity, as the Inspector draws it. */
export function NoGroupStates() {
  const { say, Said } = useSaid();
  return (
    <States>
      <Frame title="NoGroup: Select multiple on an Instance with no call site">
        <Card look="divided">
          <Identity identity={{ ...IDENTITY, keys: [], tags: [], chips: [], crumbs: [] }} words={WORDS.inspector} onBack={() => say("back")}>
            <NoGroup noGroup={NO_GROUP} onScope={(scope) => say(`scope ${scope}`)} />
          </Identity>
        </Card>
      </Frame>
      <Said />
    </States>
  );
}
