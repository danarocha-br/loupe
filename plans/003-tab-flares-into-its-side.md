# 003 — Docked, the tab flares into its side: two static fillets that arrive as it lands

- **Status**: DONE
- **Commit**: 44b2399
- **Severity**: MEDIUM
- **Category**: Physicality (attachment cue)
- **Estimated scope**: 3 files (`styles.ts`, `launcher-place.ts`, `launcher-place.test.ts`), ~+35 lines, no component logic

## Problem

The designer likes the dock's motion as it ships at 44b2399: a rigid pill, a faint preview
on the side, then a 260ms travel into it while the corners on that side square off. But
once docked, nothing says the pill is *attached* to the window rather than parked next to
its edge. A flush rectangle against the edge reads as "touching", not "joined".

The earlier attempt (commit 1daad43) read as goo. That was not because of the fillets'
shape but because of their **behaviour**: they grew out of the edge while the pill was
still under the finger, the pill leaned toward the edge ahead of the pointer, and its
corners tightened as it neared. All of that is gone now and must stay gone.

## Target

The idiom is a browser tab, not a drop of liquid: a tab's lower corners curve *outward*
into the toolbar it belongs to (Chrome, Arc, Safari). Here the docked pill gets the same
two concave fillets, 8px, outside its box on the side it is docked to. They are part of
the **docked shape**, never part of the drag:

- **Free or held:** no fillets. The held pill is exactly as today.
- **Landing:** the fillets come in during the last part of the travel. They are delayed
  `140ms` and then take `opacity` `0 → 1` over `120ms ease-out` and `scale` `0.5 → 1` over
  `200ms cubic-bezier(0.23, 1, 0.32, 1)`, from the corner where they meet the pill and the
  edge. So they arrive at about 300–340ms, just as the pill settles: it lands, then it joins.
- **Picked up:** they go at once, with `opacity` and `scale` back over `80ms ease-out` and
  no delay. A fast exit, a slower deliberate arrival.
- **The preview** (`.dock-ghost`) shows the same fillets, so it previews the joined shape.
- **Hover** changes the fillets' colour with the body's (they inherit its `background-color`).
- **Dark mode:** the existing hairline (`filter: var(--launcher-edge)`) already follows
  pseudo-elements, so it traces the fillets too.
- **Reduced motion:** opacity only (`150ms ease-out`), no scale, no delay.

## Repo conventions to follow

- Every colour is a token; `colors.test.ts` refuses `#rrggbb` and `rgb(`/`rgba(` in rules.
  `transparent` and named colours pass. A **mask** uses alpha only, so `black` in a mask is
  not a colour choice; say so in the comment.
- Strong ease-out in this file is `cubic-bezier(0.23, 1, 0.32, 1)` (`.launcher.settling`, `styles.ts:409`).
- Geometry stays in `launcher-place.ts` with tests (exemplar: `glue`, `centreOf`).
- Comments are full sentences in the existing voice.

## Current code

```css
/* packages/loupe/src/toolbar/styles.ts:401-404 — the docked corners */
.launcher[data-edge="right"], .dock-ghost[data-edge="right"] { border-radius: 16px 0 0 16px; }
.launcher[data-edge="left"], .dock-ghost[data-edge="left"] { border-radius: 0 16px 16px 0; }
.launcher[data-edge="top"], .dock-ghost[data-edge="top"] { border-radius: 0 0 16px 16px; }
.launcher[data-edge="bottom"], .dock-ghost[data-edge="bottom"] { border-radius: 16px 16px 0 0; }
```

```ts
// packages/loupe/src/toolbar/launcher-place.ts:36-41
function alongRange(edge: Edge, viewport: Viewport): [number, number] {
  const side = horizontal(edge) ? viewport.width : viewport.height;
  const half = sizeOn(edge).length / 2 + MARGIN;
  return [half, side - half];
}
```

`.launcher` is a 44 × 32px `position: fixed` button; its `data-edge` is `"free"` while held
or free, and `"right" | "left" | "top" | "bottom"` when docked. `.dock-ghost` is a span of
the same size whose `data-edge` is the side it previews (absent before the first preview).

## Steps

1. **`launcher-place.ts`: keep the fillets clear of the corners.** Below `MARGIN`, add
   ```ts
   /** The concave fillets a docked pill flares into its side with, outside its box (styles.ts). */
   export const FLARE = 8;
   ```
   and in `alongRange` change `sizeOn(edge).length / 2 + MARGIN` to
   `sizeOn(edge).length / 2 + FLARE + MARGIN`. Update the doc comment of `alongRange` to
   "keeping its fillets clear of the corners".

2. **`launcher-place.test.ts`:** import `FLARE`, rename the test "keeps a docked pill's ends
   clear of the corners" to "keeps a docked pill's fillets clear of the corners", and change
   its first expectation to `expect(centre.x - BODY.width / 2 - FLARE).toBe(MARGIN);`.

