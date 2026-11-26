# StartCard

The list's first card, with nothing selected (DESIGN.md "Start"): "What do you want to change?", a line under it, and the two select tools as tiles side by side, each showing what its tool does.

```tsx
<StartCard words={listWords} mode={mode} armed={picking} onTool={onTool} headingRef={heading} />
```

## Interface

- `words`: `start` (`title`, `body`, and `tools`, the tiles' group name, "Start selecting") and `tools` (each mode's `label`, `hint` and `title`). The header's select tools take the same words.
- `mode`: `one` or `many`, the tool in use. `armed`: a tool waits for a click on the page.
- `onTool(mode)`: a tile chosen, or the checked one pressed again (the view stops picking then).
- `headingRef`: the view's heading, where focus goes as the list opens.
- `ToolPreview` (`mode`): the tile's picture, by itself.

## States

| Attribute | Draws |
| --- | --- |
| `data-start` | A plain Card, its parts set apart by their own margins, 16px from its top. The heading in the hero style, balanced; the line under it 6px down in the paragraph style, muted. |
| `data-start-tools` | Two tiles in two equal columns, 8px apart, 14px under the line. |
| `data-start-tool` | A tile: `card`, 14px corners, the tile shadow, padded 4px 4px 12px; raised under the pointer. |
| `data-checked` | The mode: a 1px `field-edge` ring. |
| `data-armed` | Waiting for a click: a 1.5px coral ring, raised. |
| `data-tool-preview`, `data-preview-chip`, `data-preview-pointer` | A 56px `sunk` well, 10px corners: three 28 × 16px controls and a pointer; the middle one ringed in coral 3px off (`ringed`), and for Select multiple the other two dashed (`dashed`). |
| `data-tool-name`, `data-tool-hint` | The tool's name, 13px at 600; its hint, 11px on a 15px line, faint. |

## ARIA and keys

- The heading is the view's one `h2`, focusable from script (`tabIndex={-1}`). Focus that lands on it by keyboard draws the ground's `:focus-visible` ring, as the Inspector's heading does; a click that opens the list draws none.
- The tiles are a radio group (ChipGroup) named "Start selecting", one Tab stop; the mode is the checked radio. Armed is a state of the page, said by the status strip, never on the radio.
- The arrow keys move between the tiles, Space or Enter chooses (ChipGroup's manual activation), and pressing the checked tile chooses it again.
- The preview is hidden: the name and hint say it.

## Tests

`start-card.test.tsx`: the heading and its ref, the radio group and its tiles, armed, choosing and choosing again, and axe.
