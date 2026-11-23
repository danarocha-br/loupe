# Popover

A non-modal box over what opened it, pointing at it with a caret: Copy Proposal's details and its refusal. It is UI SDK's `@ui-sdk/react/popover`, rendered in place in the DOM and shown in the browser's top layer, inside the surface's shadow root, behind Loupe's own interface: a root that owns dismissal and a panel that owns its place, its caret and focus.

```tsx
<Popover open={open} onOpenChange={(next) => !next && setOpen(false)} inside={split}>
  <PopoverPanel label="Copy with details" anchor={footer} returnFocus={chevron} initialFocus={title} caret="end">
    …
  </PopoverPanel>
</Popover>
```

## Interface

`Popover`, the root:
- `open` and `onOpenChange(open)`: the caller keeps the state. Escape, a press outside it or focus leaving it ask to close.
- `inside`: an element that counts as inside, so a press or focus there doesn't close it: the control that toggles it, which closes it itself. Without it, a press on the toggle would close the popover and the toggle's click would open it again.

`PopoverPanel`, the box, mounted only while open:
- `label`: the dialog's name.
- `anchor`: the element it stands over: 10px above it, as wide as it less 8px a side, centred. Read as it opens. If there's no room above, it flips below and its caret turns over.
- `returnFocus`: where focus goes when it closes with focus inside it.
- `initialFocus`: focused as it opens; without it, the first focusable element inside. UI SDK would select a text field's value as it focuses it; this never does.
- `caret`: `center` (the default) or `end`.
- `className` and `data-*` pass to the box.

## States

| Attribute | Set by | Draws |
| --- | --- | --- |
| `data-popover` | Popover | The `card` box, 14px in, 18px corners, the popover shadow. The browser's own `[popover]` frame, fill and scrolling are undone, so the caret can hang below it. |
| `data-caret="end"` | Popover | The caret 16px in from its right edge, under the chevron. |
| `data-caret="center"` | Popover | The caret just right of its middle. |
| `data-side` | UI SDK | `top` normally; `bottom` when it flipped, with the caret on its head. |
| `data-open` | UI SDK | While open. |

The caret is a 22×12 `card` triangle with a `popover-edge` stroke on its two sides. Under forced colours the box keeps a 1px border they draw.

## ARIA and keys

- A `dialog`, named by `label`. It isn't modal: the page and the panel stay usable, and Tab can leave it.
- **Escape** closes it and returns focus to `returnFocus`, from anywhere on the page. UI SDK takes the key at the document, after the window's capture: Loupe's `escape.ts` claims the popover's layer there while it is open, so the selection beneath never hears the key. The app hears it, already handled.
- A press outside it closes it and leaves focus where the press put it. A press inside, or on `inside`, doesn't.
- Focus leaving it closes it, unless it moves to `inside`.

## Tests

`popover.test.tsx` draws it inside a real shadow root, by role (`dialog` by name), with `user-event` and axe.
