# FlagsCard and FlagRow

The Feature flags card (DESIGN.md "Notices and status", PER-132), the MVP's only rule preview (PER-92). Each flag the app declares, its options as one radio group, and what shows now; Clear on a flag previewed, and Clear flag previews under them all. While previews are off, one line says so, and why once opened.

```tsx
<FlagsCard
  ref={card}
  flags={flagsCard(current)}
  busy={busy}
  onPreview={(key, value) => preview(key, value)}
  onClear={(key, from) => clear(key, from)}
  onClearAll={(from) => clearAll(from)}
  words={commandWords}
  onCopy={copyToClipboard}
/>
```

It writes nothing. The view (`flags.tsx`) reads the flags store, asks it to preview or clear one write at a time, says a refused write through the announcer, and moves focus on once a Clear has gone.

## Interface

- `flags`: `panelView()`'s `FlagsCardView` (`flagsCard(view)`): `title`, `meta`, `loading`, `off` (`{ title, why, reason, fix }`), `empty`, `rows`, `error`, `lasts`, `clearAll` (`{ label, enabled }`).
- Each row, `panelView()`'s `FlagRowView`: `key`, `previewing`, `description`, `note`, `options` (`{ label, value }`), `checked` (its place in `options`, null while the app decides), `state`, `clear`.
- `busy`: a write is out; Clear and Clear flag previews are off meanwhile. The options stay on: disabling the one with focus would drop the keyboard.
- `onPreview(key, value)`, `onClear(key, from)`, `onClearAll(from)`: `from` is the button, so the view can move focus on.
- `ref`: the card, for the view's focus. `words` and `onCopy`: the fix's command, as CommandLine takes them.

## States

| Attribute | Draws |
| --- | --- |
| `data-flags` | Card `plain`; its head the title and Marks' `Meta`. |
| `data-flag` (its key), `data-previewing` | A Row `ruled`: a lilac dot while previewed (hollow otherwise), the key in mono, Clear at the right. |
| `data-flag-foot`, `data-flag-state` | The options sharing the row's width on one line, what shows now at the right, 11px muted (ink while previewed), level with their foot. |
| `data-flags-muted` | What says more, muted at 400. |
| `data-flags-off`, `data-flags-why`, `data-flags-reason` | A well, 12px corners: an amber dot, "Flag previews are off · why", the chevron; opened, why (13px on 19px, muted) and the fix, 8px apart. |
| `data-flags-error` | An amber well, 12px on 17px, its dot level with the first line. |
| `data-flags-lasts` | On a hairline, 10px down: the clock, then how long a preview lasts, 12px muted. |
| `data-flags-clear` | Clear flag previews, at the left. |

## ARIA and keys

- A flag's options are a radio group named by its key, one Tab stop; arrows move between them. Nothing is checked while the app decides.
- Clear and Clear flag previews are buttons named by their words; their icons are hidden.
- Previews off is a Fold: a button with `aria-expanded`.
- A refused write is shown under the flags and said, assertively, by the view.

## Tests

`flags-card.test.tsx`: the radio groups and what shows now, previewing and clearing through the callbacks, a refused write and `busy`, previews off and its fix, reading and no flags, and axe ready and off. The view's own (`flags.test.tsx`) drives the card through the store.
