# 001 — Move the page's column in the same frame as the panel

- **Status**: DONE
- **Commit**: 1daad43
- **Severity**: HIGH
- **Category**: Performance (frame timing) / Interruptibility
- **Estimated scope**: 3 files (`dock.ts`, `index.tsx`, `dock.test.ts`), ~60 lines

## Problem

Opening and closing the collapsed Toolbar flickers, and the cause is timing, not
easing. The page's column (the root's `margin-right` that makes room for the panel)
is set and cleared in a React `useEffect`, one step behind the panel itself.
Measured in the running fixture app (localhost:3100) on 2026-11-22:

1. **Open: the page map reshapes mid-slide.** The page map measures the page's
   boxes *while rendering* (`packages/loupe/src/toolbar/page-map.tsx:71`), and that
   first render runs before the column is reserved. So it draws the full-width page
   (aspect ratio 2.70), then about 150ms later, while the panel is still sliding in,
   re-measures the narrowed page (ratio 2.03) and every block jumps.
2. **Close: one frame with an empty strip.** The close ends from a `setTimeout`, so
   React flushes the margin's cleanup in a later task: the panel was removed at 229ms
   and the margin cleared at 230ms. For a frame the page is still narrow with nothing
   in its column, then it jumps wide.
3. **Close ends on a clock, not on the slide.** The unmount fires after a fixed
   220ms, whatever the slide has done. A slow frame removes the panel before it is off
   screen, which shows as a pop.

```ts
// packages/loupe/src/toolbar/dock.ts:52-65 — current
  useEffect(() => {
    if (margin === 0) return;
    const root = document.documentElement;
    const before = root.style.getPropertyValue("margin-right");
    const priority = root.style.getPropertyPriority("margin-right");
    root.style.setProperty("margin-right", `${margin}px`);
    reserved = margin;
    return () => {
      reserved = 0;
      if (before === "") root.style.removeProperty("margin-right");
      else root.style.setProperty("margin-right", before, priority);
    };
  }, [margin]);
```

```ts
// packages/loupe/src/toolbar/index.tsx:164-185 — current
  const open = () => {
    focusSwap.current = focusIsHere();
    setHidden(false);
    if (!animates()) return;
    setTucking(true);
    clearTimeout(tuckTimer.current);
    tuckTimer.current = setTimeout(() => setTucking(false), TUCK_MS);
  };
  const hide = () => {
    if (closing) return;
    focusSwap.current = focusIsHere();
    if (!animates()) {
      setHidden(true);
      return;
    }
    // Mid-open, the panel's slide turns round from where it is (a transition, not a timeline).
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      setHidden(true);
    }, CLOSE_MS);
  };
```

## Target

- The column is taken **synchronously in the open click handler, before** React
  renders the panel. Anything that measures the page during that render (the page
  map) sees the narrowed page.
- The column is released **synchronously in the same callback** that unmounts the
  panel, so the panel's removal and the page widening land in one frame.
- The close ends on the panel's own `transitionend` for `translate` (for `opacity`
  under reduced motion), with a 300ms fallback timeout in case the event never comes
  (a hidden tab, a transition cancelled by a theme switch).
- No change to any duration, curve or distance: open stays 300ms on
  `cubic-bezier(0.32, 0.72, 0, 1)`, close stays 220ms on `cubic-bezier(0.23, 1, 0.32, 1)`.

## Repo conventions to follow

- `dock.ts` owns the column; keep the module-level `reserved` value that
  `reservedWidth()` / `pageWidth()` read (`dock.ts:19-29`), and keep restoring the
  root's previous inline `margin-right` and its priority exactly as today.
