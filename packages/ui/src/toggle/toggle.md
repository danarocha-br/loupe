# Toggle

A button that stays pressed: Hide marks in the header, Hold open at a scope, light or dark in the footer. It is a native button with `aria-pressed` on UI SDK's `@ui-sdk/react/toggle`, behind Loupe's own interface, and it draws with Button's looks.

```tsx
<Toggle look="tool" iconOnly pressed={marksHidden} onPressedChange={toggleMarks}>
  {marksHidden ? <MarksHiddenIcon /> : <MarksIcon />}
  <span className="sr-only">Hide marks</span>
</Toggle>
```

## Interface

- `pressed`: pressed now. The caller keeps it: nothing changes until the caller passes the new value.
- `onPressedChange(pressed)`: a press asks for the other state.
- `look`, `size`, `iconOnly`: Button's (`button.md`).
- `marksPressed`: whether the button itself shows it's pressed, `true` by default. The theme toggle passes `false`: the whole panel turning dark says it.
- `disabled`, `ref`, `title`, `aria-*`, `data-*` and the other button props pass through.

## States

| Attribute | Set by | Draws |
| --- | --- | --- |
| `data-pressed` | UI SDK | On a soft pill: `shown` salmon with its `shown-edge` ring (Hold open while it holds). On a tool: filled `sunk` with a `primary` icon. |
| `data-unmarked` | Toggle | Pressed draws nothing on the button. |

Under forced colours a marked pressed toggle is `Highlight` on `HighlightText`, so pressed stays visible when the fills drop.

## ARIA and keys

- A native `button` with `aria-pressed`. Keep its name the same in both states: a screen reader says pressed or not, and a name that changed with the state would say it twice, or contradict it. Hold open reads "Hold open" held or not; its salmon says it holds.
- **Enter** and **Space** press it. **Escape** is not its.

## Tests

`toggle.test.tsx` draws it inside a real shadow root, by role (`pressed`), with `user-event` and axe.
