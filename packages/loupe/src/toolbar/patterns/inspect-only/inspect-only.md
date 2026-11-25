# InspectOnly

The props an Instance shows but can't change here, folded to one row at the foot of the Inspector's card (DESIGN.md "Inspect only"); open when nothing else on the Instance can change. Folded, the row names them; one cause for them all is said once, under the row, instead of a tag on every row. The props the library sets fold under the rest.

```tsx
<InspectOnly key={body.id} inspect={body.inspect} row={(item) => <PropRowView item={item} look="pair" … />} />
```

The view keys it by the Instance, so another selection starts folded or open afresh.

## Interface

- `inspect`: `panelView()`'s `InspectOnlyView`: `title` ("Inspect only · 6"), `names` (said after the title while folded, its " · " included), `meta` ("Overrides off"), `open` (how it first draws), `shared` (`{ reason, title }`, the one reason every prop shares), `rows`, `empty` ("None"), `injected` (`{ summary, rows }`, the library's props).
- `row(item)`: a prop's row, the view's, so its writes stay the view's: a PropRow `pair`.

## States

| Attribute | Draws |
| --- | --- |
| `data-inspect-fold` | The fold, clipped to the card. |
| Its trigger | A row 44px at least, padded 12px by 14px: the eye in the 20px glyph column, the title, Marks' `Meta`, the chevron (muted); the hover wash under the pointer; its focus ring 2px inside. |
| `data-inspect-fold-title`, `data-inspect-fold-names` | The title in `--font-title`, on one line, ellipsed; the names after it in 12px, muted. |
| `data-inspect-fold-why` | The shared reason: its Tag `reason`, then what it means, 12px muted, 42px in. |
| `data-inspect-fold-rows` | The rows, 42px in. `data-inspect-fold-empty`: "None", muted. |
| `data-inspect-fold-injected` | The library's props, a Fold of its own, 42px in: "2 set by the library" in 12px muted, then a Row `pair` each. |

## ARIA and keys

- The row is Fold's trigger, a button with `aria-expanded`; its eye is hidden. The library's fold is a second.
- The shared reason's tag carries what it means in its tooltip, and says it after it too.
- Tab reaches the row, the rows' controls, then the library's fold. Enter or Space opens and closes.

## Tests

`inspect-only.test.tsx`: folded with its names, opened to its rows, the library's fold, open by itself with one reason said once, "None", and axe folded and open.
