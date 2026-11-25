import { useState } from "react";
import { Button } from "../../src/index.js";
import { Frame, Glyph, States } from "../shell/frame.js";

/** Button's looks and sizes: soft in three sizes and disabled, primary, and icon only. */
export function ButtonStates() {
  const [presses, setPresses] = useState(0);
  const press = () => setPresses(presses + 1);
  return (
    <States>
      <Frame title="Soft: small, medium, large; disabled">
        <div className="wb-line">
          <Button size="small" onClick={press}>
            Discard
          </Button>
          <Button onClick={press}>
            <Glyph />
            Reset all
          </Button>
          <Button size="large" onClick={press}>
            Select all
          </Button>
          <Button disabled>Reset all</Button>
        </div>
        <p className="wb-note">Pressed {presses} times</p>
      </Frame>
      <Frame title="Primary, and icon only">
        <div className="wb-line">
          <Button look="primary" onClick={press}>
            <Glyph />
            Copy with these details
          </Button>
        </div>
        <div className="wb-line">
          <Button look="tool" iconOnly title="Hide the panel" onClick={press}>
            <Glyph />
            <span className="sr-only">Hide panel</span>
          </Button>
          <Button size="small" iconOnly title="Reset" onClick={press}>
            <Glyph />
            <span className="sr-only">Reset</span>
          </Button>
        </div>
      </Frame>
    </States>
  );
}
