# CopySplit, DetailsForm, NotCopied and CopyToast

Copy Proposal's drawn parts (ADR 0002; Paper's "Copy flow v2 · A"; DESIGN.md "Copy Proposal"). The split button sits in the footer: its main half copies in one click, under the title given so far or the suggested one; its chevron opens the details, a title and a designer. A copy that lands turns the button green for a moment and a toast says what went; a refused one turns it amber and a popover says why, holds the Proposal's text to copy by hand, and tries again.

The parts draw and call back. The view (`copy-flow.tsx`) keeps the state machine: it runs the copy, decides which state the button shows, which half opened the popover and where focus goes back, the timers that turn the button back and take the toast away, the form's text, and what the announcer says. It places the popovers (ui/popover/) over the footer.

```tsx
<CopySplit ref={split} mainRef={main} chevronRef={chevron} state={state} busy={busy} disabled={disabled} expanded={detailsOpen} words={copyWords} onCopy={copyNow} onDetails={toggleDetails} />
<Popover open={details} …>
  <PopoverPanel label={copyWords.details} anchor={frame} returnFocus={chevron} initialFocus={titleField} caret="end">
    <DetailsForm title={title} designer={designer} missing={missing} busy={busy} words={copyWords} titleRef={titleField} onTitle={…} onDesigner={…} onSubmit={…} />
  </PopoverPanel>
</Popover>
<NotCopied said={copyWords.notCopiedText(reason, text !== "")} text={text} busy={busy} words={copyWords} retryRef={retry} onRetry={tryAgain} />
{toast && <CopyToast title={toast.title} words={copyWords} />}
```

## Interface

- Every part takes `words`, `panelView()`'s `CopyWords`.
- `CopySplit`: `state` (`idle`, `copied` or `failed`), `busy`, `disabled`, `expanded` (the details, or a refusal from the chevron, stand open), `ref` (the split, which a press on stays the popover's own), `mainRef` and `chevronRef` (for focus to go back to), `onCopy()`, `onDetails()`.
- `DetailsForm`: `title`, `designer`, `missing` (copied with no title), `busy`, `titleRef`, `onTitle(title)`, `onDesigner(designer)`, `onSubmit()` (the view checks the title).
- `NotCopied`: `said` (why, `CopyWords.notCopiedText`), `text` (the Proposal's, empty when it wasn't built), `busy`, `retryRef`, `onRetry()`.
- `CopyToast`: `title`, the one the copy went under.

## States

| Attribute | Draws |
| --- | --- |
| `data-copy-split` | A 40px ink pill across the footer's actions, its colours easing over `--duration-fold`. Off, it fades to 0.45 as one. |
| `data-copy`, `data-copy-rule`, `data-copy-details` | The main half (its icon and Action words), a 1px rule, the 41px chevron in a wash. Under a pointer, idle only, each half washes. |
| `data-state="copied"` | Green: `--copied-bg`, its edge and rule; the chevron's wash goes. |
| `data-state="failed"` | Amber: `--warn-bg`, its edge, rule and wash. |
| `data-copy-form`, `data-copy-submit` | The title, the designer and the copy, 12px apart; the copy as wide as the fields. |
| `data-not-copied`, `data-not-copied-badge`, `data-not-copied-why` | A 24px amber badge, its heading in Body at 600 and why in Caption, in the warning's colours; the Proposal's field 15px under them. |
| `data-copy-actions` (`data-alone`) | Select all at 112px beside Try again, 14px under the text; alone, Try again across. |
| `data-copy-toast`, `data-toast-badge`, `data-toast-what`, `data-toast-line`, `data-toast-title`, `data-toast-sub` | A dark well 10px over the footer, rising 4px into place over `--duration-toast`: a green badge, `Copied “title”` in Control at 600 with the title cut short, and what to do under it. |

Under reduced motion the toast appears in place and the split's colours change at once.

## ARIA and keys

- The split's halves are buttons. The main half is named by its state's words ("Copy Proposal", "Copied", "Not copied"); the chevron by hidden text, "Copy with details", with `aria-haspopup="dialog"` and `aria-expanded` while the details or a refusal from it stand open. A copy out sets `aria-busy` on the split.
- The details' title is required; copied without one, its error is the form's own (Field's description), never the browser's bubble. Enter in a field submits.
- A refused copy's heading is level 3. The Proposal's text is a read-only text box named "The Proposal"; Select all focuses and selects it. Try again is `aria-disabled` while a copy is out, so it keeps focus.
- The toast is `aria-hidden`: the view's announcer says each copy once (`CopyWords.copiedText`), and each refusal as an alert.
- The popovers are Popover's dialogs: Escape and a press outside close them, and focus goes back to the half that opened them.

## Tests

`copy-flow.test.tsx`: each half and its callback, each state's words and `aria-expanded`, off and busy; the form's fields, edits, submit by button and Enter, and the missing title; a refusal with and without the text, Select all and Try again; the toast's words and its hiding; and axe for each. The flow itself (copying, timers, focus, announcements) is the view's, in `copy.test.tsx`.