3. **`styles.ts`: add the fillets.** Directly after line 404 (the last `border-radius` rule
   above), insert:

   ```css
   /* Docked, the tab flares into its side, as a browser tab into its toolbar: two 8px concave
      fillets outside its box, where it meets the window's edge. They are the docked shape, never
      the drag: they arrive as it lands and go at once when it is picked up. The mask uses alpha
      only, so its black is not a colour. */
   .launcher::before, .launcher::after, .dock-ghost::before, .dock-ghost::after {
     content: ""; position: absolute; width: 8px; height: 8px; pointer-events: none; background-color: inherit;
     opacity: 0; scale: 0.5; transition: opacity 80ms ease-out, scale 80ms ease-out;
   }
   .launcher:not([data-edge="free"])::before, .launcher:not([data-edge="free"])::after {
     opacity: 1; scale: 1; transition: opacity 120ms ease-out 140ms, scale 200ms cubic-bezier(0.23, 1, 0.32, 1) 140ms;
   }
   .dock-ghost[data-edge]::before, .dock-ghost[data-edge]::after { opacity: 1; scale: 1; transition: none; }
   .launcher[data-edge="right"]::before, .dock-ghost[data-edge="right"]::before { left: 36px; top: -8px; mask: radial-gradient(circle at 0 0, transparent 7.5px, black 8px); transform-origin: 100% 100%; }
   .launcher[data-edge="right"]::after, .dock-ghost[data-edge="right"]::after { left: 36px; top: 32px; mask: radial-gradient(circle at 0 100%, transparent 7.5px, black 8px); transform-origin: 100% 0; }
   .launcher[data-edge="left"]::before, .dock-ghost[data-edge="left"]::before { left: 0; top: -8px; mask: radial-gradient(circle at 100% 0, transparent 7.5px, black 8px); transform-origin: 0 100%; }
   .launcher[data-edge="left"]::after, .dock-ghost[data-edge="left"]::after { left: 0; top: 32px; mask: radial-gradient(circle at 100% 100%, transparent 7.5px, black 8px); transform-origin: 0 0; }
   .launcher[data-edge="top"]::before, .dock-ghost[data-edge="top"]::before { left: -8px; top: 0; mask: radial-gradient(circle at 0 100%, transparent 7.5px, black 8px); transform-origin: 100% 0; }
   .launcher[data-edge="top"]::after, .dock-ghost[data-edge="top"]::after { left: 44px; top: 0; mask: radial-gradient(circle at 100% 100%, transparent 7.5px, black 8px); transform-origin: 0 0; }
   .launcher[data-edge="bottom"]::before, .dock-ghost[data-edge="bottom"]::before { left: -8px; top: 24px; mask: radial-gradient(circle at 0 0, transparent 7.5px, black 8px); transform-origin: 100% 100%; }
   .launcher[data-edge="bottom"]::after, .dock-ghost[data-edge="bottom"]::after { left: 44px; top: 24px; mask: radial-gradient(circle at 100% 0, transparent 7.5px, black 8px); transform-origin: 0 100%; }
   ```

   How to check one by hand: on the right side, the top fillet is the 8px square just above
   the pill's top-right corner. The circle is centred on that square's corner furthest from
   both the pill and the edge (its top-left), so what stays filled hugs the pill's top and
   the window's edge. The `transform-origin` is the opposite corner, where pill and edge meet.

4. **`styles.ts`: reduced motion.** Inside the existing
   `@media (prefers-reduced-motion: reduce) { … }` block (`styles.ts:431-435`), add:
   ```css
   .launcher::before, .launcher::after, .launcher:not([data-edge="free"])::before, .launcher:not([data-edge="free"])::after { scale: none; transition: opacity 150ms ease-out; }
   ```

5. **`DESIGN.md`** (`packages/loupe/DESIGN.md`, section "### Collapsed" and the "The
   collapsed pill" line under components): say that docked, the tab flares into its side
   with two 8px concave fillets outside its box, arriving 140ms into the landing (120ms
   fade, 200ms scale from 0.5) and leaving in 80ms when picked up; the preview shows them
   too; under reduced motion they fade.

## Boundaries

- Do NOT change `launcher.tsx`. The fillets are CSS on the existing `data-edge`.
- Do NOT draw fillets while the pill is held (`data-edge="free"`), and do NOT animate them
  with JS. No SVG, no `filter: url(#goo)`, no blur.
- Do NOT change the travel (260ms), the corner squaring, the preview's opacity (0.16), the
  tuck or slide-out, or the open/close of the panel.
- Do NOT change `REACH`, `MARGIN`, the flick, or the pill's size.
- If the code at the cited lines no longer matches (drift since 44b2399), STOP and report.

## Verification

- **Mechanical:** from `packages/loupe`: `pnpm typecheck`, `pnpm test` (all pass, including
  `colors.test.ts`), then `npx tsc6 -p tsconfig.build.json`. Don't use `pnpm build`: it empties
  `dist` while the dev server runs.
- **Feel check** (the Browser pane must be visible, or use a real browser; a hidden pane
  draws about one frame a second): run `fixture-app` (localhost:3100), press Hide panel.
  - Drag the pill mid-page: no fillets, a plain stadium.
  - Bring it within ~56px of the right side: the faint preview shows the tab *with* its
    two fillets.
  - Let go: it travels in, the corners square, and only as it settles do the fillets swell
    out of the corner where pill and edge meet. It should read as "it clicked in", not as
    "it melted in". If it reads as melting, try 6px fillets before anything else: `FLARE = 6`,
    and in step 3 `width`/`height` 6px, `-8px` → `-6px`, `36px` → `38px`, `24px` → `26px`
    (`32px` and `44px` stay), and the mask stops `5.5px` / `6px`.
  - Pick it up again: the fillets are gone within a frame or two.
  - Hover: the fillets lighten with the body, no seam. Dark theme: the hairline traces the
    fillets.
  - Dock on each of the four sides with the arrow keys and check each pair of fillets
    curves into the edge (not away from it).
  - DevTools Animations panel at 10%: the fillets start after the travel is mostly done.
  - Rendering panel, `prefers-reduced-motion: reduce`: they fade in, no scale.
- **Done when:** the four sides each show two fillets joining the pill to the edge only
  when docked, and `colors.test.ts` passes.
