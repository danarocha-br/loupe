# Switch

True or false: a prop row's switch, at the right edge in place of chips. It is a button with the `switch` role on UI SDK's `@ui-sdk/react/switch`, behind Loupe's own interface.

```tsx
<Switch label="open" checked={on} onCheckedChange={(next) => write(next)} />
```

## Interface

- `label`: the switch's accessible name, the prop it sets (`aria-label`).
- `checked`: on now. The caller keeps it: nothing turns until the caller passes the new value, so the switch shows what the app shows.
- `onCheckedChange(checked)`: a click, Space or Enter asks for the other value.
- `disabled`, `title`, `className`, and any `data-*` attribute.

## States

| Attribute | On | Set by | Draws |
| --- | --- | --- | --- |
| `data-unchecked` | the switch, the thumb | UI SDK | The `switch-off` taupe half on the left, its outer corners round, a `card` hole through it, on a `switch-off` edge. |
| `data-checked` | the switch, the thumb | UI SDK | The `switch-on` teal half on the right. It slides across with its corners over `--duration-toast` on `--ease-thumb`, its colour over `--duration-fold`. |
| `data-disabled` | the switch | UI SDK | 45% opacity. |

Under reduced motion the thumb still moves to its place, without travelling there. Under forced colours the edge and the thumb are `ButtonText` on `Canvas`, and on is `Highlight`. Focus is the stylesheet's `:focus-visible` ring.

UI SDK renders a hidden native checkbox beside the switch, for forms. It is absolutely positioned, 1px, and takes no room in a row.

## ARIA

A `button` with `role="switch"`, `aria-checked` and `aria-label`.

## Keys

- **Space** turns it.
- **Enter** turns it too. UI SDK's switch leaves Enter to a form; the panel has none, and every other control in it answers Enter. Held down, it turns once.
- **Escape** is not its.

## Tests

`switch.test.tsx` draws it inside a real shadow root, by role, with `user-event` and axe.