- Comments are full sentences in the voice of the existing ones ("The column is the
  root's right margin, set inline while the panel is open…", `dock.ts:6-8`).

## Steps

1. **`dock.ts`: make reserving and releasing callable directly.** Below `columnFor`,
   add:

   ```ts
   /** Puts the root's right margin back as it was; null while nothing is reserved. */
   let restore: (() => void) | null = null;

   /**
    * Takes `width` px of the page for the panel's column, now: called from the click that
    * opens the panel, before it renders, so nothing measures the page at its full width.
    * Idempotent; a second call with another width (the viewport crossed `WIDE`) just resizes it.
    */
   export function reserveColumn(width: number): void {
     if (typeof document === "undefined" || width === 0) return;
     const root = document.documentElement;
     if (restore === null) {
       const before = root.style.getPropertyValue("margin-right");
       const priority = root.style.getPropertyPriority("margin-right");
       restore = () => {
         if (before === "") root.style.removeProperty("margin-right");
         else root.style.setProperty("margin-right", before, priority);
       };
     }
     root.style.setProperty("margin-right", `${width}px`);
     reserved = width;
   }

   /** Gives the column back, now: called in the same callback that unmounts the panel. */
   export function releaseColumn(): void {
     restore?.();
     restore = null;
     reserved = 0;
   }

   /** The column a viewport this wide gives the panel: 0 where the panel overlays it. */
   export function columnWidthFor(viewport: number): number {
     const column = columnFor(viewport);
     return column.docked ? column.width : 0;
   }
   ```

2. **`dock.ts`: let `useColumn` use them, in a layout effect.** Replace the effect at
   `dock.ts:52-65` with:

   ```ts
   useLayoutEffect(() => {
     if (margin === 0) return;
     reserveColumn(margin);
     return releaseColumn;
   }, [margin]);
   ```

   and change the import on `dock.ts:10` to
   `import { useEffect, useLayoutEffect, useState } from "react";`.

3. **`index.tsx`: reserve in `open()`, before `setHidden(false)`.** Import
   `columnWidthFor, releaseColumn, reserveColumn` from `./dock.js` next to `useColumn`,
   and make `open` begin:

   ```ts
   const open = () => {
     focusSwap.current = focusIsHere();
     // Before the panel renders: the page map measures the page as it will be beside it.
     reserveColumn(columnWidthFor(window.innerWidth));
     setHidden(false);
     …rest unchanged
   ```

4. **`index.tsx`: end the close on the slide's own end, and release in that callback.**
   Replace the body of `hide` after `setClosing(true);` with:

   ```ts
   setClosing(true);
   const panel = host.shadowRoot?.querySelector<HTMLElement>(".panel") ?? null;
   let finished = false;
   const finish = () => {
     if (finished) return;
     finished = true;
     panel?.removeEventListener("transitionend", onEnd);
     clearTimeout(closeTimer.current);
     // In the same task as the unmount: the page widens in the frame the panel goes.
     releaseColumn();
     setClosing(false);
     setHidden(true);
   };
   const onEnd = (event: TransitionEvent) => {
     if (event.target === panel && (event.propertyName === "translate" || event.propertyName === "opacity")) finish();
   };
   panel?.addEventListener("transitionend", onEnd);
   // In case the end never comes (a hidden tab, a theme switch cancelling transitions).
   closeTimer.current = setTimeout(finish, CLOSE_MS + 80);
   ```

   Also call `releaseColumn()` before `setHidden(true)` in the `!animates()` branch of
   `hide`, so tests and no-motion paths release in the same task too.

5. **`dock.test.ts`: cover the new functions.** Add a test that `reserveColumn(360)`
   sets `document.documentElement.style.marginRight` to `"360px"` at once (no `act`,
   no render), that a second `reserveColumn(400)` changes it to `"400px"`, that
   `releaseColumn()` restores a margin set before the first reserve (set
   `marginRight = "12px"` first and expect `"12px"` back), and that `reservedWidth()`
   follows each step (360, 400, 0).

## Boundaries

- Do NOT change any transition value, curve, duration or class in `styles.ts`.
- Do NOT change `page-map.tsx`: the fix is that the page is already narrowed when it renders.
- Do NOT change the column widths or breakpoints (`WIDTH`, `WIDE_WIDTH`, `WIDE`, `ROOM`).
- Do NOT touch `launcher.tsx` or `launcher-place.ts` (plan 002 owns them).
- If the code at the cited lines no longer matches the excerpts (drift since 1daad43), STOP and report.

## Verification

- **Mechanical**: from `packages/loupe`, `pnpm typecheck` (no errors) and `pnpm test`
  (all files pass, including the new `dock.test.ts` cases). Then
  `npx tsc6 -p tsconfig.build.json` so the fixture app picks the change up. Don't use
  `pnpm build`, which empties `dist` while the dev server runs.
- **Feel check** (the Browser pane must be visible: a hidden pane throttles animation
  frames to one a second and nothing below can be seen): run `fixture-app` from
  `.claude/launch.json`, press Hide in the panel header, then click the pill.
  - Opening: the page map's blocks hold their shape from the first frame the panel
    shows; nothing in the map moves while the panel slides.
  - Closing: the page widens in the same frame the panel is gone; there is never a
    frame with an empty strip on the right.
  - In DevTools' Animations panel at 10% playback, step through the close: the panel
    reaches `translate: calc(100% + 8px)` before it is removed.
  - Press Hide and, mid-slide, nothing else: the unmount still happens exactly once.
- **Done when**: in the page, sampling `.map-sheet .fit`'s `--ratio` at 20ms and 300ms
  after clicking the pill gives the same value; and a `MutationObserver` on the shadow
  root plus the root's `style` attribute logs the panel's removal and
  `margin-right` being cleared in the same task (same timestamp).
