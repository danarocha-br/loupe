# PropRow

One prop of the Inspector, as `panelView()` decided it (DESIGN.md "Property rows"). A Row with the prop's glyph, or under Inspect only a `pair`; then its control, and what qualifies it.

```tsx
<PropRow
  item={item}
  words={inspectorWords}
  onSet={(write, value) => debug.set(write.id, write.prop, value, write.scope)}
  onText={(write, text) => debug.set(write.id, write.prop, text, write.scope)}
  oneLine={singleLine}
  onReset={(write) => debug.reset(write.id, write.prop, write.scope)}
  onSelect={(id) => select(id, "one")}
  onHover={outline}
/>
```

## Interface

- `item`: `panelView()`'s `PropItem`. `words`: `panelView()`'s `InspectorWords`. It draws both and builds no word of its own.
- `look`: `inset` (the Inspector's card, with `PROP_ICONS[item.glyph]` in the glyph column) or `pair` (Inspect only: name and value side by side, no glyph).
- `onSet(write, value)`: a chip chosen, or a switch turned. `onText(write, text)`: label text as typed, after `oneLine`. `oneLine(text)`: the view's rule for one line (a line break becomes a space); the field shows its result too, so a pasted break never waits in the field for a blur. `onReset(write)`: Reset pressed. `onSelect(id)`: "1 of 4 keeps its own value" pressed. `onHover(ids)`: those Instances outlined while the pointer or focus is on the note; `[]` clears.

## What it draws, in order

1. **The line**: the change's delta (`ChangeKey`), or a held State prop's empty one (`HeldKey`); the name, with its code name after it when they differ; "empty" for label text left empty; "State prop"; the value when no control shows it; the counts at a scope; the reason tag; and at the right Reset (round and icon-only beside a switch) or the switch.
2. **The change line**, 2px under it: `"ghost" → "outline"`, then "· from All on page" only when `item.wider`.
3. **The control**, 13px under the head: chips (ChipGroup), a one-line Field, or the reason it gets none, after a lock.
4. **Under the control**: "App value: …", the holding notice with its two values in `code` and Reset in it, and the note of who keeps their own value.

## States and ARIA

| Attribute | Draws |
| --- | --- |
| `data-prop` | The prop's name: the row, for the view's and the tests' queries. |
| `data-overridden` | Overridden at this scope: a text field's edge turns `shown-edge`. |
| `data-prop-head`, `data-prop-change`, `data-prop-arrow`, `data-prop-to`, `data-prop-source` | The head and the change line: mono 11px, the arrow faint, the new value in ink at 600. |
| `data-prop-current`, `data-prop-explain`, `data-prop-refusal`, `data-prop-held`, `data-prop-keeping` | What is under the control: caption text; the held notice in a `well`; the keeping note in navy, underlined. |
| `data-value` | A value that is the component's default (with its tooltip) or not set: muted. |

The chips are a radio group named by the prop, one Tab stop: arrow keys move, Space or Enter chooses (manual activation, so a scope is never written on each key). A chip's marks, "the app’s value" and "the design system’s default", are part of its name. The switch is named by the prop. The field is named by the prop, its label hidden: the row shows the name. A held value the app pushes back on is announced as it lands.

## Keys

- **Reset** shows "Reset" (or "Reset to group value", "Reset to page value") and is named by the prop it resets, after that (`reset.name`: "Reset variant", "Reset to group value for variant"), so a card of them doesn't read as one name repeated; beside a switch, icon-only, that name is its hidden text. It keeps focus in the row: it moves to the chips' checked chip, the switch or the field.
- **Enter** in the text field does nothing: label text is one line.
