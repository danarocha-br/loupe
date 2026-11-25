// Notice and InstanceNote (ADR 0003, DESIGN.md "Notices and status"). A notice is a card
// over the panel's content: the Product layer missing, in another format, or changed since
// `generate`; components it has never read; Overrides off. Its dot says how bad (red stops
// Loupe working, amber may be out of date), its rows name what it is about, and its command
// fixes it, for the reader to run. An Instance's note is a row of the Inspector's card, not
// a card (One Card Deep): why nothing on it can change, said once.
//
// Both draw panel-view's words and build none; the copy is the view's (`onCopy`). The
// panel says each notice through its live regions, so the card carries no role. See notice.md.

import type { CommandWords, InspectorBody, NoticeView } from "../../panel-view/index.js";
import { Card, CardHead, InfoIcon, Row, RowLine, RowValue } from "@loupe/ui";
import { CommandLine } from "../command/command.js";
import { DotTitle, Meta } from "../marks/marks.js";

export type NoticeProps = {
  notice: NoticeView;
  /** The command's Copy. */
  words: CommandWords;
  /** Put the command on the clipboard; rejects when the clipboard refuses it. */
  onCopy(text: string): Promise<void>;
};

export function Notice({ notice, words, onCopy }: NoticeProps) {
  return (
    <Card data-notice={notice.kind} data-testid={`${notice.kind}-notice`}>
      <CardHead>
        <DotTitle tone={notice.tone}>{notice.title}</DotTitle>
        {notice.meta && <Meta>{notice.meta}</Meta>}
      </CardHead>
      <p data-notice-body="">{notice.body}</p>
      {notice.rows.length > 0 && (
        <ul data-notice-rows="">
          {notice.rows.map((row) => (
            <Row as="li" look="ruled" key={row.key}>
              <RowLine>
                {row.value === null ? (
                  row.text
                ) : (
                  <>
                    <span>{row.text}</span> <RowValue title={row.valueTitle ?? undefined}>{row.value}</RowValue>
                  </>
                )}
              </RowLine>
            </Row>
          ))}
        </ul>
      )}
      {notice.command && <CommandLine text={notice.command} words={words} onCopy={onCopy} />}
    </Card>
  );
}

export type InstanceNoteProps = {
  /** Why nothing on the Instance can change: its kind's title, and the sentence. */
  note: Pick<NonNullable<InspectorBody["note"]>, "title" | "body">;
};

/** An Instance's note: a row with the info glyph, its title over its paragraph, read as a note. */
export function InstanceNote({ note }: InstanceNoteProps) {
  return (
    <Row glyph={<InfoIcon />} role="note" data-instance-note="">
      <div data-instance-note-text="">
        <h3>{note.title}</h3>
        <p>{note.body}</p>
      </div>
    </Row>
  );
}
