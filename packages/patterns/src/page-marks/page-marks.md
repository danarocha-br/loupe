# The page's marks: PageOutline, ChangeOutline, PickTag

What Loupe draws over the app, outside the panel (DESIGN.md "On the page", "Picking"). They sit on the app, not on the panel, so their colours, and the pick tag's type, are the page's fixed tokens (`--page-*`), the same in either panel theme.

```tsx
<PageOutline kind="ring" box={outline(ring)} quiet={false} tag={{ text: labelText(ring), ...labelPlace(ring) }} />
<ChangeOutline keys="1 3" box={outline(pin)} quiet={quiet(pin.id)} />
<PickTag ref={tagRef} id={id} name="Button" detail="4 from this call site" words={outlineWords} place={tagPlace(…)} />
```

The view (`highlight.tsx`) reads the page and measures each box, again whenever the page signal says one may have moved; while the page scrolls it moves the marks it drew by the scroll (their `translate`, through each one's `ref`) and measures them again once the scroll settles; it places the tags (`labelPlace`, `tagPlace`), and times a change's outlines (they linger, then step back). The patterns draw those boxes and `panelView()`'s words (`OutlineWords`). A pattern never reads the page.

## Interface

- `PageOutline`: `kind` (`ring`, `member`, `out`, `hover`, `pick`), `box` (its place in the window, already stood off the Instance by 3px), `quiet`, `tag`: the selected Instance's size tag (`text`, and whether it goes `below` the outline and from its `start`), or null, and `ref`, through which the view moves it with a scroll.
- `ChangeOutline`: `keys` (the numbers of the changes that reach it, "1 3"), `box`, `quiet`, and `ref`, as PageOutline's.
- `PickTag`: `id` (the Instance it names), `name`, `detail` (or null), `place` (its top left), `words` (`panelView()`'s `OutlineWords`), and `ref`, from which the view reads its size and through which it moves the tag with a scroll.

## States

| Attribute | Draws |
| --- | --- |
| `data-ring="ring"` | The selected Instance: a 2px solid `--page-ink` outline, `--radius-ring` corners, a 1px `--page-halo` keyline. |
| `data-ring="member"`, `data-mark` | Another Instance a selection or a change reaches: 1.5px dashed `--page-line`. A change's outline fades in (`--duration-fold`). |
| `data-ring="out"`, `data-ring="hover"` | Left out of the scope, or named by a row of the panel: 1.5px dashed `--page-hover` grey. |
| `data-ring="pick"` | Picking, what a click would select: 1.5px solid `--page-ink`, washed in `--page-fill`. |
| `data-quiet` | Stepped back once its change has landed: it fades out over `--duration-quiet`. |
| `data-ring-label` | The size tag: 18px high on the outline's top right, `--radius-page-tag`, `--page-ink` with `--page-on-ink` figures in Label, tabular, `--page-tag-shadow`. |
| `data-below`, `data-at-start` | Under the outline near the window's top; from its left where ending at its right would run off the left edge. |
| `data-pick-tag`, `data-pick-detail` | The pick tag: a `--page-band` pill in `--page-pick-font` (Label on a 17px line, so 21px high), `--page-on-band`, `--page-pick-shadow`; its detail at 400 in `--page-on-band-muted`. |

Reduced motion takes the fades away: marks come and go at once.

Forced colours draw every outline in CanvasText and drop the shadows and the tags' fills. The size tag and the pick tag keep a 1px border they draw, the left-out and hovered dashes turn GrayText so they stay apart from the members', and the pick's wash goes, since forced to Canvas it would hide the page under it.

## ARIA and keys

- Every mark is `aria-hidden`: they are for the eye. The panel says what is selected, what a scope reaches and what a change reached, and the status strip says what picking does.
- None takes a pointer (`pointer-events: none`), so a click goes to the app or to the picker beneath.
