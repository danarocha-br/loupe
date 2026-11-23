# Dot

A small round mark set before words: a notice card's title, "Source changed" in the list, "Flag previews are off", a flag's row, the footer's held chip. It is a `span`, always `aria-hidden`.

```tsx
<div className="title">
  <Dot tone="alert" />
  Product layer missing
</div>
```

## Interface

- `tone`: `alert` (a failure, alert orange), `amber` (a warning), `lilac` (on: a flag previewing, in the revision colour), `hollow` (off: an empty ring in `rule-strong`), `ring` (held aside: a 10px ring in `held` pencil).
- `small`: 6px rather than 8px. A `ring` is always 10px.
- `className` and any `data-*` attribute pass through. Where it sits (a margin to line it up with a first line of text) is the caller's.

## States

| Attribute | Draws |
| --- | --- |
| `data-dot="alert"` | 8px, filled `alert`. |
| `data-dot="amber"` | 8px, filled `warn-dot`. |
| `data-dot="lilac"` | 8px, filled `revision-line`. |
| `data-dot="hollow"` | 8px, a 1.5px `rule-strong` border and nothing inside. |
| `data-dot="ring"` | 10px, a 1.5px `held` border and nothing inside. |
| `data-small` | 6px. |

Under forced colours a filled dot is `CanvasText`. The hollow dot and the ring are borders, which forced colours keep in `CanvasText`: that is why the hollow dot is a border and not an inset shadow, which forced colours drop.

## ARIA and keys

- Always `aria-hidden`, and never focusable. A dot is never the only way to say something: the words beside it say it ("Product layer missing", "Previewing on", "App decides", "1 held"), and the dot repeats it in colour. A caller with nothing to say in words has nothing to mark.
- No keys.

## Tests

`dot.test.tsx` draws each tone inside a real shadow root, checks that it is hidden from the accessibility tree while the words beside it are read, and runs axe.
