import { useRef, useState } from "react";
import { Button, Field, Popover, PopoverPanel } from "../../src/index.js";
import { Frame, States } from "../shell/frame.js";

/** Popover's states: over a footer, its caret at its end or under its middle. */
export function PopoverStates() {
  const [open, setOpen] = useState(false);
  // Which button opened it, kept past closing: focus goes back there once it has closed.
  const [caret, setCaret] = useState<"end" | "center">("end");
  const footer = useRef<HTMLDivElement>(null);
  const toggles = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLButtonElement>(null);
  const center = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const toggle = (from: "end" | "center") => {
    setOpen(!(open && caret === from));
    setCaret(from);
  };
  return (
    <States>
      <Frame title="Escape or a press outside closes it; focus goes back to what opened it">
        <div ref={footer} className="wb-footer">
          <div ref={toggles} className="wb-line">
            <Button ref={center} aria-expanded={open && caret === "center"} aria-haspopup="dialog" onClick={() => toggle("center")}>
              Caret in the middle
            </Button>
            <Button ref={end} aria-expanded={open && caret === "end"} aria-haspopup="dialog" onClick={() => toggle("end")}>
              At the end
            </Button>
          </div>
        </div>
        <Popover open={open} onOpenChange={setOpen} inside={toggles}>
          <PopoverPanel label="Details" anchor={footer} returnFocus={caret === "center" ? center : end} caret={caret}>
            <div className="wb-states">
              <Field label="Name" optional="optional" value={name} onValueChange={setName} />
              <Button look="primary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </PopoverPanel>
        </Popover>
      </Frame>
    </States>
  );
}
