# Animation plans

Written by `improve-animations` on 2026-11-22 at commit 1daad43, from measurements of
the fixture app (localhost:3100) and the code. Each plan is self-contained: run it with
any agent, or `improve-animations execute <plan>`.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-column-in-step-with-panel.md) | Move the page's column in the same frame as the panel | HIGH | DONE |
| [002](002-dock-without-goo.md) | Dock the pill crisply: a rigid pill, a flat side, and a preview of where it will land | HIGH | DONE |
| [003](003-tab-flares-into-its-side.md) | Docked, the tab flares into its side: two static fillets that arrive as it lands | MEDIUM | DONE |
| [004](004-edge-seam-while-held.md) | While held in reach, the window's edge lights a short seam where the pill will join it | LOW | TODO |

## Order and dependencies

1. **001 first.** It fixes the flicker on open and close and touches `dock.ts`,
   `index.tsx` and `dock.test.ts` only.
2. **002 second.** It touches `launcher.tsx`, `launcher-place.ts`, `styles.ts` and the
   two launcher test files. It doesn't depend on 001, and the two share no files, so
   they can also run side by side.

Both feel checks need the Browser pane visible: a hidden pane throttles animation
frames to about one a second, so nothing can be judged there.

## Done (2026-11-22)

Both ran as written, with two additions found in the running app:

- **001:** the close also commits the unmount with `flushSync`, so the panel's removal and
  the margin's release land in the same task (measured 305ms / 305ms), not 2ms apart.
- **002:** a release while the preview shows always lands in it; a flick only carries a
  pill let go out of reach. A held pill is kept on the window but not 8px in, so picking
  it up from a side doesn't jump.

## Attachment cues (written 2026-11-22 at 44b2399)

003 and 004 answer "show that it attaches to the edge" in two places: 003 on the pill's
docked shape (a browser tab's outward corners, arriving only as it lands, never while
held), 004 on the edge while it is held (a short coral seam). They share `launcher-place.ts`
but not the same lines, so they can run in either order or together. Recommended: 003 first,
judge it by hand, then decide whether 004 adds or only adds noise.

Considered and not planned: an SVG goo filter (`feGaussianBlur` + `feColorMatrix`), which is
the liquid look the designer has turned down twice; and a one-off squash against the edge on
landing, which reads as a bounce in a crisp tool.

## Not planned yet

- **The page's reflow on open and close** is still an instant 360px jump, by design:
  the page gives the panel a column so it never covers the product (`dock.ts`,
  critique 2026-11-19). A same-document View Transition could ease it (a short
  cross-fade of the page under the sliding panel). That's untested here, so it would
  need a prototype before a plan.
