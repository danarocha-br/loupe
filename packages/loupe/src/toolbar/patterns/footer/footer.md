# PanelFooter

The panel's pinned footer card (DESIGN.md "Layout" and "Undo"). Its tally: how many changes the Proposal will list, the State props it shows held, Reset all, and, after a reset, what it dropped and Undo. Under it: light or dark, and Copy Proposal in its slot.

```tsx
<PanelFooter
  ref={frame}
  footer={view.footer}
  words={FOOTER_WORDS}
  undo={offer?.text ?? null}
  theme={theme}
  resetAllRef={resetAll}
  undoRef={undo}
  onResetAll={resetAllUndoably}
  onUndo={takeUndo}
  onTheme={onTheme}
  copy={<CopyFlow disabled={!view.footer.copyEnabled} frame={frame} />}
/>
```

## Interface

- `footer`: panel-view's footer: `countText` (said once), `changes` (`count` and its `word`), `states` (the held chip's words and its tooltip), `resetAll` (Reset all is off while it is empty).
- `words`: panel-view's `FooterWords`: Reset all, Undo, and the theme's name and tooltips.
- `undo`: what the last reset dropped, beside its Undo; null while there is no offer.
- `theme`: `light` or `dark`; the theme toggle is pressed in dark.
- `ref`: the footer card, which Copy Proposal's popovers stand over. `resetAllRef` and `undoRef`: the view moves focus between them as an offer comes and goes.
- `onResetAll()`, `onUndo()`, `onTheme()`: the view resets, keeps the offer and puts the records back, and switches the theme.
- `copy`: Copy Proposal, the view's, drawn from the Copy flow's patterns.

## States

| Attribute | Draws |
| --- | --- |
| `data-footer` | The card: 6px in from the sheet's sides and foot, 14px inside, its tally 10px over its actions, `--radius-card`. |
| `data-footer-tally` | The count at the left, Reset all at the right, at least 24px high; the undo offer wraps to a line of its own. |
| `data-footer-count`, `data-footer-figure`, `data-footer-word` | The figure in Figure, then its word in Body at 500, `--muted`. |
| `data-footer-held` | The held chip: an amber pill, 20px high, its dot then its words in Chip. |
| `data-footer-reset` | Reset all: Button's soft look, 24px high, in `--muted`. |
| `data-footer-undo`, `data-footer-undo-what`, `data-footer-undo-button` | What a reset dropped, cut short, in Caption; then Undo in Control at 600, underlined. Empty, it leaves the layout. |
| `data-footer-act` | The theme, then Copy Proposal across the rest, 8px apart. |
| `data-footer-theme` | The theme: Toggle's large icon-only look in `--primary`, ringed by `--hairline`. |

Under forced colours the card keeps a transparent border, which they draw.

## ARIA and keys

- A `footer` element: in the panel's `section` it closes that section, and only on its own (as the tests draw it) is it the `contentinfo` landmark.
- The count is said once, whole, from hidden text ("2 changes · 1 state shown"); the figure, its word and the held chip are hidden. The view announces the count as it changes.
- Reset all and Undo are buttons. When Reset all acts it turns off, so the view moves focus to Undo; when Undo is taken, back to Reset all.
- The theme is a toggle button named "Dark theme" (`aria-pressed`); its tooltip says the theme a press switches to.

## Tests

`footer.test.tsx`: the count said once and drawn for the eye, the held chip, Reset all and its off state, the undo offer and Undo, the theme's pressed state and tooltips, the slot's place, and axe.
