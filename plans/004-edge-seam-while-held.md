# 004 — While held in reach, the window's edge lights a short seam where the pill will join it

- **Status**: TODO (an alternative or a complement to 003; see README)
- **Commit**: 44b2399
- **Severity**: LOW
- **Category**: Physicality (attachment cue)
- **Estimated scope**: 4 files (`launcher-place.ts`, `launcher.tsx`, `styles.ts`, `launcher-place.test.ts`), ~+45 lines

## Problem

The preview at 44b2399 shows *where the pill will sit*, but not that the **edge** is what
takes it. The edge itself never reacts, so the side reads as a boundary, not as something
the pill attaches to.

## Target

A cue on the edge, not on the pill (the pill stays rigid, as the designer asked):

- While the pill is held within `REACH` (56px) of a side, a **2px seam** shows on that
  window edge, centred on the preview, as long as the pill's side on that edge plus 24px
  each way (80px on the left or right side, 92px on the top or bottom). It is `var(--accent)`
  with a 1px radius.
- It fades in over `120ms ease-out` and follows the preview along the edge 1:1 (no
  transition on its position).
- It fades out over `120ms ease-out` when the pill leaves reach or is let go, where it last
  was (it doesn't jump). The landing pill covers its middle as it fades.
- Docked and not held: no seam.
- Reduced motion: the same (it only fades).

## Repo conventions to follow

- Geometry is pure and tested in `launcher-place.ts` (exemplar: `glue`, `centreOf`, `bodyRect`).
- The preview's "fade where it last was" pattern already exists in `launcher.tsx:134-137`
  (`lastGhost`); reuse its value, don't add a second ref.
- Every colour is a token (`colors.test.ts`).

## Current code

```tsx
// packages/loupe/src/toolbar/launcher.tsx:134-137
const shown = held?.edge ? { edge: held.edge, at: centreOf(glue(held.edge, along(held.edge, held.x, held.y), viewport), viewport) } : null;
const lastGhost = useRef(shown);
if (shown) lastGhost.current = shown;
const ghost = lastGhost.current;
```

```tsx
// packages/loupe/src/toolbar/launcher.tsx:218-225
<>
  {/* Under the pill, mounted while it is, so it can fade out as well as in. */}
  <span
    className={shown ? "dock-ghost shown" : "dock-ghost"}
    data-edge={ghost?.edge}
    aria-hidden="true"
    style={ghost ? { translate: `${round(ghost.at.x - BODY.width / 2)}px ${round(ghost.at.y - BODY.height / 2)}px` } : undefined}
  />
```

```css
/* packages/loupe/src/toolbar/styles.ts:414-415 */
.dock-ghost { position: fixed; left: 0; top: 0; z-index: 2147483646; width: 44px; height: 32px; border-radius: 16px; background: var(--band); opacity: 0; pointer-events: none; transition: opacity 120ms ease-out; }
.dock-ghost.shown { opacity: 0.16; }
```

## Steps

1. **`launcher-place.ts`: the seam's box.** After `bodyRect`, add:
   ```ts
   /** How far the seam on the edge runs past the pill's side, each way. */
   const SEAM_RUN = 24;
   const SEAM = 2;

   /** The seam a held pill lights on `edge`, centred on its docked centre `at`: a thin box on the window's edge. */
   export function seamRect(edge: Edge, at: { x: number; y: number }, viewport: Viewport): Rect {
     const length = sizeOn(edge).length + SEAM_RUN * 2;
     switch (edge) {
       case "left":
         return { left: 0, top: at.y - length / 2, width: SEAM, height: length };
       case "right":
         return { left: viewport.width - SEAM, top: at.y - length / 2, width: SEAM, height: length };
       case "top":
         return { left: at.x - length / 2, top: 0, width: length, height: SEAM };
       case "bottom":
         return { left: at.x - length / 2, top: viewport.height - SEAM, width: length, height: SEAM };
     }
   }
   ```

2. **`launcher-place.test.ts`:** add a test: `seamRect("right", { x: 1178, y: 400 }, VIEWPORT)`
   equals `{ left: 1198, top: 360, width: 2, height: 80 }`, and
   `seamRect("bottom", { x: 600, y: 784 }, VIEWPORT)` equals `{ left: 554, top: 798, width: 92, height: 2 }`.

3. **`launcher.tsx`:** import `seamRect`. Directly after the `.dock-ghost` span, add:
   ```tsx
   {/* The edge's side of the join: a short seam where the pill will meet it. */}
   <span
     className={shown ? "dock-seam shown" : "dock-seam"}
     aria-hidden="true"
     style={ghost ? seamStyle(seamRect(ghost.edge, ghost.at, viewport)) : undefined}
   />
   ```
   and at the bottom of the file, next to `round`:
   ```ts
   const seamStyle = (rect: Rect) => ({ translate: `${round(rect.left)}px ${round(rect.top)}px`, width: `${rect.width}px`, height: `${rect.height}px` });
   ```

4. **`styles.ts`:** after the `.dock-ghost.shown` rule (line 415), add:
   ```css
   /* The edge's side of the join: while a held pill is in reach, a short accent seam on the window's edge where it will meet it. */
   .dock-seam { position: fixed; left: 0; top: 0; z-index: 2147483646; border-radius: 1px; background: var(--accent); opacity: 0; pointer-events: none; transition: opacity 120ms ease-out; }
   .dock-seam.shown { opacity: 1; }
   ```
   and in the `@media (forced-colors: active)` block (around `styles.ts:812-816`) add
   `.dock-seam { forced-color-adjust: none; background: Highlight; }`.

5. **`launcher.test.tsx`:** in "shows where it would dock while held in reach of a side…",
   also expect `container.querySelector(".dock-seam")` to have class `shown` when in reach
   and not when back mid-page.

6. **`DESIGN.md`** ("### Collapsed"): one line: while held in reach, a 2px accent seam shows
   on that window edge where the pill will join it, 24px past its side each way, fading in
   and out over 120ms.

## Boundaries

- Do NOT change the pill, the preview's opacity, the travel, or the corner squaring.
- Do NOT animate the seam's position or length; only its opacity.
- Do NOT add a seam while docked and not held.
- If the code at the cited lines no longer matches (drift since 44b2399, or plan 003
  already run, which only adds CSS and a `FLARE` constant and doesn't conflict), adapt
  line numbers only; if the excerpts themselves differ, STOP and report.

## Verification

- **Mechanical:** from `packages/loupe`: `pnpm typecheck`, `pnpm test`, then
  `npx tsc6 -p tsconfig.build.json` (not `pnpm build`).
- **Feel check** (visible Browser pane or a real browser): at localhost:3100, press Hide
  panel and drag the pill toward each side. Within ~56px, a short coral line appears on that
  edge, centred on the faint preview, and slides with it. Let go: the pill lands over its
  middle as the line fades. Pull back out of reach: the line fades where it was. If the
  coral reads as an error or as too loud next to the faint preview, try `var(--band)`
  at `opacity: 0.5` in `.dock-seam.shown` before anything else.
- **Done when:** the seam shows only while held in reach, on the right edge for each side,
  and the tests above pass.
