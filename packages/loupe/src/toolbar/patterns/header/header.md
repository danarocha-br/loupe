# PanelHeader and StatusStrip

The panel's pinned header card (DESIGN.md "Layout", "Select tools" and "Hide marks"): the wordmark and, while nothing is selected, the page after it; at its right the select tools as one radio group, Hide marks and Hide. Under it, the status strip says what the page is doing: picking with a tool, a dialog of the app's under the panel, or the marks hidden.

```tsx
<PanelHeader
  page={body.kind === "list" ? { name: view.header.page, title: view.header.title } : null}
  mode={mode}
  armed={picking}
  marksHidden={marksHidden}
  words={HEADER_WORDS}
  onTool={onTool}
  onMarks={onMarks}
  onHide={onHide}
/>
<StatusStrip parts={picking ? HEADER_WORDS.strip.pick[mode] : null} />
```

## Interface

- `PanelHeader`:
  - `page`: the page's name and its tooltip (panel-view's `header.page` and `header.title`), or null while an Instance's identity names it.
  - `mode`: the select tool checked; `armed`: picking on the page with it.
  - `marksHidden`: Hide marks pressed.
  - `words`: panel-view's `HeaderWords`: the page's lead, each tool's name and tooltip (the list's `ListWords.tools`), the group's name, Hide marks' and Hide's.
  - `onTool(mode)`, `onMarks()`, `onHide()`: the view picks, hides the marks and hides the panel.
- `StatusStrip`: `parts`, panel-view's `StripPart[]` (words, or `{ key }` drawn in `kbd`), or null.
- `stripText(parts)`: the strip as one line, each key by name, for the announcer.

## States

| Attribute | Draws |
| --- | --- |
| `data-header` | The card: 40px high, 4px under the sheet's top and 6px in from its sides, 14px of text inset, `--radius-card`. |
| `data-header-brand`, the wordmark's `data-wordmark` | The wordmark at the left, 8px before the page. |
| `data-header-page` | Annotation capitals in `--faint`, 4px down onto the wordmark's baseline, cut short at its end. |
| `data-header-tools` | The tools at the right, 2px apart. |
| `data-select-tools` | The select tools in a pill of `--tools-wash`, 2px inside it. |
| `data-select-tool` with `data-checked` or `data-armed` | The tool lifted out of the wash: `--card`, `--primary`, `--raised-shadow`. |
| `data-header-divider` | A 1px × 16px rule between the select tools and Hide marks. |
| `data-strip-region`, `data-strip` | The strip 6px under the header: a `--shown` well, `--radius-status`, Caption. |

Under forced colours the card keeps a transparent border, which they draw.

## ARIA and keys

- A `header` element: in the panel's `section` it heads that section, and only on its own (as the tests draw it) is it the `banner` landmark. The wordmark is an image named "Loupe"; every icon beside it is hidden.
- The select tools are one `radiogroup` named "Select": arrows move between the tools, Space or Enter picks one (ChipGroup). Each tool's name is hidden text, its tooltip says what it does. Armed is the page's state, said by the strip.
- Hide marks is a toggle button (`aria-pressed`); Hide is a button.
- The strip carries no role: the view says it through the announcer as it changes (`stripText`). Its region stays while it is empty, so the line comes and goes inside it.

## Tests

`header.test.tsx`: the wordmark and the page with its tooltip, no page while an Instance is selected, the radio group and a pick, armed, Hide marks' pressed state and tooltips, Hide, the strip with its key and empty, `stripText`, and axe.
