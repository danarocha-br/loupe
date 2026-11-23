# Fold

A row that shows and hides what's under it: a component's call sites in the list, the props an Instance shows but can't change, the props a library sets, a scope's Instances, why flag previews are off. It is a disclosure on UI SDK's `@ui-sdk/react/collapsible`, behind Loupe's own interface.

```tsx
<Fold defaultOpen={false}>
  <FoldTrigger>
    Inspect only · 3
    <FoldChevron />
  </FoldTrigger>
  <FoldPanel>…the rows…</FoldPanel>
</Fold>
```

The Fold owns the open state, the trigger's ARIA and its keys. The trigger's content and the panel's are the caller's, laid out by the caller's class.

## Interface

- **`Fold`**
  - `defaultOpen`: open at first, when the Fold keeps its own state.
  - `open` with `onOpenChange(open)`: the caller keeps the state. Nothing opens until the caller passes the new `open`.
  - `onOpenChange(open)` alone: told of each change while the Fold keeps its state.
  - `className`, and any `data-*` attribute.
- **`FoldTrigger`**: a native button. It takes a button's props (`title`, `onMouseOver`, `onFocus`, …) but not `type` or `onClick`'s job, which is the Fold's.
  - `inline`: sits in a line of other controls at its own width (the scope's "3 Instances"). Otherwise it fills its row, as a `<summary>` did.
- **`FoldPanel`**: what the Fold shows. Closed, it stays in the page as `hidden="until-found"`, as a closed `<details>` does: the browser's find in page opens it, and its content keeps its state. It takes no class: `until-found` hides by `content-visibility`, not `display`, so the panel keeps its box, and any padding, border or flex gap given to it would show under a closed row. Put the layout on an element inside it.
- **`FoldChevron`**: the chevron every fold says it opens with, hidden from screen readers. The caller places it in the trigger.

## States

Every state is an attribute, and `fold.css` styles the attributes:

| Attribute | On | Set by | Meaning |
| --- | --- | --- | --- |
| `data-open` / `data-closed` | the Fold, the trigger, the panel | UI SDK | Open or closed. |
| `data-starting-style` | the panel | UI SDK | The panel's first frame open. Loupe doesn't animate the height: a fold opens at once. |
| `data-inline` | the trigger | Fold | At its own width. |
| `[data-fold-chevron]` | the chevron | Fold | Turns 90° open, over `--duration-fold`; at once under reduced motion. |

Focus is the stylesheet's `:focus-visible` ring; a view may draw it inside its row (`outline-offset: -2px`). Under forced colours the chevron is `currentColor` and the ring the system's.

## ARIA

- The trigger is a `button` with `aria-expanded` and, while the panel is in the page, `aria-controls` naming it.
- The chevron is `aria-hidden`: the trigger's text names it.

## Keys

- **Enter** or **Space** opens or closes it, and focus stays on the trigger.
- **Tab** moves from the trigger into an open panel, and skips a closed one.
- Closing the panel while focus is inside it moves focus back to the trigger.
- **Escape** is not the Fold's. It is never prevented, so the app, or Loupe's window-level Esc (`escape.ts`), has it.

## Tests

`fold.test.tsx` draws it inside a real shadow root (`surface/render.fixture.tsx`), queries it by role, presses keys with `user-event`, and runs axe. jsdom doesn't clear its style cache for a change inside a shadow root; `surface/jsdom-gaps.fixture.ts` does, so an opened panel reads as shown.
