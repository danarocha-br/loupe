# Button

Runs an action: Reset all, Discard, a prop's Reset, Copy, the header's Hide panel, Back. It is a native button on UI SDK's `@ui-sdk/react/button`, behind Loupe's own interface, with the looks DESIGN.md's "Buttons" names.

```tsx
<Button onClick={resetAll}>
  <ResetIcon />
  Reset all
</Button>
<Button size="small">Discard</Button>
<Button look="primary" type="submit">Copy with these details</Button>
<Button look="tool" iconOnly onClick={hide} title="Hide the panel">
  <PanelIcon />
  <span className="sr-only">Hide panel</span>
</Button>
```

## Interface

- `look`: `soft` (the default), `primary` or `tool`.
- `size`: a soft pill's height, `small` (26px), `medium` (30px, the default) or `large` (40px). The primary is always 40px and a tool 30px.
- `iconOnly`: round, its width its height. Name it with an `sr-only` span or `aria-label`.
- `type`: `button` (the default) or `submit`.
- `disabled`: natively disabled, out of the tab order.
- `onClick(event)`: what a press does. Its return value is ignored, so a press is never left pending: UI SDK would hold a button whose handler returns a Promise (the command's Copy returns the clipboard's), and Loupe's actions say their own progress.
- `ref`, `title`, `aria-*`, `data-*` and the other button props pass through. A caller's `aria-disabled` stays (Copy Proposal's popover keeps its buttons focusable while a copy runs).

## States

Every state is an attribute, and `button.css` styles the attributes:

| `data-look` | `data-size` | Draws |
| --- | --- | --- |
| `soft` | `small` · `medium` · `large` | A `sunk` pill, `--font-control` (12px/500; large steps up to 13px at 500); hover `sunk-hover`. |
| `primary` | `large` | The `primary` fill, `on-primary` text, `--font-action` (13px/600), the primary shadow; hover brightens it in light (1.3) and dims it in dark (0.92). |
| `tool` | `medium` | A 30px round muted icon; hover fills it `sunk` with a `primary` icon. |

`data-icon-only` makes it round at its size. `:disabled` (the browser's) drops it to 45% opacity; `data-pending` (UI SDK's) never shows, since a press is never left pending. Focus is the stylesheet's `:focus-visible` ring. Under forced colours a soft or primary pill keeps a `ButtonText` edge.

A view that gives a button its own background (`.command .copy`, `.notice .reset`, `.back`) restates its hover: the views' rules come after the `primitives` layer, so their background would beat the layer's hover.

## ARIA and keys

A native `button`, named by its text. **Enter** and **Space** press it. **Escape** is not its.

## Tests

`button.test.tsx` draws it inside a real shadow root, by role, with `user-event` and axe.
