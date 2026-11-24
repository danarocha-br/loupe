# Notice and InstanceNote

A notice is a card over the panel's content that says something the reader should know before they change anything (DESIGN.md "Notices and status"): the Product layer missing or in another format (red), sources changed since `generate` or components it has never read (amber), and Overrides off (red, PER-184). Its rows name what it is about; its command fixes it, for the reader to run.

An Instance's note is not a card (One Card Deep): a row of the Inspector's card, with the info glyph, that says once why nothing on the Instance can change.

```tsx
{view.notices.map((notice) => <Notice key={notice.kind} notice={notice} words={COMMAND_WORDS} onCopy={copyToClipboard} />)}
{body.note && <InstanceNote note={body.note} />}
```

## Interface

- `Notice`:
  - `notice`: panel-view's `NoticeView`: `kind`, `tone` (`alert` or `amber`), `title`, `meta`, `body`, `rows` (`{ text, value, valueTitle }`, a value at the line's right with its tooltip), `command`.
  - `words` and `onCopy`: the command's, as CommandLine takes them.
- `InstanceNote`: `note`, panel-view's `{ title, body }`.

## States

| Attribute | Draws |
| --- | --- |
| `data-notice` (its kind) | Card `plain`, its parts 8px apart rather than 10. |
| Marks' `DotTitle`, `Meta` | The title after its tone's dot, at 500; what counts it at the head's right. |
| `data-notice-body` | 13px on a 19px line (`--font-paragraph`), muted. |
| `data-notice-rows` | A list with no bullets, a Row `ruled` each: its text, then a value in mono at the right. |
| `data-instance-note` | Row `inset` with the info glyph: its title (`h3`) over its paragraph, 4px apart. |

## ARIA and keys

- A notice's card carries no role and no `aria-live`: the cards come and go with the view, so the panel says what they say through its live regions (`view.said`), a missing or other-format layer as an alert.
- `data-testid` is `<kind>-notice`, for the views' tests.
- The note's row is `role="note"`; its glyph is hidden; its title is a level-3 heading.
- The only control is the command's Copy.

## Tests

`notice.test.tsx`: an amber notice's title, count, sentence, rows and command; a red one; one with no rows or command; the note's role and heading; and axe.
