// FlagsCard and FlagRow (ADR 0003, DESIGN.md "Notices and status"): the Feature flags card
// (PER-132), the MVP's only rule preview (PER-92). Each flag the app declares, its options
// as one radio group, and what shows now; Clear on a flag previewed, and Clear flag
// previews under them all. While previews are off, one line says so, and why once opened.
//
// It draws panel-view's `FlagsCardView` and builds no words. It writes nothing: a preview
// and a clear go out through its callbacks, which ask the flags store, in the view; `busy`
// is the view's while a write is out. See flags-card.md.

import type { Ref } from "react";
import type { CommandWords, FlagRowView, FlagsCardView, FlagValue } from "../../panel-view/index.js";
import {
  Button,
  Card,
  CardHead,
  Chip,
  ChipGroup,
  ClockIcon,
  Dot,
  Fold,
  FoldChevron,
  FoldPanel,
  FoldTrigger,
  ResetIcon,
  Row,
  RowAction,
  RowLine,
  RowName,
} from "../../ui/index.js";
import { CommandLine } from "../command/command.js";
import { Meta } from "../marks/marks.js";

export type FlagsCardProps = {
  flags: FlagsCardView;
  /** A write is out: another press waits its turn. */
  busy: boolean;
  /** The card's element, for the view that moves focus within it. */
  ref?: Ref<HTMLDivElement>;
  /** An option chosen: preview the flag at its value. */
  onPreview(key: string, value: FlagValue): void;
  /** A flag's Clear pressed, given the button, so focus can move on once it has gone. */
  onClear(key: string, from: HTMLElement): void;
  /** Clear flag previews pressed, given the button. */
  onClearAll(from: HTMLElement): void;
  /** The fix's Copy. */
  words: CommandWords;
  onCopy(text: string): Promise<void>;
};

export function FlagsCard({ flags, busy, ref, onPreview, onClear, onClearAll, words, onCopy }: FlagsCardProps) {
  return (
    <Card data-flags="" ref={ref}>
      <CardHead>
        <h3>{flags.title}</h3>
        {flags.meta && <Meta>{flags.meta}</Meta>}
      </CardHead>
      {flags.loading && <div data-flags-muted="">{flags.loading}</div>}
      {flags.off && (
        // One line until it's opened: the fix is an engineer's, and the list comes first.
        <Fold data-flags-off="">
          <FoldTrigger>
            <Dot tone="amber" small />
            {flags.off.title}
            <span data-flags-muted="">{flags.off.why}</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <div data-flags-why="">
              <div data-flags-reason="">{flags.off.reason}</div>
              {/* The one fix the reader makes in a file: say which and where. */}
              {flags.off.fix && <CommandLine text={flags.off.fix.text} copy={flags.off.fix.copy} prompt={false} words={words} onCopy={onCopy} />}
            </div>
          </FoldPanel>
        </Fold>
      )}
      {flags.empty && <div data-flags-muted="">{flags.empty}</div>}
      {flags.rows.map((row) => (
        <FlagRow key={row.key} row={row} busy={busy} onPreview={(value) => onPreview(row.key, value)} onClear={(from) => onClear(row.key, from)} />
      ))}
      {flags.error && (
        <div data-flags-error="">
          <Dot tone="amber" />
          {flags.error}
        </div>
      )}
      {flags.lasts && (
        <div data-flags-lasts="">
          <ClockIcon />
          <span>{flags.lasts}</span>
        </div>
      )}
      {flags.clearAll && (
        <Button data-flags-clear="" disabled={busy || !flags.clearAll.enabled} onClick={(event) => onClearAll(event.currentTarget)}>
          <ResetIcon />
          {flags.clearAll.label}
        </Button>
      )}
    </Card>
  );
}

export type FlagRowProps = {
  row: FlagRowView;
  busy: boolean;
  onPreview(value: FlagValue): void;
  /** Given the Clear button, so focus can move on once it has gone. */
  onClear(from: HTMLElement): void;
};

/** One flag: its key, Clear while previewed, what it does, and its options as one radio group. */
export function FlagRow({ row, busy, onPreview, onClear }: FlagRowProps) {
  return (
    <Row look="ruled" data-flag={row.key} data-previewing={row.previewing ? "" : undefined}>
      <RowLine>
        <Dot tone={row.previewing ? "lilac" : "hollow"} small />
        <RowName mono>{row.key}</RowName>
        {row.clear && (
          <RowAction>
            <Button size="small" disabled={busy} onClick={(event) => onClear(event.currentTarget)}>
              <ResetIcon />
              {row.clear}
            </Button>
          </RowAction>
        )}
      </RowLine>
      {row.description && <div data-flags-muted="">{row.description}</div>}
      {row.note && <div data-flags-muted="">{row.note}</div>}
      <div data-flag-foot="">
        {row.options.length > 0 && (
          // One of a flag's options, or none while the app decides: a radio group with nothing checked.
          <ChipGroup
            label={row.key}
            value={row.checked === -1 ? null : String(row.checked)}
            busy={busy}
            onChoose={(index) => {
              const option = row.options[Number(index)];
              if (option) onPreview(option.value);
            }}
          >
            {/* Chips take string values: each option by its place in the list. */}
            {row.options.map((option, index) => (
              <Chip key={JSON.stringify(option.value)} value={String(index)}>
                {option.label}
              </Chip>
            ))}
          </ChipGroup>
        )}
        <div data-flag-state="">{row.state}</div>
      </div>
    </Row>
  );
}
