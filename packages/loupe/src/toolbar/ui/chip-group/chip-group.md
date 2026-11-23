# ChipGroup

Choosing one value from a set, as chips. It is a radio group wherever it appears (ADR 0003): a prop's options, a flag's options, the select tools' mode in the header and the start tiles. It is built on UI SDK's `@ui-sdk/react/radio`, behind Loupe's own interface.

```tsx
<ChipGroup label="variant" value={checked} onChoose={(value) => write(value)}>
  <Chip value="solid" tag="app" description="the app’s value">solid</Chip>
  <Chip value="ghost" count={3}>ghost</Chip>
  <Chip value="link" dot description="the design system’s default">link</Chip>
</ChipGroup>
```

The group owns the keys, the tab stop and the ARIA. Each Chip's content is the caller's.

## Interface

- **`ChipGroup`**
  - `label`: the group's accessible name.
  - `value`: the checked chip's value, or `null` to check none, for a group whose value is decided elsewhere (a flag while the app decides).
  - `onChoose(value)`: a chip was chosen, by a click, Space or Enter, on any chip, the checked one included. The group is controlled: nothing is checked until the caller passes the new `value`.
  - `look`: `chips` (the default) draws the option chips; `bare` leaves the look to the caller's `className` and lays a chip's content out as its own children (the select tools, the start tiles).
  - `busy`: a choice is on its way. It is said on the group (`aria-busy`), and the chips stay usable, so focus is never dropped.
- **`Chip`**
  - `value`: a string. A caller with other values keys them: by type and value (`string:ghost`), or by place in the list.
  - `tag`: a short tag after the label, which also rings the chip ("app").
  - `dot`: a dot after the label (the design system's default).
  - `count`: a number after everything else (Instances showing this value at a scope).
  - `description`: what the marks mean, read after the label by a screen reader. The tag is `aria-hidden`, so it isn't read twice.
  - Any `data-*` attribute passes through to the button (`data-option`, `data-scope`, `data-armed`).

## States

Every state is an attribute on the chip, and `chip-group.css` styles the attributes, not Loupe's classes:

| Attribute | Set by | Meaning |
| --- | --- | --- |
| `data-checked` / `data-unchecked` | UI SDK | The value that shows now (salmon, its ring, 500 weight). |
| `data-disabled` | UI SDK | Not used by any call site yet (45% opacity). |
| `data-tagged` | Chip | The app's own value under an Override: a `field-edge` ring, ink text and its tag. |
| `data-dotted` | Chip | The design system's default: a 4px faint dot after the label. |
| `[data-part="count"]` | Chip | The count, faint, inherits the colour when checked. |
| `:focus-visible` | the browser | A 2px `accent` outline, 1px off (UI SDK's radio has no focus attribute). |

Under forced colours the checked chip is `Highlight` on `HighlightText`, the tag's ring a dashed `CanvasText` outline, the dot `CanvasText`, and focus a `Highlight` outline above the dashes.

## ARIA

- The group is `role="radiogroup"` with `aria-label`; each chip is `role="radio"` with `aria-checked`.
- With nothing checked, every chip is `aria-checked="false"`.
- `aria-busy="true"` on the group while `busy`.

## Keys

This is the manual-activation form of the radio pattern:
- **Arrow keys** move focus to the next or previous chip, and wrap. They choose nothing. At a group or page scope, choosing as focus moves would write an Override to many Instances on every press, and a flag would make a server write.
- **Space** or **Enter** chooses the focused chip. Held down, Enter chooses once.
- **Tab** reaches the group once: the checked chip holds the tab stop, or the first chip while none is checked. Once focus moves inside the group, the stop moves with it.
- **Escape** is not the group's. It is never prevented or stopped, so the app, or Loupe's window-level Esc (`escape.ts`), has it.

UI SDK's radio reports an arrow as a `list-navigation` change and Enter as a form submission. The wrapper cancels the first and handles the second itself, and it also chooses when the checked chip is pressed again, since UI SDK reports no change then. These three answer ADR 0003's open question: the primitive adds manual activation.

## Tests

`chip-group.test.tsx` draws the group inside a real shadow root (`surface/render.fixture.tsx`), queries it by role with Testing Library, presses keys with `user-event`, and runs axe.
