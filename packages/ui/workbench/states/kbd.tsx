import { Kbd } from "../../src/index.js";
import { Frame, States } from "./frame.js";

/** Kbd in running text. */
export function KbdStates() {
  return (
    <States>
      <Frame title="A key in running text">
        <p className="wb-status">
          Click an Instance on the page · <Kbd>Esc</Kbd> cancels
        </p>
        <p className="wb-status">
          A dialog on the page runs under the panel · hold <Kbd>Alt</Kbd> to see through
        </p>
      </Frame>
    </States>
  );
}
