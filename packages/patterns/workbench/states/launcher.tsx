import { Frame, States } from "@loupe/ui/workbench";
import { LauncherPill } from "../../src/launcher/launcher.js";
import { PILL_IN_STAGE, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/**
 * LauncherPill, the collapsed Toolbar, in a stage that stands in for the window: docked and
 * parked, held near a side as the neck fills in, and free. Its drag and docking are the view's.
 */
export function LauncherStates() {
  const { say, Said } = useSaid();
  const words = { label: WORDS.launcher.label, title: WORDS.launcher.title("⌘."), keys: WORDS.launcher.keys };
  const open = () => say("open");
  return (
    <States>
      <Frame title="Docked on the left side, parked: the neck has let go">
        <div className="wb-stage">
          <LauncherPill {...PILL_IN_STAGE.docked} words={words} onClick={open} />
        </div>
      </Frame>
      <Frame title="Held 4px off the left side: the neck fills in">
        <div className="wb-stage">
          <LauncherPill {...PILL_IN_STAGE.neck} words={words} onClick={open} />
        </div>
      </Frame>
      <Frame title="Free, away from every side; point at it">
        <div className="wb-stage">
          <LauncherPill {...PILL_IN_STAGE.free} words={words} onClick={open} />
        </div>
      </Frame>
      <Said />
    </States>
  );
}
