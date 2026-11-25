# Legend

What a chip's marks mean, said once, on a row of its own under the Inspector's option rows (DESIGN.md "Property rows"): the salmon swatch of what shows now, the ring of the app's value once an Override replaces it, and the dot of the design system's default.

```tsx
{legend && <Legend words={inspectorWords} app={someChipRingsTheAppsValue} />}
```

## Interface

- `words`: `InspectorWords.legend` (`shown`, `app`, `default`).
- `app`: whether a chip on the card rings the app's value; the legend says it only then.

## States

| Attribute | Draws |
| --- | --- |
| `data-legend` | A row 34px at least, its words 42px in (under the rows' names), 11px faint, wrapping 2px by 8px. |
| `data-legend-mark="shown"` | A 10px swatch in `shown`, 3px corners. |
| `data-legend-mark="app"` | A 10px swatch ringed in `field-edge`. |
| `data-legend-mark="default"` | A 4px dot in `faint`, 2px corners. |

Under forced colours each mark is drawn in `CanvasText`.

## ARIA and keys

Hidden from assistive technology: each chip says its own marks, in words, in its name and tooltip. No keys.

## Tests

`legend.test.tsx`: the marks and their words, the app's value only when asked, hidden, and axe.
