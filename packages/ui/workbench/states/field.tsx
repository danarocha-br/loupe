import { useState } from "react";
import { Field } from "../../src/index.js";
import { Frame, States } from "../shell/frame.js";

const LONG_TEXT = Array.from({ length: 14 }, (_, line) => `${line + 1}. A line of a long read-only text, to select and copy by hand.`).join("\n");

/** Field's looks: filled with its marker, error and hint; the outline that grows; the read-only well. */
export function FieldStates() {
  const [title, setTitle] = useState("");
  const [designer, setDesigner] = useState("");
  const [text, setText] = useState("Save changes");
  return (
    <States>
      <Frame title="Filled: a label, an optional marker, a placeholder">
        <Field label="Designer" optional="optional" placeholder="Who is asking for this?" value={designer} onValueChange={setDesigner} />
      </Frame>
      <Frame title="Filled, with an error until it has text, and a hint">
        <Field label="Title" required hint="It heads the text." error={title.trim() === "" ? "Give it a title." : undefined} value={title} onValueChange={setTitle} />
      </Frame>
      <Frame title="Outline: a hidden label, grows with its text">
        <Field label="children" labelHidden look="outline" multiline autoResize rows={1} value={text} onValueChange={setText} />
      </Frame>
      <Frame title="Well: read-only, fades out at its foot">
        <Field label="Long text" labelHidden look="well" multiline readOnly value={LONG_TEXT} />
      </Frame>
    </States>
  );
}
