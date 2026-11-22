# 002 — Dock the pill crisply: a rigid pill, a flat side, and a preview of where it will land

- **Status**: DONE
- **Commit**: 1daad43
- **Severity**: HIGH
- **Category**: Cohesion & physicality
- **Estimated scope**: 5 files (`launcher.tsx`, `launcher-place.ts`, `styles.ts`, both launcher test files), ~-120 / +80 lines

## Problem

The designer still reads the dock as "gooey". The goo neck is gone, but the pill still
behaves like a liquid, in four ways, each confirmed in code at 1daad43:

1. **Concave fillets grow out of the edge** when it docks
   (`packages/loupe/src/toolbar/launcher-place.ts`, `pillPath`; driven by
   `launcher.tsx:183`, `const fillet = useTween(docked ? FILLET : 0, …)`). A flare
   between a body and a surface is how a drop of liquid meets glass.
2. **It changes shape under the finger:** the corners facing the edge tighten as it
   nears (`launcher.tsx:184`, `nearRadius(leanGap(…))`).
3. **It moves ahead of the pointer:** in reach of a side it is drawn nearer than the
   pointer puts it (`launcher.tsx:180`, `leanCentre(…)`), which feels stretchy.
4. **It lags the pointer once docked while held:** docking mid-drag calls `travel()`
   (`launcher.tsx:219`), which turns on `.settling`
   (`styles.ts:407`, `transition: translate 260ms …`). For 260ms the pill trails the
   pointer along the edge, like something sticky.

The fillet growth also runs in a JS `requestAnimationFrame` tween (`launcher.tsx:95`,
`useTween`), where CSS would do it better under load.

## Target

A rigid object that snaps, with the snap announced before it happens:

- **While held, the pill is rigid and exact.** It follows the pointer 1:1, always the
  free stadium (44 × 32px, 16px corners). It never changes shape, never leans, never
  docks mid-drag, and never trails the pointer (no transition while held).
- **A dock preview shows where it would land.** While held within `REACH` (56px) of a
  side, a ghost of the docked pill sits at its docked place on that side, following
  the pointer along the edge 1:1. It is the docked shape in `--band` at opacity `0.16`,
  fading in over `120ms ease-out` and out over `120ms ease-out` when the pill leaves
  reach. Like window snapping on macOS or Windows: a target, not a deformation.
- **Docked, the pill is a clean tab.** Flush on its side: the corners on that side
  are `0`, the far ones `16px`. No fillets, nothing drawn past its box.
- **Release lands it in the ghost.** Within reach, or flicked so that it would coast
  into reach (keep the existing flick: faster than 0.3px/ms, coasting 140ms), it
  travels to the docked place on `translate 260ms cubic-bezier(0.23, 1, 0.32, 1)`.
  Its edge-facing corners square off over the same `260ms` and curve, as a
  `border-radius` transition: CSS, no JS tween. Anywhere else it stays free where it
  was dropped.
- **Unchanged:** the tuck and slide-out (`.leaving`, `@starting-style`), the arrow
  keys, the stored place, hover, focus, the hairline in dark.

## Repo conventions to follow

- Geometry stays pure and tested in `launcher-place.ts`; the component reads it
  (exemplar: `placeFor`, `glue`, `centreOf` and their tests in `launcher-place.test.ts`).
- Every colour is a token; `colors.test.ts` refuses colour literals in rules. Opacity
  numbers are fine.
- Strong ease-out in this file is `cubic-bezier(0.23, 1, 0.32, 1)` (see `.launcher.settling`, `styles.ts:407`).
- Comments are full sentences in the existing voice.

## Steps

1. **`launcher-place.ts`: remove the liquid geometry.** Delete `FILLET`, `DOCK`,
   `UNDOCK`, `leanGap`, `nearRadius`, `leanCentre`, `pillPath` and the `lerp` helper.
   In `alongRange`, replace `FILLET` with `0` (no fillets to keep clear of the
   corners, but keep `MARGIN`). Keep `REACH = 56`, `placeFor` (it already docks within
   `REACH`), `freePlace`, `glue`, `centreOf`, `nearestEdge`, `gapTo`, `along`,
   `bodyRect`, `readPlace`, `PLACE_KEY`, `DEFAULT_PLACE`, `BODY`, `MARGIN`. Update the
   file's header comment: the pill is drawn to a side by a preview of where it will
   land; docked, it sits flush, its facing corners square.

2. **`launcher.tsx`: drop the SVG outline and the tween.** Delete `useTween`,
   `reducedMotion`, `FILLET_IN_MS`, `FILLET_OUT_MS`, the `fillet`, `near` and `path`
   values, and the `<svg className="shape">…</svg>` element. The button itself is the
   pill (step 4 styles it).

3. **`launcher.tsx`: a rigid drag with a ghost.** Replace `Held` and `holdAt` with:

   ```ts
   /** A held pill: where the pointer puts its centre, and the side it would dock on if let go now. */
   type Held = { x: number; y: number; edge: Edge | null };

   function holdAt(x: number, y: number, viewport: Viewport): Held {
     const { edge, gap } = nearestEdge(x, y, viewport);
     return { x, y, edge: gap < REACH ? edge : null };
   }
   ```

   - `centre` while held is always `centreOf(freePlace(held.x, held.y, viewport), viewport)`.
   - `data-edge` on the button is `held ? "free" : place.edge ?? "free"`.
   - In `move`, call `hold(holdAt(…))` only. Remove the `before` / `travel()` logic: nothing travels while held.
   - In `drop`, keep the flick projection and `travel(); settle(placeFor(x, y, viewport));`.
   - Render the ghost **before** the button, so it sits under it:

   ```tsx
   const ghost = held?.edge ? centreOf(glue(held.edge, along(held.edge, held.x, held.y), viewport), viewport) : null;
   …
   <>
     <span
       className={ghost ? "dock-ghost shown" : "dock-ghost"}
       data-edge={held?.edge ?? undefined}
       aria-hidden="true"
       style={ghost ? { translate: `${round(ghost.x - BODY.width / 2)}px ${round(ghost.y - BODY.height / 2)}px` } : undefined}
     />
     <button …>
   ```

   Keep the ghost element mounted (empty `style` when hidden) so its opacity can fade out.

