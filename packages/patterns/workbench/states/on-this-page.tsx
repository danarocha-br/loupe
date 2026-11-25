import { Frame, States } from "@loupe/ui/workbench";
import { useState } from "react";
import { type GroupItem, GroupRow, OnThisPage, PageMap } from "../../src/index.js";
import { LIST_BOXES, LIST_GROUPS, LIST_SUMMARY, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** OnThisPage: the page map over a GroupRow per component, as the list draws it; point at either to light the other. */
export function OnThisPageStates() {
  const { say, Said } = useSaid();
  const [lit, setLit] = useState<string | null>(null);
  const point = (group: GroupItem | null) => setLit(group?.component ?? null);
  return (
    <States>
      <Frame title="OnThisPage: PageMap over a GroupRow per component">
        <OnThisPage
          words={WORDS.list}
          summary={LIST_SUMMARY}
          map={<PageMap groups={LIST_GROUPS} boxes={LIST_BOXES} lit={lit} words={WORDS.list} onPoint={point} onSelect={(id) => say(`select ${id}`)} />}
        >
          {LIST_GROUPS.map((group) => (
            <GroupRow
              key={group.component}
              group={group}
              lit={lit === group.component}
              words={WORDS.inspector}
              onPoint={point}
              onSite={(site) => say(`select ${site.label}`)}
              onInstance={(id) => say(`select ${id}`)}
              onHover={() => {}}
            />
          ))}
        </OnThisPage>
      </Frame>
      <Said />
    </States>
  );
}
