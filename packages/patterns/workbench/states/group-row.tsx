import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { GroupRow } from "../../src/index.js";
import { BUTTON_GROUP, MENU_ITEM_GROUP, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** GroupRow: a component's row, closed and opened to its call sites, lit as it is pointed at. */
export function GroupRowStates() {
  const { say, Said } = useSaid();
  const [lit, setLit] = useState<string | null>(null);
  return (
    <States>
      <Frame title="GroupRow: a row per component; point at one to light it, open one for its call sites">
        <ul className="wb-list">
          {[BUTTON_GROUP, MENU_ITEM_GROUP].map((group) => (
            <GroupRow
              key={group.component}
              group={group}
              lit={lit === group.component}
              words={WORDS.inspector}
              onPoint={(pointed) => setLit(pointed?.component ?? null)}
              onSite={(site) => say(`select ${site.label}`)}
              onInstance={(id) => say(`select ${id}`)}
              onHover={() => {}}
            />
          ))}
        </ul>
      </Frame>
      <Frame title="GroupRow: lit, as when its blocks on the page map are pointed at">
        <ul className="wb-list">
          <GroupRow group={MENU_ITEM_GROUP} lit words={WORDS.inspector} onPoint={() => {}} onSite={(site) => say(`select ${site.label}`)} onInstance={(id) => say(`select ${id}`)} onHover={() => {}} />
        </ul>
      </Frame>
      <Said />
    </States>
  );
}
