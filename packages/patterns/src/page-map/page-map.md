# PageMap

The page map in "On this page" (DESIGN.md "On this page", ADR 0006): every component on screen as a tinted block where it sits, fit into a dotted well over the rows, which are its legend. Point to find, click to inspect.

```tsx
<PageMap
  groups={body.groups}
  boxes={boxes}
  lit={lit}
  words={listWords}
  nameLang={appLang()}
  onPoint={point}
  onSelect={(id) => select(id)}
/>
```

The view measures the page (`page-map.tsx`, `PageMapView`: each mounted Instance's largest box, read when the map opens and again once the page has stayed still for 120ms after a layout change) and passes the boxes in. The pattern reads neither the page nor the runtime.

## Interface

- `groups`: `panelView()`'s `GroupItem`s, most used first. A block is drawn for each Instance with a `block` (mounted) and a box; its tooltip is the group's `mapTitle` ("Button ×7"), its hue the group's `hue`.
- `boxes`: each Instance's box on the page (`MapBox`: left, top, width, height), by id.
- `lit`: the component pointed at, here or on its row.
- `words`: `onPage.map`, the toolbar's name ("Page map"). `nameLang`: the app's language, for what an Instance shows.
- `onPoint(group | null)`: a block pointed at or focused, and null as the pointer leaves the map or focus a block. `onSelect(id)`: a block pressed.
- `stepFrom(order, from, event)`: where an arrow key goes, a pure function beside it.

Nothing is drawn while no Instance has a box.

## States

| Attribute | Draws |
| --- | --- |
| `data-page-map` | A stacking context of its own (`isolation: isolate`), so the blocks' ranks stay inside it. The well: 108px tall, 12px from the head and 14px in, `hover` wash, a dotted grid every 12px in `map-dot`, a hairline ring, 12px corners. |
| `data-map-fit` | The page's own shape (`--ratio`), as large as the well allows 8px in, centred. |
| `data-map-block` (its Instance's id), `data-hue` | A block at its place: an 18% fill of its hue and a 1.5px edge at 75%, 4px corners, at least 5px. Drawn in reading order, each stacked (`z-index`) over every block larger than it, so a small block inside a large one stays on top to be pointed at. |
| `data-page-map[data-lit]`, `data-map-block[data-lit]` | A component pointed at: every block fades to 22%, its own at full strength with a 30% fill and a 2px edge. Over 140ms. |
| `data-map-name` | The block's name, visually hidden. |

## ARIA and keys

- The well is a `toolbar` named "Page map". Its blocks are buttons, in the DOM in reading order, as a virtual cursor reads them, and one Tab stop between them (a roving tabindex): the block last focused, the first in reading order until then.
- Each block is named by its content, not an `aria-label`: Loupe's words ("Inspect Button 2 of 7, ") and then what the Instance shows on screen, with the app's `lang` and `dir="auto"`, or its call site where it shows nothing.
- Right and Down go to the next block in the order a page reads (top, then left), Left and Up to the one before, Home and End to the ends. Nothing past an end; nothing with a modifier, which is the browser's.
- Enter or Space inspects. Focus does what the pointer does: the component's row lights and the page outlines it.
- A focused block keeps focus when the page's layout moves it to another place in reading order, and so in the DOM.

## Tests

`page-map.test.tsx` draws the map from sample boxes inside a real shadow root: the toolbar and its names, the app's language, where a block sits, the one Tab stop, every key, lighting from focus and the pointer, Enter and Space, nothing without a box, and axe.
