import { Frame, States } from "@loupe/ui/workbench";
import { Breakable, DotTitle, HeldKey, HeldValues, hovering, Keys, Meta, StatusChip, TagChip } from "../../src/index.js";
import { HELD, LIST_SUMMARY, MISSING_NOTICE, STALE_NOTICE, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** Each of `panelView()`'s tags, in its words. */
const TAGS = [
  { kind: "server", text: "On the server" },
  { kind: "suspended", text: "Held for review" },
  { kind: "not-mounted", text: "No Instance mounted" },
  { kind: "stale", text: "Source changed" },
  { kind: "left-out", text: "Left out" },
  { kind: "left-out-unmounted", text: "Left out · not mounted" },
  { kind: "not-visible", text: "Not visible now" },
] as const;

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
          <StatusChip status={{ kind: "supported", text: "Supported" }} check />
          <StatusChip status={{ kind: "inspect-only", text: "Inspect only" }} />
          <StatusChip status={{ kind: "not-generated", text: "Not generated yet" }} />
          <StatusChip status={{ text: "Not on the page now" }} />
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
