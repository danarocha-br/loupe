# AppearsOnInteraction

The components seen on this page that have no Instance mounted now, such as a menu's items or a dialog's parts (DESIGN.md "On this page"): a row each, its name and how to get it on screen to inspect it.

```tsx
<AppearsOnInteraction components={body.interaction} words={listWords} />
```

## Interface

- `components`: their names. Nothing is drawn while there are none.
- `words`: `interaction` (`title`, "Appears on interaction"; `meta`, "Not on screen yet"; `seen`, the line under each name).

## States

| Attribute | Draws |
| --- | --- |
| `data-interaction` | A `list` Card. |
| `data-interaction-list` | Its rows, each a Row `item` (ui/row/): a hairline above, 8px by 14px, the name and the line under it 2px apart. |
| `data-interaction-seen` | The line under the name, 12px muted (`--font-caption`). |

## ARIA and keys

The title is a level-3 heading; the rows are a list named by it. No keys: nothing here is a control.

## Tests

`interaction.test.tsx`: the heading and its count, a list item per component, nothing while empty, and axe.
