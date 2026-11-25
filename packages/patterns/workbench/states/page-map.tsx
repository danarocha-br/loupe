import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { PageMap } from "../../src/index.js";
import { MAP_BOXES, MAP_GROUPS, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** PageMap: the page's Instances as blocks in their components' hues; point at one to light its component. */
export function PageMapStates() {
  const { say, Said } = useSaid();
  const [lit, setLit] = useState<string | null>(null);
  return (
    <States>
      <Frame title="PageMap: point at a block to light its component, the rest fade">
        <PageMap groups={MAP_GROUPS} boxes={MAP_BOXES} lit={lit} words={WORDS.list} onPoint={(group) => setLit(group?.component ?? null)} onSelect={(id) => say(`select ${id}`)} />
      </Frame>
      <Frame title="PageMap: one component lit, as when its row is pointed at">
        <PageMap groups={MAP_GROUPS} boxes={MAP_BOXES} lit={MAP_GROUPS[0]?.component ?? null} words={WORDS.list} onPoint={() => {}} onSelect={(id) => say(`select ${id}`)} />
      </Frame>
      <Said />
    </States>
  );
}
