# 005 — Let the neck go slowly: thin, pinch, retract, instead of jumping

- **Status**: DONE
- **Commit**: 024879f
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 1 file (`styles.ts`), 2 lines; plus one line in `DESIGN.md`

## Problem

The collapsed pill (`packages/loupe/src/toolbar/launcher.tsx`) is drawn through an SVG
goo filter: a blur (10px) and a sharp alpha cut. Each window side has its own body
(`rect.wall`) in the same filter, so when the pill is within ~10px of a side, a liquid
neck joins them. Parked on a side, the pill sits 6px off it, and the side's body is
pushed 24px further out (`PARKED_GAP = 24`, `launcher.tsx:260`) so the neck lets go.

The designer: "it just jumped from one state to another", with "a little lag" before it.

```css
/* packages/loupe/src/toolbar/styles.ts:409 — current: the release, glued → parked */
.launcher:not(.settling):not(.dragging) .goo .wall { transition: fill 120ms ease-out, translate 280ms cubic-bezier(0.23, 1, 0.32, 1) 60ms; }
```

Why it jumps, measured from the geometry:

- At release the side's body moves from 8px away from the pill (6px gap + 2px offset)
  to 32px away. The neck exists only up to about 11–12px, so the whole visible
  release (thinning → pinch) is the **first ~3–4px of a 24px move, about 15%**.
- `cubic-bezier(0.23, 1, 0.32, 1)` is a strong ease-out: it reaches 15% progress at
  about **4% of its time, ~11ms**. So the neck thins and pinches inside a single frame.
  That is the jump. The other 270ms move the body offscreen, where nothing shows.

Why it lags:

- The release can only start when the pill stops travelling: the `settling` class is
  removed after `SETTLE_MS = 260` (`launcher.tsx:82`). The travel's own strong ease-out
  is visually done by ~150ms, so the pill sits glued and still for ~110ms, plus the
  60ms delay above: **~170ms frozen, then a one-frame snap.**

## Target

The neck's release becomes visible motion: it thins over ~6–7 frames, pinches, and the
two stubs pull back, with no frozen hold in front of it.

```css
/* packages/loupe/src/toolbar/styles.ts:409 — target */
.launcher:not(.settling):not(.dragging) .goo .wall { transition: fill 120ms ease-out, translate 320ms cubic-bezier(0.77, 0, 0.175, 1); }
```

- `cubic-bezier(0.77, 0, 0.175, 1)` is the strong ease-in-out for something moving or
  morphing on screen. It starts slowly: 15% progress at ~36% of its time, so the neck
  takes **~115ms** to thin and pinch (about 7 frames at 60Hz), then the body accelerates
  away offscreen, which reads as the stubs snapping back once the neck breaks. A liquid
  neck behaves just like this: it thins slowly, then breaks quickly.
- **No delay** (`60ms` removed): the slow start of the curve is now the beat after the
  landing. The neck is visibly thinning during it instead of standing still.
- 320ms total, but only the first ~115ms are visible; the rest happens offscreen past
  the window's edge. It doesn't hold up anything: the pill is already parked and clickable.
- Unchanged: `PARKED_GAP` (24px), `SETTLE_MS` (260ms), the landing travel (260ms
  `cubic-bezier(0.23, 1, 0.32, 1)`), the blur and the cut, the pickup, the reduced-motion
  rule (`styles.ts:433`, transitions off).

## Repo conventions to follow

- Curves in `styles.ts` are written out inline, not as tokens. Exemplar:
  `.launcher.settling .goo .wall { transition: fill 120ms ease-out, translate 260ms cubic-bezier(0.23, 1, 0.32, 1); }` (`styles.ts:407`).
- Comments are full sentences in the existing voice, directly above the rule.

## Steps

1. **`styles.ts:408-409`.** Replace the comment and rule:

   ```css
   /* Landed: the edge draws back, a beat after, so the neck stretches and snaps and the pill sits clean. Held, they follow at once. */
   .launcher:not(.settling):not(.dragging) .goo .wall { transition: fill 120ms ease-out, translate 280ms cubic-bezier(0.23, 1, 0.32, 1) 60ms; }
   ```

   with:

   ```css
   /* Landed: the edge draws back slowly at first, so the neck visibly thins and pinches (~115ms), then
      fast, so the stubs pull back once it breaks, as a liquid neck does. Held, they follow at once. */
   .launcher:not(.settling):not(.dragging) .goo .wall { transition: fill 120ms ease-out, translate 320ms cubic-bezier(0.77, 0, 0.175, 1); }
   ```

2. **`packages/loupe/DESIGN.md`**, section "### Collapsed", bullet "**Gooey, only at
   the edge**". Replace "Parked, the edge draws back 60ms after the landing, over 280ms
   on `cubic-bezier(0.23, 1, 0.32, 1)`, so the neck stretches and lets go" with "Parked,
   the edge draws back as the landing ends, over 320ms on `cubic-bezier(0.77, 0, 0.175, 1)`:
   slowly at first, so the neck visibly thins and pinches in about 115ms, then fast, so
   the stubs pull back once it breaks".

## Boundaries

- Do NOT touch `launcher.tsx`: not `PARKED_GAP`, not `SETTLE_MS`, not the filter values.
- Do NOT change the travel rule at `styles.ts:407` or the reduced-motion rule at `styles.ts:433`.
- Do NOT add a bounce, an overshoot or a recoil on the pill.
- If the rule at `styles.ts:409` no longer matches the excerpt (drift since 024879f), STOP and report.

## Verification

- **Mechanical:** from `packages/loupe`: `pnpm test` (CSS only; all pass, including
  `colors.test.ts`), then `npx tsc6 -p tsconfig.build.json` so the fixture app picks it up.
  Don't use `pnpm build`: it empties `dist` while the dev server runs.
- **Feel check** (needs a visible browser, not a hidden pane, which draws about one frame
  a second): open http://localhost:3100, press Hide panel, drag the pill near the right
  side and let go.
  - At full speed: the pill lands, and the neck visibly thins and lets go, with no frozen
    beat and no one-frame pop.
  - In Chrome DevTools > Animations at 10%: after the landing, the neck narrows over
    several frames before it breaks, and the stubs on both sides then pull back.
  - Pick the pill up from the side and drop it again quickly: nothing sticks or flashes.
  - Rendering panel, `prefers-reduced-motion: reduce`: the neck goes at once, as before.
- **If it now feels slow:** try 280ms with the same curve before anything else (neck
  ~100ms). **If it still pops:** check the duration actually changed in DevTools
  (Computed > transition on `rect.wall`) before tuning further.
