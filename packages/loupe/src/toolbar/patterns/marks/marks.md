# Marks

The small marks the Inspector's patterns and the list share: a change's delta, an Instance's row of them, a held State prop's empty delta, a verdict's status chip, a tag in panel-view's words, and a name that breaks only between its words. Primitives composed (Delta, Tag, the check icon); each takes panel-view's data and the Inspector's words.

```tsx
<Keys keys={body.keys} words={INSPECTOR_WORDS} />
<StatusChip status={body.verdict.status} check />
<TagChip tag={{ kind: "not-visible", text: "Not visible now" }} />
<Breakable text="AlertDialogContent" />
```

## Interface

- `ChangeKey`: `n` and `words` (`change(n)` gives its name, "Change 2", and its tooltip). `HeldKey`: `words` (`heldTitle`). `Keys`: `keys` and `words`; nothing when `keys` is empty.
- `StatusChip`: `status` (`{ kind?, text }`: a verdict's kind, or none for a plain status such as "Not on the page now"), `title`, and `check`, which leads Supported with a tick.
- `TagChip`: `tag`, one of panel-view's `Tag`s; its kind picks the Tag look.
- `Breakable`: `text`; a `<wbr>` where a lower-case letter or digit meets a capital.

## States and ARIA

| Attribute | Draws |
| --- | --- |
| `data-keys` | Deltas side by side, 2px apart, never shrinking in a line. |
| `data-status` | A 16px pill in 10px mono at 500 (`--font-chip`): `sunk` and muted; `supported` green; `not-generated` amber; `plain` for a status with no kind. A transparent outline forced colours draw. |

A numbered delta is an `img` named for what it numbers ("Change 2"), never a bare number; an empty one is hidden. The status chip's tick is hidden: the word says it. A tag's words are read where they stand.

| Tag kind | Look |
| --- | --- |
| `server`, `left-out` | `plain` |
| `suspended` | `ring` |
| `not-mounted`, `left-out-unmounted`, `not-visible` | `dashed` |
| `stale` | `amber` |

No keys: none of them is a control.
