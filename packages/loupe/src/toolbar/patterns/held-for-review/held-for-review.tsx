// HeldForReview (ADR 0003, DESIGN.md "On this page"): the records Suspended for review
// (PER-95): a call site's total changed, or an id names more than one Instance. They apply
// to nothing until discarded, which the hollow ring says, in pencil (PER-140). A row each:
// what it names and Discard, why it is held, and what it would set. Nothing here opens a
// menu or a dialog to reach one.
//
// It draws panel-view's held records and `ListWords`, and builds none: Discard goes out
// through `onDiscard`, which makes the write in the view. See held-for-review.md.

import type { ListBody, ListWords, ScopeTarget } from "../../panel-view/index.js";
import { Button, Card, CardHead, Row } from "@loupe/ui";
import { DotTitle, HeldValues, Meta } from "../marks/marks.js";

export type HeldForReviewProps = {
  items: ListBody["suspended"];
  /** "2 · apply to nothing". */
  meta: string;
  words: Pick<ListWords, "held">;
  /** Discard pressed on a record: drop it. */
  onDiscard(target: ScopeTarget): void;
};

export function HeldForReview({ items, meta, words, onDiscard }: HeldForReviewProps) {
  if (items.length === 0) return null;
  return (
    <Card look="list" data-held-for-review="">
      <CardHead>
        <DotTitle tone="ring">
          <h3>{words.held.title}</h3>
        </DotTitle>
        <Meta>{meta}</Meta>
      </CardHead>
      <ul data-held-list="">
        {items.map((item) => (
          <Row key={JSON.stringify(item.target)} as="li" look="item" data-held-item="">
            <div data-held-target="">
              <span>{item.label}</span>
              <Button size="small" onClick={() => onDiscard(item.target)}>
                {words.held.discard}
              </Button>
            </div>
            <div data-held-why="">{item.why}</div>
            <HeldValues values={item.values} />
          </Row>
        ))}
      </ul>
    </Card>
  );
}
