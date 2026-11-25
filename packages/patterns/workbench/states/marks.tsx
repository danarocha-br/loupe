import { Frame, States } from "@loupe/ui/workbench";
import { Breakable, DotTitle, HeldKey, HeldValues, hovering, Keys, Meta, StatusChip, TagChip } from "../../src/index.js";
import { HELD, LIST_SUMMARY, MISSING_NOTICE, STALE_NOTICE, STATUSES, TAGS, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** The marks the patterns share: deltas, status chips, tags, names that break, held values, dot titles, a count, a hue. */
export function MarksStates() {
  const { say, Said } = useSaid();
  return (
    <States>
      <Frame title="Keys: an Instance's change numbers; HeldKey: a held state's empty delta">
        <div className="wb-marks">
          <Keys keys={[1, 2, 3]} words={WORDS.inspector} />
          <HeldKey words={WORDS.inspector} />
        </div>
      </Frame>
      <Frame title="StatusChip: Supported with its tick, Inspect only, Not generated yet, a plain status">
        <div className="wb-marks">
          {STATUSES.map((status) => (
            <StatusChip key={status.text} status={status} check={status.kind === "supported"} />
          ))}
        </div>
      </Frame>
      <Frame title="TagChip: each kind in its look">
        <div className="wb-marks">
          {TAGS.map((tag) => (
            <TagChip key={tag.kind} tag={tag} />
          ))}
        </div>
      </Frame>
      <Frame title="Breakable: a name that breaks only between its words">
        <p className="wb-name">
          <Breakable text="AlertDialogContent" />
        </p>
      </Frame>
      <Frame title="HeldValues: what a held record would set">
        <HeldValues values={HELD[0]?.values ?? []} />
      </Frame>
      <Frame title="DotTitle: a notice's tone, a held record's ring; Meta: a card head's count">
        <div className="wb-titles">
          <DotTitle tone={MISSING_NOTICE.tone}>{MISSING_NOTICE.title}</DotTitle>
          <DotTitle tone={STALE_NOTICE.tone}>{STALE_NOTICE.title}</DotTitle>
          <DotTitle tone="ring">{WORDS.list.held.title}</DotTitle>
        </div>
        <div className="wb-marks">
          <Meta>{LIST_SUMMARY}</Meta>
        </div>
      </Frame>
      <Frame title="hovering(): point at or focus the button to outline what it names">
        <div className="wb-marks">
          <button type="button" {...hovering((ids) => say(ids.length ? `outline ${ids.join(", ")}` : "outline none"), ["button-1", "button-2"])}>
            Two Instances
          </button>
        </div>
      </Frame>
      <Said />
    </States>
  );
}
