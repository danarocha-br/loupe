import { useState } from "react";
import { Button, type Politeness, useAnnounce } from "../../src/index.js";
import { Frame, States } from "./frame.js";

// The notes under a control are for the eye: the control says its own state (checked,
// pressed), and nothing in a frame is a live region of its own. What a screen reader is
// told goes through the surface's announcer, tried here.

const COPIED = "Copied “Calmer rows”. Paste it into your coding agent.";

/** The Announcer: a polite message, the same one twice, and an assertive one, to hear in a screen reader. */
export function AnnouncerStates() {
  const announce = useAnnounce();
  const [said, setSaid] = useState<string>("—");
  const say = (text: string, politeness: Politeness = "polite") => {
    announce(text, { politeness });
    setSaid(`${politeness}: ${text}`);
  };
  return (
    <States>
      <Frame title="Polite waits for a pause; the same message twice is read twice">
        <div className="wb-line">
          <Button onClick={() => say(COPIED)}>Announce a copy</Button>
          <Button onClick={() => say("Reset 2 Overrides")}>Announce a reset</Button>
        </div>
      </Frame>
      <Frame title="Assertive interrupts: a refusal to act on">
        <div className="wb-line">
          <Button onClick={() => say("Couldn’t reach the clipboard. Select the command and copy it.", "assertive")}>Announce a refusal</Button>
        </div>
        <p className="wb-note">Last said, {said}</p>
      </Frame>
    </States>
  );
}
