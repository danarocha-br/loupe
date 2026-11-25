# SiteCard

A call site of a component, in an opened row of "On this page" (DESIGN.md "On this page"): where it is written, what its Instances show, and a dot per Instance. The card picks every Instance from the call site; a dot picks one. One of the two things the One Card Deep Rule lets stand lifted inside a card, since it is itself a button.

```tsx
<SiteCard
  site={site}
  onSite={(site) => select(site.select, site.ids.length > 1 ? "many" : undefined)}
  onInstance={(id) => select(id)}
  onHover={outline}
/>
```

## Interface

- `site`: `panelView()`'s `CallSiteItem`: `label` ("member-row-menu.tsx:37"), `names` ("Ana Souza, Bruno Lima +2"), `inspect`, the card's name for a screen reader, `instances` (each `{ id, label, inspect }`), `ids`, and `supported` (false draws the inspect-only eye).
- `onSite(site)`: the card pressed. The view decides the mode: Select multiple when the call site has several Instances.
- `onInstance(id)`: a dot pressed.
- `onHover(ids)`: the card outlines its call site, a dot its one Instance; empty as it is left.

## States

| Attribute | Draws |
| --- | --- |
| `data-site-card` | The card: 52px at least, padded 8px 10px 8px 12px, 12px corners, `card` on the site shadow; raised while its button is under the pointer. |
| `data-site-open` | The card's button, lying under its words over the whole card; its focus ring 2px inside. |
| `data-site-where`, `data-site-file`, `data-site-names` | The file and line in 11px mono at 600, ink; what its Instances show in 12px muted on one line, the eye after it when no Override can reach them. |
| `data-site-dots` | A dot per Instance, 8px, in the row's `--hue` (a 22% fill, a 1.5px ring at 90%), 3px apart, wrapping at 74px; each hit area larger than it looks. |

## ARIA and keys

- The card's button is named by `site.inspect` ("Inspect member-row-menu.tsx:37: Ana Souza, Bruno Lima +2"); each dot by its Instance's `inspect`, with its name in the tooltip.
- Tab reaches the card, then each dot. Enter or Space presses.

## Tests

`site-card.test.tsx`: the buttons and their names, picking from the card and a dot, outlining from the pointer, the eye, and axe.
