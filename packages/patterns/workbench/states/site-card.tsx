import { Frame, States } from "@loupe/ui/workbench";
import { SiteCard } from "../../src/index.js";
import { BUTTON_GROUP, MENU_ITEM_GROUP } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** SiteCard: a call site and its Instances, lifted on an opened row's wash in its component's hue. */
export function SiteCardStates() {
  const { say, Said } = useSaid();
  return (
    <States>
      {[BUTTON_GROUP, MENU_ITEM_GROUP].map((group) => (
        <Frame key={group.component} title={`SiteCard: ${group.component}'s call sites, on an opened row's wash`}>
          <div className="wb-site" data-hue={group.hue}>
            {group.sites.map((site) => (
              <SiteCard key={site.anchor} site={site} onSite={(picked) => say(`select ${picked.label}`)} onInstance={(id) => say(`select ${id}`)} onHover={() => {}} />
            ))}
          </div>
        </Frame>
      ))}
      <Said />
    </States>
  );
}
