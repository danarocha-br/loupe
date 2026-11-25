import { Delta, Tag } from "../../src/index.js";
import { Frame, States } from "../shell/frame.js";

/** Delta numbered, and empty. */
export function DeltaStates() {
  return (
    <States>
      <Frame title="Numbered (an image named “Change n”), and empty and dashed (hidden)">
        <div className="wb-line">
          <Delta n={1} label="Change 1" title="Change 1 in the Proposal" />
          <Delta n={2} label="Change 2" title="Change 2 in the Proposal" />
          <Delta n={12} label="Change 12" title="Change 12 in the Proposal" />
          <span className="wb-mark">
            <Delta title="Held open: shown as a state" /> open <Tag>State prop</Tag>
          </span>
        </div>
      </Frame>
    </States>
  );
}
