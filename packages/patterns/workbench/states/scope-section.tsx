import { Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { ScopeSection } from "../../src/index.js";
import { MEMBERS, PAGE_MEMBERS, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** ScopeSection: Select multiple's scopes and members, at the call site and at All on page. */
export function ScopeSectionStates() {
  const { say, Said } = useSaid();
  const calls = {
    onScope: (scope: string) => say(`scope ${scope}`),
    onReset: () => say("reset this scope"),
    onToggle: (action: string, ids: readonly string[]) => say(`${action} ${ids.join(", ")}`),
    onHover: () => {},
  };
  const selected = MEMBERS.members[2]?.id ?? "";
  return (
    <States>
      <Frame title="ScopeSection: at this call site, one Instance left out">
        <Card look="divided">
          <ScopeSection members={MEMBERS} selected={selected} words={WORDS.inspector} {...calls} />
        </Card>
      </Frame>
      <Frame title="ScopeSection: at All on page, by call site">
        <Card look="divided">
          <ScopeSection members={PAGE_MEMBERS} selected={selected} words={WORDS.inspector} {...calls} />
        </Card>
      </Frame>
      <Said />
    </States>
  );
}
