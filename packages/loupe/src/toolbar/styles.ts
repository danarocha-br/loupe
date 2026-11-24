// The Toolbar's ground: the shadow host's attributes, and the stylesheet's `tokens` layer
// (surface/ assembles the rest). Every view's look now lives in a pattern or a primitive
// (ADR 0003; patterns waves 1 to 5): the pill, the sheet, its cards and the page's marks are
// patterns (src/toolbar/patterns/), each in the `patterns` layer. What is left here is what
// every layer stands on: the host's custom properties from tokens.ts, light by default and
// dark under `data-loupe-theme="dark"`, and the elements' defaults, each rule with its reason.
// It lives in the Toolbar's shadow root, so the app's CSS can't reach it and none of it
// reaches the app. System faces only: a shadow root can't load a web font.

import { FONT, hostDeclarations, size } from "./tokens.js";

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
/* Every box is sized with its border and padding, as every layer measures it. */
* { box-sizing: border-box; }
/* Selected text in the panel's own tint, not the app's or the browser's. */
::selection { background: var(--select); }
/* The frame a theme lands in (surface/ useTheme): every colour easing at once would smear the switch. Important, so no layer's transition outlasts it. */
:host([data-loupe-switching]) * { transition: none !important; }
/* Words for a screen reader alone. A class, as the platform's idiom: any layer's part can carry it, and it means the same everywhere. */
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
/* Paragraphs and headings keep no browser margin: the cards space them. */
p { margin: 0; }
h2, h3 { margin: 0; }
/* A heading's default, in the tokens layer: a primitive's or a pattern's own rule for its heading wins over it. */
h3 { font: 500 ${size(14)}/1.2857 ${SANS}; letter-spacing: -0.01em; color: var(--ink); }
/* A button is bare until a primitive or a pattern draws it, and takes its text from where it sits. */
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; opacity: 0.45; }
/* Focus shows the same ring everywhere; a part that draws its own keeps an outline forced colours draw (forced-colors.test.ts). */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
