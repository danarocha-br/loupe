# OnThisPage

The list's main card (DESIGN.md "On this page"): "On this page" with its count, the page map flush under the head, then a row per component, most used first. It lays out what the view gives it, so the view composes PageMap and GroupRow and measures the page for the map.

```tsx
<OnThisPage words={LIST_WORDS} summary={body.summary} map={<PageMapView … />}>
  {body.groups.map((group) => <GroupRow key={group.component} group={group} … />)}
</OnThisPage>
```

## Interface

- `words`: `onPage` (`title`, "On this page"; `rows`, the list's name, "Components on this page").
- `summary`: "9 components · 43 Instances", at the head's right (Marks' `Meta`).
- `map`: the page map, or nothing.
- `children`: a GroupRow per component.

## States

| Attribute | Draws |
| --- | --- |
| `data-on-this-page` | A `list` Card whose parts sit flush (no gap) and whose last row reaches its foot; the head centred, with nothing under it. |
| `data-on-this-page-rows` | The rows' list, no bullets. |

## ARIA and keys

The title is a level-3 heading. The rows are a list named "Components on this page". No keys of its own.

## Tests

`on-this-page.test.tsx`: the heading and its count, the map and the rows in order, and axe.
