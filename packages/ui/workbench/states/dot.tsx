import { Dot } from "../../src/index.js";
import { Frame, States } from "./frame.js";

/** Dot in each tone, large and small. */
export function DotStates() {
  return (
    <States>
      <Frame title="Hidden; the words beside it say what it marks">
        <div className="wb-line">
          <span className="wb-mark">
            <Dot tone="alert" /> Product layer missing
          </span>
          <span className="wb-mark">
            <Dot tone="amber" /> Not generated yet
          </span>
          <span className="wb-mark">
            <Dot tone="amber" small /> Source changed
          </span>
          <span className="wb-mark">
            <Dot tone="lilac" small /> Previewing on
          </span>
          <span className="wb-mark">
            <Dot tone="hollow" small /> App decides
          </span>
          <span className="wb-mark">
            <Dot tone="ring" /> Held for review
          </span>
        </div>
      </Frame>
    </States>
  );
}
