# Animation plans

Written by `improve-animations` on 2026-11-22 at commit 1daad43, from measurements of
the fixture app (localhost:3100) and the code. Each plan is self-contained: run it with
any agent, or `improve-animations execute <plan>`.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-column-in-step-with-panel.md) | Move the page's column in the same frame as the panel | HIGH | DONE |
| [002](002-dock-without-goo.md) | Dock the pill crisply: a rigid pill, a flat side, and a preview of where it will land | HIGH | DONE |

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

## Not planned yet

- **The page's reflow on open and close** is still an instant 360px jump, by design:
  the page gives the panel a column so it never covers the product (`dock.ts`,
  critique 2026-11-19). A same-document View Transition could ease it (a short
  cross-fade of the page under the sliding panel). That's untested here, so it would
  need a prototype before a plan.
