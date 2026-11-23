# Tag

A few words that qualify what they sit beside, as a pill: "State prop" on a prop row, "On the server" and "Not visible now" on the Instance, "set by the library" under Inspect only, "picked" on a member at a scope, "empty" beside label text left empty. It is a `span` holding its words.

```tsx
<Tag>State prop</Tag>
<Tag look="reason" title="The library sets this prop; the call site doesn’t pass it">set by the library</Tag>
```

## Interface

- `look`, `plain` by default:
  - `plain`: a `sunk` pill, 11px/16px sans, `muted`.
  - `reason`: why, quoted: 10px/16px mono, 0.02em, with a help cursor; more in its `title`.
  - `picked`: chosen: a 16px pill in `accent-wash`, `accent-text`, 10px mono at 500.
  - `amber`: out of date: `warn-bg`, `warn-fg`.
  - `ring`: held aside: no fill, a 1px `held` pencil ring.
  - `dashed`: not there now: no fill, a 1px dashed `rule-strong` edge.
  - `empty`: nothing written: no fill, a 1px dashed `ink` edge, its word in `ink`.
- `title`: more than the words say, on hover. A tooltip reaches neither a keyboard nor a touch screen, so what matters goes in words too (Inspect only writes a reason's title out beside its tag; a prop row's reason doesn't yet).
- `className`, and any `data-*` attribute (a test's `data-testid`).
- `children`: the words.

## States

| Attribute | Draws |
| --- | --- |
| `data-tag-look` | The look above. Every look is a full pill (`--radius-pill`), 1px by 8px of padding, with a 1px outline inside its edge: transparent unless the look colours or dashes it. |

`data-tag` is not Tag's: the page's pick tag (`highlight.tsx`) carries it.

Under forced colours the fills drop and the outline, transparent or not, is drawn in `CanvasText`, so every tag keeps its pill. That is why the ring is an outline and not an inset shadow, which forced colours drop.

## ARIA and keys

- No role: its words are read where they stand, in the reading order of the row.
- The look is never the only signal: "Not visible now" says what the dashes draw, "Source changed" what the amber does.
- No keys. A tag is never focusable, so a `reason`'s title is mouse-only.

## Tests

`tag.test.tsx` draws each look inside a real shadow root, reads the words by text in place, and runs axe.
