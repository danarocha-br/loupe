# HeldForReview

The records Suspended for review (DESIGN.md "On this page", PER-95): a call site's total changed, or an id names more than one Instance. They apply to nothing until discarded, which the hollow ring by the title says. Nothing here opens a menu or a dialog to reach one.

```tsx
<HeldForReview items={body.suspended} meta={body.suspendedMeta} words={LIST_WORDS} onDiscard={(target) => dropUndoably(debug, target, …)} />
```

## Interface

- `items`: panel-view's held records, each `{ target, label, why, values }`. Nothing is drawn while there are none.
- `meta`: "2 · apply to nothing".
- `words`: `held` (`title`, "Held for review"; `discard`, "Discard").
- `onDiscard(target)`: Discard pressed. The view drops the record, offers it back, and moves focus to its heading, since the card may go with its last record.

## States

| Attribute | Draws |
| --- | --- |
| `data-held-for-review` | A `list` Card. |
| `data-held-title` | The hollow ring (Dot `ring`) before the title, 8px apart. |
| `data-held-item` | A Row `item` (ui/row/): the hairline and the 14px inset are the Row's; this card pads it 10px above and below and sets its parts 6px apart. |
| `data-held-target` | What it names in 12px mono on a 16px line, and Discard at the right. |
| `data-held-why` | Why it is held, 12px muted (`--font-caption`). |

Under it, what it would set (Marks' `HeldValues`).

## ARIA and keys

The title is a level-3 heading; the records are a list. Discard is a small Button; Tab reaches each, Enter or Space presses it.

## Tests

`held-for-review.test.tsx`: the heading and its count, a row per record, Discard through its callback, nothing while empty, and axe.
