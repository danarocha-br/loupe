# Icon

The Toolbar's icons, from Paper's boards: an `svg` stroked in `currentColor`, so it takes its colour from the button, row or line it sits in, in light, dark and forced colours. Strokes scale with the icon.

```tsx
<Button size="small"><ResetIcon />Reset</Button>
<Row glyph={PROP_ICONS.variant}>…</Row>
```

## Interface

- One component per icon (`ResetIcon`, `BackIcon`, `FileIcon`, `LayersIcon`, `WidenIcon`, `LockIcon`, …), some with a `size`.
- `PROP_ICONS`: a prop's glyph by what the prop does (`size`, `variant`, `off`, `focus`, `text`, `state`, `other`), and `inspect`, the Inspect only fold's.
- `Wordmark`, Loupe's L: the one image here that is named (`role="img"`, "Loupe").

## States and ARIA

| Attribute | Draws |
| --- | --- |
| `data-icon` | A block that never shrinks in a flex line. |

Every icon but the wordmark is `aria-hidden` and `focusable="false"`: the words beside it say what it means, or a hidden label does on an icon-only button. An icon is never the only way something is said.

No keys: an icon is never a control by itself.

## Why a primitive

Patterns import only `ui/`, the tokens and `panel-view`'s types (DESIGN.md "Layers"), and draw a reset, a lock, a file or the prop's glyph. The icons know no domain word, so they sit with the primitives.