4. **`styles.ts`: the pill and its ghost in CSS.** In the `/* Collapsed (launcher.tsx) … */`
   block (starting `styles.ts:395`):
   - On `.launcher`: change `background: none` to `background: var(--band)`, add
     `border-radius: 16px;`, and add `border-radius 260ms cubic-bezier(0.23, 1, 0.32, 1)` to
     **both** the base `transition` list and the `.launcher.settling` list.
   - Add the docked shapes:
     ```css
     .launcher[data-edge="right"], .dock-ghost[data-edge="right"] { border-radius: 16px 0 0 16px; }
     .launcher[data-edge="left"], .dock-ghost[data-edge="left"] { border-radius: 0 16px 16px 0; }
     .launcher[data-edge="top"], .dock-ghost[data-edge="top"] { border-radius: 0 0 16px 16px; }
     .launcher[data-edge="bottom"], .dock-ghost[data-edge="bottom"] { border-radius: 16px 16px 0 0; }
     ```
   - Hover: replace the `.shape path` hover rule with
     `@media (hover: hover) and (pointer: fine) { .launcher:not(.dragging):hover { background: var(--band-hover); } }`
     and add `background-color 120ms ease-out` to the base `transition` list.
   - Focus: replace the two `:focus-visible` rules with
     `.launcher:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
     (an outline follows `border-radius`).
   - Delete `.launcher .shape` and `.launcher .shape path` rules. Keep `.launcher .mark` as it is.
   - Add the ghost:
     ```css
     /* Where the held pill would dock if let go now: the docked shape, faint, on its side. */
     .dock-ghost { position: fixed; left: 0; top: 0; z-index: 2147483646; width: 44px; height: 32px; border-radius: 16px; background: var(--band); opacity: 0; pointer-events: none; transition: opacity 120ms ease-out; }
     .dock-ghost.shown { opacity: 0.16; }
     ```
   - In `@media (forced-colors: active)`: replace `.launcher .shape path { fill: ButtonText; }`
     with `.launcher { background: ButtonText; } .dock-ghost { background: ButtonText; }`.
   - Under `@media (prefers-reduced-motion: reduce)`, the existing
     `.launcher, .launcher.settling, .launcher.leaving { transition: opacity 150ms ease-out; }`
     already drops the travel and the corner change; leave it.

5. **Tests.** In `launcher-place.test.ts`, delete the tests for `leanGap`, `nearRadius`
   and `pillPath`, and change the corner-clearance test to expect
   `centre.x - BODY.width / 2` to be `MARGIN`. In `launcher.test.tsx`, replace the
   magnet tests with:
   - Held within reach of the bottom: the button's `data-edge` is `"free"`, and
     `.dock-ghost` has class `shown` and `data-edge="bottom"`.
   - Held mid-page: `.dock-ghost` has no `shown` class.
   - Released within reach: `data-edge` becomes `"bottom"` and the ghost loses `shown`.
   - While held, the button's `translate` equals the pointer's position minus the press
     offset exactly (no lean): press at the box's top-left + (10, 10), move to (x, y),
     expect `translate` `(x - 10)px (y - 10)px`.
   - Remove the "a stadium again once its fillets have gone back" test, and every
     reference to `path`, `pillPath`, `FILLET`, `DOCK` and `UNDOCK`.

## Boundaries

- Do NOT change the tuck, the slide-out, the panel's open/close or `index.tsx` (plan 001 owns `index.tsx`).
- Do NOT change `REACH`, the flick threshold (0.3px/ms) or `COAST_MS` (140ms).
- Do NOT change the pill's size (44 × 32px), the L glyph, the stored-place format or `PLACE_KEY`.
- Do NOT add dependencies.
- If the code at the cited lines no longer matches (drift since 1daad43), STOP and report.

## Verification

- **Mechanical**: from `packages/loupe`, `pnpm typecheck` and `pnpm test` (all pass,
  including `colors.test.ts`: no colour literal in a rule), then
  `npx tsc6 -p tsconfig.build.json`. Don't use `pnpm build`.
- **Feel check** (the Browser pane must be visible): run `fixture-app`, press Hide,
  then drag the pill by hand with a mouse and with a trackpad.
  - Mid-page it is a stadium that sits exactly under the pointer, with no lag and no lean.
  - Within about 56px of any side, a faint pill appears flush on that side and slides
    along it with the pointer; the held pill itself does not change.
  - Let go: it travels into the ghost in about a quarter of a second, and its
    edge-facing corners square off as it lands. Nothing flares or bulges.
  - Flick it toward a side from mid-page: it lands docked on that side.
  - At 10% playback in DevTools' Animations panel, step through a dock: only
    `translate` and `border-radius` move, and they arrive together.
  - With `prefers-reduced-motion: reduce` (Rendering panel), the dock is instant, and
    the ghost still fades.
- **Done when**: `grep -n "FILLET\|pillPath\|leanCentre\|nearRadius\|useTween" packages/loupe/src/toolbar`
  finds nothing, and the feel check above holds.
