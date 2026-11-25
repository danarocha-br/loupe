import { useState } from "react";
import { Toggle } from "../../src/index.js";
import { Frame, Glyph, States } from "./frame.js";

/** Toggle pressed, unpressed and unmarked: a tool, a soft pill, and one whose pressed shows elsewhere. */
export function ToggleStates() {
  const [pressed, setPressed] = useState(false);
  const [held, setHeld] = useState(true);
  const [dark, setDark] = useState(false);
  return (
    <States>
      <Frame title="A tool, a soft pill, and one whose pressed shows elsewhere">
        <div className="wb-line">
          <Toggle look="tool" iconOnly pressed={pressed} onPressedChange={setPressed} title="Hide marks">
            <Glyph />
            <span className="sr-only">Hide marks</span>
          </Toggle>
          <Toggle size="small" pressed={held} onPressedChange={setHeld}>
            {held ? "Holding open · Release" : "Hold open"}
          </Toggle>
          <Toggle size="large" iconOnly marksPressed={false} pressed={dark} onPressedChange={setDark} title="Dark theme">
            <Glyph />
            <span className="sr-only">Dark theme</span>
          </Toggle>
        </div>
        {/* Unmarked: in the panel the theme itself shows it's pressed; here this line does. */}
        <p className="wb-note">Dark theme {dark ? "pressed" : "not pressed"}: the button draws no mark</p>
      </Frame>
      <Frame title="Pressed and unpressed, side by side">
        <div className="wb-line">
          <Toggle look="tool" iconOnly pressed onPressedChange={() => {}} title="Pressed">
            <Glyph />
            <span className="sr-only">Pressed</span>
          </Toggle>
          <Toggle look="tool" iconOnly pressed={false} onPressedChange={() => {}} title="Not pressed">
            <Glyph />
            <span className="sr-only">Not pressed</span>
          </Toggle>
          <Toggle size="small" pressed onPressedChange={() => {}}>
            Pressed
          </Toggle>
          <Toggle size="small" pressed={false} onPressedChange={() => {}}>
            Not pressed
          </Toggle>
        </div>
      </Frame>
    </States>
  );
}
