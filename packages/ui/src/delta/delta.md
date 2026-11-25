# Delta

The revision's triangle (DESIGN.md "Shapes", "Revision marks"): a change's number, as a drawing numbers its revisions. It sits before a changed prop's name, at the right of the identity, and before each row of the change list. Empty and dashed, it marks a value held open, which has no number.

```tsx
<Delta n={1} label="Change 1" title="Change 1 in the Proposal" />
<Delta title="Held by your Override: shown as a state in the Proposal" />
```

## Interface

- `n` and `label`, together: the number, and the name a screen reader reads ("Change 1"). A bare "1" means nothing without what it numbers, so the caller names it.
- Neither: empty, dashed, no number.
- `title`: more on hover (where the number appears). A tooltip reaches neither a keyboard nor a touch screen.
- `className` and any `data-*` attribute pass through. Where it sits in a row is the caller's.

## States

| Attribute | Draws |
| --- | --- |
| `data-delta` | 22 × 20px: a triangle in `card`, a 1.25px `revision-line` stroke with round joins. |
| `data-delta-n` | The number at the base, in the delta's own type step (700 9px/1, tabular) and `revision-text`. |
| `data-empty` | The stroke dashed (2.2 on, 1.6 off), no number. |

Under forced colours the triangle is `Canvas` with a `CanvasText` stroke and the number `CanvasText`.

## ARIA and keys

- Numbered: `role="img"` with the caller's `aria-label`; the triangle and the number inside are its picture, not read on their own.
- Empty: `aria-hidden`. It repeats in shape what the row says in words (its "State prop" tag, the holding notice), so it adds nothing to hear.
- No keys. It is never focusable; a row that holds it is.

## Tests

`delta.test.tsx` draws both inside a real shadow root, finds the numbered one by its role and name, checks the empty one is hidden, and runs axe.
