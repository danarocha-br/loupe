# GroupRow

One component on the page, a row of "On this page" (DESIGN.md "On this page", Rows option B): its name, a bar in its hue for its share of the most used component, its count, and under the name only what is exceptional. Opened, its call sites as cards (SiteCard), then the Instances that hold an Override but aren't mounted now.

```tsx
<GroupRow
  group={group}
  lit={lit === group.component}
  words={INSPECTOR_WORDS}
  onPoint={point}
  onSite={(site) => select(site.select, site.ids.length > 1 ? "many" : undefined)}
  onInstance={(id) => select(id)}
  onHover={outline}
/>
```

## Interface

- `group`: panel-view's `GroupItem`: `component`, `count` ("×7"), `share`, `hue`, `inspectOnly`, `verdict` (a "Not generated yet" status chip, with `statusTitle`), `notes` (`overrides`, `stale`, `not-mounted`), `sitesText`, `sites` and `instances`.
- `lit`: its component is pointed at, here or on the page map.
- `words`: the Inspector's `change`, for the change numbers an unmounted Instance holds.
- `onPoint(group | null)`, `onSite(site)`, `onInstance(id)`, `onHover(ids)`.

## States

| Attribute | Draws |
| --- | --- |
| `data-group-row`, `data-hue` | The list item, its `--hue` one of the map's. |
| `data-lit`, Fold's `data-open` | The hover wash; open, a 3px bar in its hue at its left edge too. |
| `data-inspect-only` | The bar at 55%; an eye after the name. |
| `data-group-name` | 13px at 500, breaking only between its words. |
| `data-group-bar` | A 4px bar on `rule`, its share in its hue; 6px open. |
| `data-group-count` | 13px mono at 600 (`--font-count`), tabular, ink. The chevron is `icon-faint`, ink once open. |
| `data-group-notes`, `data-note` | 12px muted, 2px by 10px apart: `overrides` in ink at 500, `stale` in amber after an amber dot. Hidden while empty. |
| `data-group-sites`, `data-group-sites-head` | Opened: "3 call sites · pick one to inspect" in meta, faint, over the cards, 6px apart, padded 10px 14px 12px. |
| `data-group-unmounted`, `data-group-site` | An unmounted Instance: its change numbers, its call site and key in 11px mono, its tags, 32px at least; what it holds under it (Marks' `HeldValues`). |

The trigger's grid is `name n go / bar n go / sub sub sub`, columns `1fr 40px 30px`, 44px at least, padded 6px 12px 10px 14px.

## ARIA and keys

- A list item. Its trigger is the Fold's, a button with `aria-expanded`, named by its contents: the name, the count and the notes. Its tooltip is why it is inspect only, or the command for "Not generated yet". The bar is hidden: the count says it.
- Pointing at or focusing the trigger calls `onPoint`, which lights the component's blocks on the map and outlines its Instances on the page.
- Enter or Space opens and closes it. An unmounted Instance is a button that inspects it.

## Tests

`group-row.test.tsx`: the name, count and notes, the hue, the eye and its reason, lit, pointing, opening to the call sites and picking, an unmounted Instance, and axe closed and open.
