import { Tag } from "../../src/index.js";
import { Frame, States } from "./frame.js";

/** Tag in each look. */
export function TagStates() {
  return (
    <States>
      <Frame title="Plain, reason, picked, amber, ring, dashed, empty">
        <div className="wb-line">
          <Tag>State prop</Tag>
          <Tag look="reason" title="The library sets this prop; the call site doesn’t pass it">
            set by the library
          </Tag>
          <Tag look="picked">picked</Tag>
          <Tag look="amber">Source changed</Tag>
          <Tag look="ring">Held for review</Tag>
          <Tag look="dashed">Not visible now</Tag>
          <Tag look="empty">empty</Tag>
        </div>
      </Frame>
    </States>
  );
}
