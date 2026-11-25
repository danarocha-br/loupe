// ChangeList (ADR 0003, DESIGN.md "Revision marks"): the page's numbered changes, as the
// Proposal will list them, on the list with nothing selected. A row each: its delta, what
// it changes from and to, and what it reaches. A row selects what it changed and outlines
// on the page every Instance it reaches; one whose Instances aren't mounted is off.
//
// It draws `panelView()`'s `ChangeItem`s and `ListWords` and builds none: selecting and
// outlining go out through its callbacks. See change-list.md.

import type { ChangeItem, ListWords } from "../view.js";
import { Card, CardHead } from "@loupe/ui";
import { ChangeKey, hovering, Meta } from "../marks/marks.js";

export type ChangeListProps = {
  changes: readonly ChangeItem[];
  words: Pick<ListWords, "changes" | "change">;
  /** A change pressed: select the Instance it names. */
  onSelect(id: string): void;
  /** Outline these Instances on the page while a change is pointed at or focused; none clears. */
  onHover(ids: string[]): void;
};

export function ChangeList({ changes, words, onSelect, onHover }: ChangeListProps) {
  if (changes.length === 0) return null;
  return (
    <Card look="list" data-change-list="">
      <CardHead>
        <h3>{words.changes.title}</h3>
        <Meta>{words.changes.meta}</Meta>
      </CardHead>
      <ol data-change-items="" aria-label={words.changes.title}>
        {changes.map((change) => (
          <li key={change.n}>
            <button
              type="button"
              data-change={change.n}
              disabled={change.select === null}
              onClick={() => change.select !== null && onSelect(change.select)}
              {...hovering(onHover, change.reached)}
            >
              <ChangeKey n={change.n} words={words} />
              <span data-change-what="">{change.detail}</span>
              <span data-change-where="">{change.where}</span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
