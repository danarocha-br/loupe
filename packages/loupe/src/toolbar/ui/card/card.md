# Card

The surface the sheet's content stands on: the start card, the notices, the change list, Held for review, On this page, Appears on interaction, Feature flags, and the Inspector. A `div` in the card's white with 18px corners and the card's lift, padded by its look. Its head, CardHead, is a `div` that lays out a title and what counts it; the heading inside is the view's.

```tsx
<Card look="list">
  <CardHead>
    <h3>Changes</h3>
    <span className="meta">numbered as in the Proposal</span>
  </CardHead>
  <ol className="keylist" aria-label="Changes">…</ol>
</Card>
```

## Interface

- `look`, `plain` by default:
  - `plain`: padded 12px on top, 14px at the sides and foot, its parts 10px apart.
  - `list`: no side padding, so the rows in it run edge to edge and their hover and hairlines reach both edges; 12px on top, 6px at its foot, its parts 4px apart. Its CardHead keeps the text's 14px from the left and sits 4px over the first row.
  - `divided`: no padding, its parts flush and each after the first on a 1px `rule` hairline. Each part pads itself (a Row's `inset` look, the identity).
- `ref`: the card's element, for a view that moves focus within it (Feature flags finds the next control once one is disabled).
- `className` and any `data-*` attribute (a view's `data-testid`).
- `children`: the card's parts.

CardHead takes `className`, `data-*` and its children: the title at the left and what counts it at the right, on one baseline, 12px apart at least.

## Which variants are a look, and which stay the view's

- **A look:** `.section, .card` became `plain`; `.section.list-card` and the change list (`.section.changes`) became `list`; the Inspector's `.inspector` became `divided`. Each is a way the card's padding meets its rows, with no domain word in it.
- **The view's:** the notice card is a `plain` card whose parts sit 8px apart (`.notice-card`): a dot and a title, a paragraph, ruled rows and a command are a composition, the notices' pattern. On this page is a `list` card with its map flush under its head (`.on-page`); the start card's hero is a `plain` card 16px from its top (`.hero`); Gone's identity is a `plain` card padded as the Inspector's identity is (`.identity`).
- **Not a card:** the note an Instance can carry (`.note-card` before) sits inside the Inspector, and the One Card Deep rule keeps a card off a card: it is a Row with the info glyph.

## States

| Attribute | Draws |
| --- | --- |
| `data-card` | The look above. Every look has 18px corners (`--radius-card`), the `card` fill, the `shadow`, ink text in the body style, and a 1px outline inside its edge, transparent. |
| `data-card-head` | A flex row on one baseline, its ends apart. |

Under forced colours the fill and shadow drop, and the transparent outline is drawn in `CanvasText`, so every card keeps its edge.

## ARIA and keys

- No role and no heading. A card is not a landmark: the view names what it holds with its own `h2` or `h3`, at the level the view's outline needs, inside CardHead or anywhere in the card. A head can hold no heading at all (a notice's title is words beside a dot, read in order).
- Never focusable, no keys.

## Tests

`card.test.tsx` draws each look inside a real shadow root, finds the view's heading by role, checks the card adds none, and runs axe.
