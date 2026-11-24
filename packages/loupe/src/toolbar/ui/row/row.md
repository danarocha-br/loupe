# Row

A line inside a card: a prop in the Inspector, a prop or a value under Inspect only, a feature flag, a notice's module, an Instance's note, a record held for review. An optional glyph in a column of its own, then a line of a name, what qualifies it, a value and an action, then whatever sits under the line (chips, a field, a notice).

```tsx
<Row glyph={<SizeIcon />} data-prop="size">
  <RowLine>
    <Delta n={2} />
    <RowName code="size">Size</RowName>
    <Tag>State prop</Tag>
    <RowValue>"md"</RowValue>
    <RowAction>
      <Button size="small">Reset</Button>
    </RowAction>
  </RowLine>
  <ChipGroup label="Size" …>…</ChipGroup>
</Row>
```

## Interface

- `Row`:
  - `look`, `inset` by default:
    - `inset`: padded 14px at the top and sides and 13px at the foot, so its glyph stands 15px under the hairline above it, as Paper draws it; what is under the line 13px apart. For a card with no padding of its own, the `divided` Card, which draws the hairline.
    - `ruled`: a 1px `rule` hairline above, 8px above and below, nothing at the sides; what is under the line 8px apart. For a padded card: a notice's modules, Feature flags.
    - `pair`: ruled, 6px above and below, 2px apart; its line is two mono columns, the name (12px, `muted`, at least 96px or 38%) and the value (12px, ink), then anything else. The code name is left to the tooltip.
    - `item`: a 1px `rule` hairline above, padded 8px above and below and 14px at the sides; what is under the line 2px apart. For a `list` Card, whose rows run edge to edge: Held for review, Appears on interaction. A caller with its own rhythm sets `--row-gap` and the padding above and below (Held for review: 10px, 6px apart).
  - `glyph`: a 20px icon in a 20px column of its own, 8px before the content, so the names line up 42px into an `inset` row whatever the glyph. It sits centred on the row's first line: a name that wraps grows the row below it, not around it. Hidden from assistive technology.
  - `as`: `div`, or `li` in a list.
  - `role`: the view's, when the row is more than a line (an Instance's note is a `note`).
  - `className` and any `data-*` attribute (`data-prop`, `data-flag`, a test's `data-testid`).
- `RowLine`: the line. A flex row that wraps, its parts 6px apart, at least 20px tall. A delta placed in it overhangs by its triangle so the name keeps its place.
- `RowName`: the name, in the title style (14px/500, `-0.01em`). `code` puts the name as written in code after it, 11px mono `faint`. `mono` sets the name itself in mono at 500 (a flag's key). `title` for more on hover.
- `RowValue`: the value, 11px mono `muted`, taking the line's free space and set at its right; figures tabular. `title` for more on hover.
- `RowAction`: what acts on the row, at the line's right edge, its parts 8px apart: a reset, a switch, a Clear.

Every part takes `className` and `data-*`.

## States

| Attribute | Draws |
| --- | --- |
| `data-row` | The look above. |
| `data-glyphed` | Set when a glyph is given: a grid of the 20px glyph column and the content. |
| `data-row-glyph` | The glyph's cell, centred on the first line (`--row-line` tall), in ink. |
| `data-row-line` | The line, `--row-line` (20px) tall at least. |
| `data-row-name`, `data-mono` | The name, in mono when `data-mono` is set. |
| `data-row-code` | The code name after the name; hidden in a `pair`. |
| `data-row-value`, `data-row-action` | The value and the action, at the line's right. |

A switch at the line's end is 22px: the row reads it from Switch's own `[data-switch]`, so `--row-line` grows to 22px, the glyph stays centred on the switch, the row's foot pads 14px, and the line stops wrapping, the name giving way instead.

Under forced colours the hairlines are borders and the glyph is ink, both drawn in `CanvasText`.

## ARIA and keys

- No role of its own: a Row is read in the order of its parts, name, what qualifies it, value, action. In a list it is the list item (`as="li"`).
- The glyph is `aria-hidden`: it repeats in a picture what the name says.
- No keys of its own. Its action's keys are the action's: a Reset is a Button, a switch a Switch. The row is never focusable.

## Tests

`row.test.tsx` draws each look inside a real shadow root, reads a line in order, finds the list item, the note and the action's switch by role, turns the switch from the keyboard, and runs axe.
