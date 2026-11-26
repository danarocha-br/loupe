// The chrome's words that panel-view decides outside `panelView()`: the collapsed pill's,
// the sheet's name, and the page's marks'. A module of its own, importing types only, so
// the collapsed pill (index.tsx, launcher.tsx) takes its words without loading the rest
// of panel-view or anything it reads.

import type { LauncherWords, OutlineWords, SheetWords } from "@loupe/patterns";

/** The collapsed pill's words (patterns/view.ts `LauncherWords`). */
export const LAUNCHER_WORDS: LauncherWords = {
  label: "Show Loupe",
  title: (shortcut) => `Show Loupe (${shortcut} focuses it) · drag it anywhere, or to a side to keep it there`,
};

/**
 * Said, assertively, when the panel fails to load or to render (ADR 0008): the pill comes
 * back, and nothing on screen says why. Loupe's own words: no pattern draws them.
 */
export const PANEL_FAILED = "Loupe couldn’t open. Show it again to try once more.";

/** The sheet's name (patterns/view.ts `SheetWords`). */
export const SHEET_WORDS: SheetWords = { label: "Loupe" };

/** The page's marks' words (patterns/view.ts `OutlineWords`): "Button · 32 × 32", and " · " before the pick tag's detail. */
export const OUTLINE_WORDS: OutlineWords = {
  size: (name, width, height) => `${name} · ${width} × ${height}`,
  detailLead: " · ",
};
