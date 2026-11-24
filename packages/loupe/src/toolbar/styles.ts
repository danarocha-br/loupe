// The Toolbar's look: Paper's "Redraw · Inspector as property rows · light" (2026-11-22)
// and the boards drawn from it. A grey ground in the column the page makes room for,
// white cards on it: a header card with the wordmark and the tools, the content, and a
// footer card with the count and Copy Proposal. The Inspector is one card of property
// rows, each option a chip, what shows now in salmon; Select multiple's scope says
// how far it reaches. Changes keep their numbered delta; on the page, red outlines
// mark the selection and, for a moment, what a change reached.
// The header, the footer and Copy Proposal are patterns now (patterns/header/, footer/,
// copy-flow/); what is left here is the sheet itself, the pill and the page's marks.
// It lives in the Toolbar's shadow root, so the app's CSS
// can't reach it and none of it reaches the app. Every colour is a token on the host,
// generated from tokens.ts, light by default and dark under `data-loupe-theme="dark"`, set from the OS
// preference or the footer's toggle. System faces only: a shadow root can't load a
// web font.

import { FONT, hostDeclarations, PAGE, size } from "./tokens.js";

export const HOST_ATTRIBUTE = "data-loupe-toolbar";

/** On the host: `light` or `dark`. Loupe's own name, so an app's `[data-theme]` CSS never matches it. */
export const THEME_ATTRIBUTE = "data-loupe-theme";

/** Where the reader's choice of light or dark is kept; absent, the OS preference decides. */
export const THEME_KEY = "loupe:theme";

/** On the host for the one frame a theme switch lands in: every transition is off. */
export const SWITCHING_ATTRIBUTE = "data-loupe-switching";

const { sans: SANS } = FONT;

/** On the host once the text-size unit is registered (index.tsx): sizes then follow the reader's default. */
export const SCALE_ATTRIBUTE = "data-loupe-scale";

/**
 * The ground every layer stands on, the stylesheet's \`tokens\` layer (surface/): the host's
 * custom properties from tokens.ts, and the elements' defaults. In a layer below the
 * primitives, so a reset here (\`button { padding: 0 }\`) never undoes a primitive's rule.
 */
export const GROUND_CSS = `
/* Left to right in any app: \`all\` leaves direction alone, so an RTL page would half-mirror the panel. App text keeps dir="auto". */
:host { all: initial; direction: ltr; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; --loupe-px: 1px; ${hostDeclarations("light")} color-scheme: light; }
/* The reader's default text size, over 16: \`all: initial\` left the host at \`medium\`. */
:host([data-loupe-scale]) { --loupe-px: calc(1em / 16); }
:host([data-loupe-theme="dark"]) { ${hostDeclarations("dark")} color-scheme: dark; }
* { box-sizing: border-box; }
::selection { background: var(--select); }
:host([data-loupe-switching]) * { transition: none !important; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
p { margin: 0; }
h2, h3 { margin: 0; }
/* A heading's default, in the tokens layer: a primitive's or a pattern's own rule for its heading wins over it. */
h3 { font: 500 ${size(14)}/1.2857 ${SANS}; letter-spacing: -0.01em; color: var(--ink); }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; opacity: 0.45; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

/**
 * The views' rules. Not in a layer yet: unlayered, they come after every layer (surface/),
 * so a view can still adjust a primitive while its rules move into patterns and primitives.
 */
export const CSS = `
/* Text */
.panel {
  font: 400 ${size(13)}/1.3846 ${SANS}; color: var(--ink);
}
/* Paragraphs keep their last word company; headings balance instead. */
.panel { overflow-wrap: break-word; text-wrap: pretty; }
.label { font: 500 ${size(11)}/1.2727 ${SANS}; color: var(--muted); }

