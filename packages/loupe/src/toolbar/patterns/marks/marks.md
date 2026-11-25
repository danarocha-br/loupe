# Marks

The small marks the Inspector's patterns and the list share: a change's delta, an Instance's row of them, a held State prop's empty delta, a verdict's status chip, a tag in `panelView()`'s words, a name that breaks only between its words, a held record's values, a card title that leads with a dot, the count beside a card's title, and a component's hue. Primitives composed (Delta, Dot, Tag, the check icon); each takes `panelView()`'s data and the Inspector's words. And `hovering()`, the handlers a row spreads to outline what it names on the page.

```tsx
<Keys keys={body.keys} words={inspectorWords} />
<StatusChip status={body.verdict.status} check />
<TagChip tag={{ kind: "not-visible", text: "Not visible now" }} />
<Breakable text="AlertDialogContent" />
<HeldValues values={item.values} />
<DotTitle tone="amber">{notice.title}</DotTitle>
<Meta>{body.summary}</Meta>
<li data-hue={group.hue}>…</li>
<button {...hovering(onHover, change.reached)}>…</button>
```

## Interface

- `ChangeKey`: `n` and `words` (`change(n)` gives its name, "Change 2", and its tooltip). `HeldKey`: `words` (`heldTitle`). `Keys`: `keys` and `words`; nothing when `keys` is empty.
- `StatusChip`: `status` (`{ kind?, text }`: a verdict's kind, or none for a plain status such as "Not on the page now"), `title`, and `check`, which leads Supported with a tick.
- `TagChip`: `tag`, one of `panelView()`'s `Tag`s; its kind picks the Tag look.
- `Breakable`: `text`; a `<wbr>` where a lower-case letter or digit meets a capital.
- `HeldValues`: `values`, `panelView()`'s lines for a held record ('variant "outline" · Current "ghost" (last seen)'), a list item each.
- `DotTitle`: `tone` (a Dot tone: `alert`, `amber`, `ring`…) and its words, which may be a heading.
- `Meta`: its words, the count at the right of a card's head.
- `hovering(onHover, ids)`: `onMouseOver` and `onFocus` call `onHover(ids)`; `onMouseLeave` and `onBlur` call it with none. `onMouseOver`, not `onMouseEnter`: React drops an enter that comes straight from an App Router page.
- `[data-hue]`: no component. `data-hue="0"` to `"6"` sets `--hue` to that map hue (`--map-hue-0` …), for a component's row, its call sites' dots and its blocks on the page map.

## States and ARIA

| Attribute | Draws |
| --- | --- |
| `data-keys` | Deltas side by side, 2px apart, never shrinking in a line. |
| `data-status` | A 16px pill in 10px mono at 500 (`--font-chip`): `sunk` and muted; `supported` green; `not-generated` amber; `plain` for a status with no kind. A transparent outline forced colours draw. |
| `data-held-values` | A list with no bullets, 11px mono, muted, 6px over what follows. |
| `data-dot-title` | The dot, then the title 8px after it, at 500, on one line with the dot centred. |
| `data-meta` | 11px (`--font-meta`), faint, tabular, on one line. |
| `data-hue` | `--hue`, one of the seven map hues, for what is drawn in it. |

Held values are a list, its items read in order. A numbered delta is an `img` named for what it numbers ("Change 2"), never a bare number; an empty one is hidden. The status chip's tick is hidden: the word says it. A tag's words are read where they stand.

| Tag kind | Look |
| --- | --- |
| `server`, `left-out` | `plain` |
| `suspended` | `ring` |
| `not-mounted`, `left-out-unmounted`, `not-visible` | `dashed` |
| `stale` | `amber` |

No keys: none of them is a control.
