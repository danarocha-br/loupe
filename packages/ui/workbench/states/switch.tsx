import { useState } from "react";
import { Switch } from "../../src/index.js";
import { Frame, States } from "../shell/frame.js";

/** Switch's states: off, on, and disabled. */
export function SwitchStates() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(true);
  return (
    <States>
      <Frame title="Space or Enter turns it; the thumb slides with its corners">
        <label className="wb-switch-row">
          <span>open</span>
          <Switch label="open" checked={open} onCheckedChange={setOpen} />
        </label>
        <label className="wb-switch-row">
          <span>modal</span>
          <Switch label="modal" checked={modal} onCheckedChange={setModal} />
        </label>
        <label className="wb-switch-row">
          <span>disabled</span>
          <Switch label="disabled" checked={false} disabled onCheckedChange={() => {}} />
        </label>
      </Frame>
    </States>
  );
}