/* The panel: a sheet in the column the page makes room for (dock.ts), white cards on it */
.panel {
  position: fixed; top: 8px; right: 0; bottom: 8px; z-index: 2147483647; width: 344px;
  display: flex; flex-direction: column; overflow: hidden; background: var(--ground);
  border-radius: 24px 0 0 24px; box-shadow: 0 0 0 1px var(--edge), 0 8px 24px var(--edge);
  transition: opacity 120ms ease-out, translate 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
/* The drawer: it slides out of the window's right edge as the pill tucks away, and back into it on Hide, quicker. */
@starting-style { .panel { translate: calc(100% + 8px) 0; } }
.panel.closing { translate: calc(100% + 8px) 0; pointer-events: none; transition: translate 220ms cubic-bezier(0.23, 1, 0.32, 1); }
@media (prefers-reduced-motion: reduce) {
  .panel { transition: opacity 150ms ease-out; }
  @starting-style { .panel { translate: none; opacity: 0; } }
  .panel.closing { translate: none; opacity: 0; transition: opacity 150ms ease-out; }
}

.panel.overlay { box-shadow: 0 0 0 1px var(--edge), var(--overlay-shadow); }
/* Alt held: see through to what runs under the column, such as an app's own dialog. */
.panel.peek { opacity: 0.08; pointer-events: none; }
.middle {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 6px; padding: 6px;
  scrollbar-width: thin; scrollbar-color: var(--rule-strong) transparent;
}
/* Cards keep their height and the middle scrolls: a card that clips its overflow would otherwise shrink to nothing. */
.middle > * { flex: none; }

/* Collapsed (launcher.tsx): a flat dark pill with the L, free, or docked a few px off a side. Its body
   is drawn in .goo, where it runs together with the window's edge while it glues, and lets go once parked. */
.launcher {
  position: fixed; left: 0; top: 0; z-index: 2147483647; display: block; width: 44px; height: 32px; padding: 0; border-radius: 16px; background: none; color: var(--on-band);
  touch-action: none; user-select: none; -webkit-user-select: none; cursor: pointer; filter: var(--launcher-edge);
  transition: transform 240ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms ease-out;
}
/* The body and a body for each side of the window, through one blur and threshold (launcher.tsx, Goo). */
.launcher .goo { position: absolute; left: -32px; top: -32px; display: block; overflow: visible; pointer-events: none; }
.launcher .goo rect { fill: var(--band); transition: fill 120ms ease-out; }
@media (hover: hover) and (pointer: fine) { .launcher:not(.dragging):hover .goo rect { fill: var(--band-hover); } }
/* Travelling, each side's body moves by the opposite of the pill's travel on the same curve, so it holds still on the window's edge. */
.launcher.settling .goo .wall { transition: fill 120ms ease-out, translate 260ms cubic-bezier(0.23, 1, 0.32, 1); }
/* Landed: the edge draws back slowly at first, so the neck visibly thins and pinches (~115ms), then
   fast, so the stubs pull back once it breaks, as a liquid neck does. Held, they follow at once. */
.launcher:not(.settling):not(.dragging) .goo .wall { transition: fill 120ms ease-out, translate 320ms cubic-bezier(0.77, 0, 0.175, 1); }
.launcher .mark { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; transform: translate(-50%, -50%); pointer-events: none; }
.launcher .glyph { display: block; }
.launcher.dragging { cursor: grabbing; }
/* After a drop, a dock or a key: it travels to its place, quick out and a soft landing. */
.launcher.settling { transition: translate 260ms cubic-bezier(0.23, 1, 0.32, 1), transform 240ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms ease-out; }
.launcher:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* The handle: as the panel opens it tucks into its side (free, it settles away), and as the
   panel closes it slides back out of its side; docked 6px off the side, it travels that much further. A transform, apart from the translate that places it. */
.launcher.leaving { pointer-events: none; transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), opacity 120ms ease-out; }
.launcher.leaving[data-edge="right"] { transform: translateX(calc(100% + 6px)); }
.launcher.leaving[data-edge="left"] { transform: translateX(calc(-100% - 6px)); }
.launcher.leaving[data-edge="top"] { transform: translateY(calc(-100% - 6px)); }
.launcher.leaving[data-edge="bottom"] { transform: translateY(calc(100% + 6px)); }
.launcher.leaving[data-edge="free"] { transform: scale(0.9); opacity: 0; }
@starting-style {
  .launcher[data-edge="right"] { transform: translateX(calc(100% + 6px)); }
  .launcher[data-edge="left"] { transform: translateX(calc(-100% - 6px)); }
  .launcher[data-edge="top"] { transform: translateY(calc(-100% - 6px)); }
  .launcher[data-edge="bottom"] { transform: translateY(calc(100% + 6px)); }
  .launcher[data-edge="free"] { transform: scale(0.9); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .launcher, .launcher.settling, .launcher.leaving { transition: opacity 150ms ease-out; }
  .launcher.settling .goo .wall, .launcher:not(.settling):not(.dragging) .goo .wall { transition: none; }
  .launcher.leaving[data-edge] { transform: none; opacity: 0; }
  @starting-style { .launcher[data-edge] { transform: none; opacity: 0; } }
}

/* On the page: the selected Instance solid and tagged with its size, the others it reaches
   dashed, left-out and hovered ones dashed grey; a change's outlines fade once it has landed */
.ring[data-ring], .mark[data-mark] { position: fixed; pointer-events: none; z-index: 2147483646; border-radius: 8px; transition: opacity 160ms ease-out; }
.ring[data-ring] { border: 2px solid ${PAGE.ink}; box-shadow: 0 0 0 1px ${PAGE.halo}; }
.ring[data-ring].member, .mark[data-mark] { border: 1.5px dashed ${PAGE.line}; box-shadow: none; }
.ring[data-ring].out, .ring[data-ring].hover { border: 1.5px dashed ${PAGE.hover}; box-shadow: none; }
.ring[data-ring] .label { position: absolute; bottom: calc(100% + 2px); right: -2px; display: flex; align-items: center; height: 18px; padding: 0 8px; border-radius: 4px; background: ${PAGE.ink}; color: ${PAGE.onInk}; font: 500 ${size(11)}/1.2727 ${SANS}; white-space: nowrap; font-variant-numeric: tabular-nums; box-shadow: 0 1px 2px rgba(27, 34, 32, 0.2); }
.ring[data-ring] .label.below { bottom: auto; top: calc(100% + 2px); }
.ring[data-ring] .label.start { right: auto; left: -2px; }
.mark[data-mark] { animation: loupe-mark-in 160ms ease-out; }
.ring[data-ring].quiet, .mark[data-mark].quiet { opacity: 0; transition: opacity 480ms ease-in; }
/* Picking: what a click would select, washed so it shows at a glance, and its tag */
.ring[data-ring].pick { border: 1.5px solid ${PAGE.ink}; background: ${PAGE.fill}; }
.pick-tag { position: fixed; pointer-events: none; z-index: 2147483646; padding: 2px 9px; border-radius: 999px; background: ${PAGE.band}; color: ${PAGE.onBand}; font: 500 ${size(11)}/1.5455 ${SANS}; white-space: nowrap; box-shadow: 0 1px 2px rgba(27, 34, 32, 0.24); }
.pick-tag .detail { color: ${PAGE.onBandMuted}; font-weight: 400; }
@keyframes loupe-mark-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ring[data-ring], .mark[data-mark], .ring[data-ring].quiet, .mark[data-mark].quiet { animation: none; transition: none; } }

/* Forced colours (Windows High Contrast) drop backgrounds and box-shadows: draw edges and states in system colours. */
@media (forced-colors: active) {
  .panel { border: 1px solid transparent; }
  .launcher { forced-color-adjust: none; color: ButtonFace; filter: none; }
  .launcher .goo rect { fill: ButtonText; }
  .launcher:focus-visible { outline-color: Highlight; }
}
`;
