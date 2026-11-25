# ChangeList

The page's numbered changes as the Proposal will list them, on the list with nothing selected (DESIGN.md "Revision marks"). A row each: its delta, what it changes from and to, and what it reaches. A row selects what it changed and outlines on the page every Instance it reaches; one whose Instances aren't mounted is off.

```tsx
<ChangeList changes={body.changes} words={listWords} onSelect={select} onHover={outline} />
```

## Interface

- `changes`: `panelView()`'s `ChangeItem`s: `n`, `detail` ('variant "ghost" → "outline"'), `where`, `select` (null while nothing it reaches is mounted), `reached`.
- `words`: `ListWords.changes` (the card's title and what it says of its numbers) and `ListWords.change(n)`, each delta's name.
- `onSelect(id)`, `onHover(ids)` (none clears).

Nothing is drawn with no change.

## States

| Attribute | Draws |
| --- | --- |
| `data-change-list` | Card `list`; its head the title and Marks' `Meta`. |
| `data-change-items` | An ordered list with no numbers: the deltas number it. |
| `data-change` | Each row, a button on its hairline, padded 8px by 14px: the delta in a column of its own, 10px before the rest; the hover wash under the pointer; its focus ring 2px inside; off at 45% when nothing it reaches is mounted. |
| `data-change-what`, `data-change-where` | What it changes in 12px mono, breaking anywhere; what it reaches under it, 12px muted. |

A row is the button itself, so its hover and focus reach the card's edges. Row draws a line, not a control, so it isn't one here.

## ARIA and keys

- The list is an `ol` named by the card's title, "Changes". Each delta is an image named "Change n".
- Each row is a button named by its delta, what it changes and what it reaches. Pointing or focusing outlines what it reaches; leaving clears it (Marks' `hovering`).
- Tab reaches each row that is on; Enter or Space selects.

## Tests

`change-list.test.tsx`: the list, its rows and their names, selecting and outlining, a change that is off, none, and axe.
