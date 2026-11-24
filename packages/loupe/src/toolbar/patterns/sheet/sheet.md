# Sheet

The panel's sheet (DESIGN.md "Layout", "Opening and closing"): a grey sheet in the column the page makes room for, or over the page where the window is too narrow for one. The header card and its strip at its top and the footer card at its foot stay; the middle between them scrolls, its cards keeping their height. It slides out of the window's right edge as it opens, and back into it on Hide, quicker.

```tsx
<Sheet
  docked={column.docked}
  peeking={peeking}
  closing={closing}
  width={column.width - 16}
  words={SHEET_WORDS}
  middleRef={middle}
  header={<><PanelHeader … /><StatusStrip … /></>}
  footer={<PanelFooter … />}
>
  {cards}
</Sheet>
```

The view keeps what moves it: it measures the column (`dock.ts`), holds Alt for a peek, and on Hide waits for the drawer's own `transitionend` before the page takes its column back (`index.tsx`). The pattern says it through attributes, and its CSS times the drawer.

## Interface

- `docked`: in the column the page makes room for; false over the page.
- `peeking`: Alt held, to see through to what runs under the column.
- `closing`: Hide was pressed: the drawer slides out, and the sheet is inert meanwhile.
- `width`: its width in px, the column's less its 8px inset.
- `words`: panel-view's `SheetWords`, its name.
- `middleRef`: the middle, which the view scrolls back to the top on a new selection.
- `header`, `footer`, `children`: the header card and its strip, the footer card, and the middle's cards.

## States

| Attribute | Draws |
| --- | --- |
| `data-sheet` | The sheet: fixed 8px from the window's top and foot, flush right, `--ground`, its left corners `--radius-sheet`, edged by `--edge`. Its text is the panel's base, Body in `--ink`, paragraphs `text-wrap: pretty`. It slides in from the right (`@starting-style`) on `--duration-open` and `--ease-drawer`. |
| `data-overlay` | Over the page: the overlay shadow, `--overlay-shadow`. |
| `data-peek` | Alt held: nearly see-through (0.08) and no pointer. |
| `data-closing` | Hide pressed: out of the right edge on `--duration-close` and `--ease-land`, no pointer. |
| `data-sheet-middle` | The middle: it scrolls, its cards 6px apart and 6px in, each keeping its height (`flex: none`), with a thin scrollbar in `--rule-strong`. |

Reduced motion fades the drawer in and out (`--duration-fade`) instead of sliding it. Under forced colours, which drop the shadow that edges it, it keeps a transparent border they draw.

## ARIA and keys

- A `section` named "Loupe": a region landmark holding the panel.
- `inert` while it closes, so focus and a click can't land in a drawer on its way out; the view moves focus to the pill.
- The sheet takes no keys of its own. Alt is the view's, on the window.
