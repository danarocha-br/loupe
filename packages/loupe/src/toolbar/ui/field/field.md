# Field

A text control with its label, an optional hint and marker, and its error: Copy Proposal's Title and Designer, the Proposal's text in a refused copy, a text prop's field in the Inspector. It is UI SDK's `@ui-sdk/react/field` around its `input` or `textarea`, behind Loupe's own interface: plain props, and the caller keeps the value.

```tsx
<Field label="Title" name="title" required error={missing ? TITLE_MISSING : undefined} value={title} onValueChange={setTitle} />
<Field label="Designer" optional="optional" placeholder="Who is asking for this?" value={designer} onValueChange={setDesigner} />
<Field label="children" labelHidden look="outline" multiline autoResize rows={1} value={text} onValueChange={set} />
<Field label="The Proposal" labelHidden look="well" multiline readOnly value={proposal} ref={text} />
```

## Interface

- `label`: names the control, shown above it. `labelHidden` keeps it for a screen reader only, where the row around the field already shows the name.
- `optional`: the marker after the label, in the caller's words ("optional"). It is part of the name a screen reader says.
- `hint`: under the control, describing it.
- `error`: under the control while it is set. It marks the control invalid and describes it; unset, both go.
- `look`: `filled` (the default), `outline` or `well`.
- `value` and `onValueChange(value)`: the caller keeps the value. UI SDK shows what was typed until the caller's next render, so a caller that refuses a value renders again to put it back.
- `multiline`: a `textarea` instead of an `input`. With it, `autoResize` grows it with its text (`field-sizing: content` where the browser has it, measured where not).
- `ref`, `name`, `required`, `readOnly`, `placeholder`, `rows`, `spellCheck`, `onKeyDown`, `onBlur` and the other native props pass to the control. `className` goes on the field around the label and the control.

## States

| Attribute | On | Draws |
| --- | --- | --- |
| `data-look="filled"` | the field | A 36px `sunk` box on a 1px `field-edge` ring, 10px corners, `--font-body`. Focused, it turns `card` with a 1.5px `accent` ring and the `focus-glow`. |
| `data-look="outline"` | the field | The `card` on a 1px `field-edge` border, 12px corners, at least 36px and as tall as its text. Focused, an `accent` border and the glow. |
| `data-look="well"` | the field | A 130px window (`--field-well-height`) on the `hover` fill with a `popover-edge` ring, its 10px mono text fading out at its foot. Focused, a 1.5px inset `accent` ring. |
| `data-invalid` (UI SDK's) | the field | A filled box's ring, an outline's border, turn `alert`. |

The label is `--font-label` in `muted`, the marker `faint`; a hint is `--font-caption` in `muted`, an error `--font-caption` in `warn-fg`.

Each focus ring is box-shadows beside a transparent 2px outline: forced colours drop the shadows and draw the outline (`Highlight`), and a filled box keeps a `CanvasText` edge. On a touch screen the filled and outline text is 16px or more, so iOS doesn't zoom in on focus.

A view rule may still adjust the control (`.row.overridden .text [data-field-control]` turns a changed prop's edge `shown-edge`): the views' rules come after the `primitives` layer.

## ARIA and keys

- A native `input` or `textarea` (`textbox`), named by its label through `aria-labelledby`, beside a native `<label for>`. Pressing the label focuses it.
- The hint and any error describe it through `aria-describedby`; while there is an error, `aria-invalid="true"`.
- Typing, selection and the browser's editing keys are the element's own. **Enter** in a multiline field adds a line unless the caller stops it (a text prop is one line). **Escape** is not its.

## Tests

`field.test.tsx` draws it inside a real shadow root, by role (`textbox` by name), with `user-event` and axe.
