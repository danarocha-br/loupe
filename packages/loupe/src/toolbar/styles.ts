// The Toolbar's look: Paper's "Redraw · Inspector as property rows · light" (2026-11-22)
// and the boards drawn from it. A grey ground in the column the page makes room for,
// white cards on it: a header card with the wordmark and the tools, the content, and a
// footer card with the count and Copy Proposal. The Inspector is one card of property
// rows, each option a chip, what shows now in salmon; Select multiple's scope says
// how far it reaches. Changes keep their numbered delta; on the page, red outlines
// mark the selection and, for a moment, what a change reached.
// It lives in the Toolbar's shadow root, so the app's CSS
// can't reach it and none of it reaches the app. Every colour is a token on the host,
// light by default and dark under `data-loupe-theme="dark"`, set from the OS
// preference or the footer's toggle. System faces only: a shadow root can't load a
// web font.

export const HOST_ATTRIBUTE = "data-loupe-toolbar";

/** On the host: `light` or `dark`. Loupe's own name, so an app's `[data-theme]` CSS never matches it. */
export const THEME_ATTRIBUTE = "data-loupe-theme";

/** Where the reader's choice of light or dark is kept; absent, the OS preference decides. */
export const THEME_KEY = "loupe:theme";

/** On the host for the one frame a theme switch lands in: every transition is off. */
export const SWITCHING_ATTRIBUTE = "data-loupe-switching";

type Tokens = Record<string, string>;


const LIGHT: Tokens = {
  well: "#F7F7F5",
  card: "#FFFFFF",
  sunk: "#F5F5F3",
  "sunk-hover": "#ECECE9",
  hover: "#F7F7F5",
  ink: "#0A0A0A",
  "on-ink": "#FFFFFF",
  muted: "#5E5E5E",
  faint: "#6E6E6E",
  "icon-faint": "#8A8A8A",
  "line-faint": "#A0A0A0",
  "tree-ink": "#4A4A4A",
  rule: "#EEEEEC",
  ground: "#F0F0EE",
  "rule-strong": "#CFCBC4",
  tree: "#D2CFC9",
  edge: "rgba(27, 34, 32, 0.07)",
  hairline: "rgba(27, 34, 32, 0.06)",
  divider: "rgba(27, 34, 32, 0.1)",
  band: "#1B2220",
  "on-band": "#F0F0F0",
  shown: "#FCD1BF",
  "on-shown": "#0A0A0A",
  "shown-edge": "#FFA8A2",
  accent: "#FE4437",
  "accent-text": "#B3261B",
  "accent-wash": "rgba(254, 68, 55, 0.1)",
  link: "#014886",
  "link-wash": "rgba(1, 72, 134, 0.06)",
  "link-edge": "rgba(1, 72, 134, 0.16)",
  "revision-line": "#8276CF",
  "revision-text": "#4F43B8",
  "ok-bg": "rgba(0, 180, 81, 0.2)",
  "ok-fg": "#01563F",
  "switch-off": "#938B7F",
  "switch-on": "#27917E",
  primary: "#1B2220",
  "on-primary": "#FFFFFF",
  held: "#8E959C",
  alert: "#C2570C",
  "warn-fg": "#7A4B00",
  "warn-bg": "#FFF3DC",
  "warn-dot": "#C98A12",
  select: "rgba(254, 68, 55, 0.2)",
  kbd: "rgba(10, 10, 10, 0.08)",
  "focus-glow": "rgba(254, 68, 55, 0.18)",
  "field-edge": "#8F8A83",
  "tools-wash": "#EFEFEC",
  "map-dot": "rgba(27, 34, 32, 0.16)",
  "on-check": "#FFFFFF",
  shadow: "0 0 0 1px rgba(27, 34, 32, 0.05), 0 1px 2px rgba(27, 34, 32, 0.06), 0 4px 12px rgba(27, 34, 32, 0.04)",
  "tile-shadow": "inset 0 0 0 1px rgba(27, 34, 32, 0.08), 0 1px 2px rgba(27, 34, 32, 0.05)",
  "site-shadow": "0 0 0 1px rgba(27, 34, 32, 0.06), 0 1px 2px rgba(27, 34, 32, 0.05)",
  "raised-shadow": "0 0 0 1px rgba(27, 34, 32, 0.06), 0 1px 2px rgba(27, 34, 32, 0.14)",
  "primary-shadow": "inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 1px 2px rgba(27, 34, 32, 0.25)",
  "copied-bg": "#DFF7E4",
  "copied-fg": "#14532D",
  "copied-edge": "rgba(20, 83, 45, 0.12)",
  "copied-rule": "rgba(20, 83, 45, 0.18)",
  "warn-edge": "rgba(201, 138, 18, 0.35)",
  "warn-rule": "rgba(122, 75, 0, 0.2)",
  "warn-wash": "rgba(122, 75, 0, 0.1)",
  "warn-muted": "#8A6A2A",
  "on-primary-rule": "rgba(255, 255, 255, 0.18)",
  "on-primary-wash": "rgba(255, 255, 255, 0.14)",
  toast: "#1B2220",
  "copied-badge": "#27917E",
  "on-toast": "#FFFFFF",
  "toast-muted": "#A3AAA7",
  "toast-edge": "rgba(255, 255, 255, 0.06)",
  "popover-edge": "rgba(27, 34, 32, 0.08)",
  "text-select": "rgba(1, 72, 134, 0.12)",
  "popover-shadow": "0 0 0 1px rgba(27, 34, 32, 0.08), 0 16px 40px rgba(27, 34, 32, 0.18), 0 2px 6px rgba(27, 34, 32, 0.08)",
  "toast-shadow": "0 8px 24px rgba(27, 34, 32, 0.28)",
  "overlay-shadow": "0 12px 36px rgba(27, 34, 32, 0.22), 0 2px 6px rgba(27, 34, 32, 0.1)",
  /** The collapsed pill is flat, as the reference draws it: in light, no edge at all. */
  "launcher-edge": "none",
  "band-hover": "#2E3835",
};

const DARK: Tokens = {
  well: "#1F2423",
  card: "#181C1B",
  sunk: "#242928",
  "sunk-hover": "#2E3432",
  hover: "#1F2423",
  ink: "#ECEDEA",
  "on-ink": "#0E1110",
  muted: "#A4AAA7",
  faint: "#8B918E",
  "icon-faint": "#7F8683",
  "line-faint": "#6E7572",
  "tree-ink": "#C4C9C6",
  rule: "#2C3230",
  ground: "#0E1110",
  "rule-strong": "#4A514E",
  tree: "#3E4543",
  edge: "rgba(255, 255, 255, 0.06)",
  hairline: "rgba(255, 255, 255, 0.07)",
  divider: "rgba(255, 255, 255, 0.12)",
  band: "#29322F",
  "on-band": "#F0F0F0",
  shown: "#5A2A20",
  "on-shown": "#FFE6DD",
  "shown-edge": "#8C3F31",
  accent: "#FF6A5C",
  "accent-text": "#FF9A8F",
  "accent-wash": "rgba(255, 106, 92, 0.14)",
  link: "#8DC2F5",
  "link-wash": "rgba(141, 194, 245, 0.08)",
  "link-edge": "rgba(141, 194, 245, 0.24)",
  "revision-line": "#A99FF2",
  "revision-text": "#BDB5FF",
  "ok-bg": "#143A25",
  "ok-fg": "#93E2AC",
  "switch-off": "#6A726F",
  "switch-on": "#2FA58F",
  primary: "#F6F3EF",
  "on-primary": "#1B2220",
  held: "#6B737C",
  alert: "#F0904A",
  "warn-fg": "#E5B567",
  "warn-bg": "#2A2109",
  "warn-dot": "#D9963B",
  select: "rgba(255, 106, 92, 0.3)",
  kbd: "rgba(255, 255, 255, 0.14)",
  "focus-glow": "rgba(255, 106, 92, 0.3)",
  "field-edge": "#646C69",
  "tools-wash": "#242928",
  "map-dot": "rgba(255, 255, 255, 0.14)",
  "on-check": "#0E1110",
  shadow: "0 0 0 1px rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.25)",
  "tile-shadow": "inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.3)",
  "site-shadow": "0 0 0 1px rgba(255, 255, 255, 0.07), 0 1px 2px rgba(0, 0, 0, 0.3)",
  "raised-shadow": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.4)",
  "primary-shadow": "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.4)",
  "copied-bg": "#143A25",
  "copied-fg": "#93E2AC",
  "copied-edge": "rgba(147, 226, 172, 0.16)",
  "copied-rule": "rgba(147, 226, 172, 0.24)",
  "warn-edge": "rgba(217, 150, 59, 0.4)",
  "warn-rule": "rgba(229, 181, 103, 0.24)",
  "warn-wash": "rgba(229, 181, 103, 0.12)",
  "warn-muted": "#C9A56A",
  "on-primary-rule": "rgba(27, 34, 32, 0.18)",
  "on-primary-wash": "rgba(27, 34, 32, 0.08)",
  toast: "#2E3432",
  "copied-badge": "#2FA58F",
  "on-toast": "#F6F3EF",
  "toast-muted": "#A3AAA7",
  "toast-edge": "rgba(255, 255, 255, 0.08)",
  "popover-edge": "rgba(255, 255, 255, 0.1)",
  "text-select": "rgba(141, 194, 245, 0.24)",
  "popover-shadow": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 40px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)",
  "toast-shadow": "0 8px 24px rgba(0, 0, 0, 0.5)",
  "overlay-shadow": "0 12px 36px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3)",
  /** In dark, a hairline keeps the flat pill apart from a dark page. A filter, so it follows the outline, fillets and all. */
  "launcher-edge": "drop-shadow(0 0 0.5px rgba(255, 255, 255, 0.35))",
  "band-hover": "#35403C",
};

const declare = (tokens: Tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(" ");

const SANS = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`;

/** On the host once the text-size unit is registered (index.tsx): sizes then follow the reader's default. */
export const SCALE_ATTRIBUTE = "data-loupe-scale";

/**
 * A font size from the type scale, written in px at the browser's default 16px text.
 * `rem` would read the app's root size, so the unit is the host's own `medium` (the
 * reader's default) over 16: `--loupe-px` is registered as a <length>, so it resolves
 * once on the host and nested sizes never compound (typography review 2026-11-20).
 * Unregistered (an older browser, jsdom), it stays 1px and every size is as written.
 */
const size = (px: number) => `calc(var(--loupe-px) * ${px})`;

/** The page's marks don't follow the panel's theme: they sit on the app, in its light. */
const PAGE = {
  /** The Instances a selection reaches besides the one picked: dashed. */
  line: "#FE9992",
  /** The one picked, solid, and its size tag. */
  ink: "#FE4437",
  fill: "rgba(254, 68, 55, 0.12)",
  band: "#1B2220",
  /** Not applied: a left-out or hovered Instance's grey dashes. */
  hover: "#6F7472",
  /** Text on `ink` (the size tag) and on `band` (the pick tag), and the pick tag's detail. */
  onInk: "#FFFFFF",
  onBand: "#F0F0F0",
  onBandMuted: "rgba(240, 240, 240, 0.62)",
  /** The white keyline that lifts the selection's outline off any page. */
  halo: "rgba(255, 255, 255, 0.85)",
};

/**
 * The page map's hues, one per component in the list's order (page-map.tsx): categories,
 * not roles, so they are named values like the page's marks, the same in either theme.
 */
const MAP_HUES = ["#D2577A", "#3D7FD9", "#7A9A2E", "#A05ED1", "#8276CF", "#27917E", "#D08A16"] as const;

export const CSS = `
/* Left to right in any app: \`all\` leaves direction alone, so an RTL page would half-mirror the panel. App text keeps dir="auto". */
:host { all: initial; direction: ltr; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; --loupe-px: 1px; ${declare(LIGHT)} color-scheme: light; }
/* The reader's default text size, over 16: \`all: initial\` left the host at \`medium\`. */
:host([data-loupe-scale]) { --loupe-px: calc(1em / 16); }
:host([data-loupe-theme="dark"]) { ${declare(DARK)} color-scheme: dark; }
* { box-sizing: border-box; }
::selection { background: var(--select); }
:host([data-loupe-switching]) * { transition: none !important; }
.icon { display: block; flex: none; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* Text */
.panel {
  font: 400 ${size(13)}/1.3846 ${SANS}; color: var(--ink);
}
/* Paragraphs keep their last word company; headings balance instead. */
.panel { overflow-wrap: break-word; text-wrap: pretty; }
.mono { font-family: ${MONO}; font-weight: 400; font-size: ${size(12)}; }
.verbatim { white-space: pre-wrap; }
.muted { color: var(--muted); font-weight: 400; }
.meta { font: 400 ${size(11)}/1.2727 ${SANS}; color: var(--faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.label { font: 500 ${size(11)}/1.2727 ${SANS}; color: var(--muted); }
.body { font: 400 ${size(13)}/1.4615 ${SANS}; color: var(--muted); margin: 0; }
p { margin: 0; }
h2, h3 { margin: 0; }
h3 { font: 500 ${size(14)}/1.2857 ${SANS}; letter-spacing: -0.01em; color: var(--ink); }
kbd { font: 500 ${size(11)}/1.2727 ${MONO}; padding: 1px 5px; border-radius: 5px; background: var(--kbd); }

/* Controls: soft pills, the ink primary, the header's round tools */
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; -webkit-tap-highlight-color: transparent; }
summary { -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; opacity: 0.45; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 12px;
  border-radius: 999px; background: var(--sunk); color: var(--ink); font: 500 ${size(12)}/1.3333 ${SANS}; white-space: nowrap;
  transition: background-color 120ms ease-out;
}
.btn.small { height: 26px; padding: 0 11px; gap: 5px; }
.btn.icon, .btn.round { width: 30px; padding: 0; }
.btn.small.round { width: 26px; }
@media (hover: hover) { .btn:not(:disabled):hover { background: var(--sunk-hover); } }
.btn.primary { height: 40px; padding: 0 18px 0 16px; gap: 8px; background: var(--primary); color: var(--on-primary); font-size: ${size(13)}; font-weight: 600; box-shadow: var(--primary-shadow); }
@media (hover: hover) { .btn.primary:not(:disabled):hover { background: var(--primary); filter: brightness(1.3); } }
@media (hover: hover) { :host([data-loupe-theme="dark"]) .btn.primary:not(:disabled):hover { filter: brightness(0.92); } }
.btn.holding { background: var(--shown); color: var(--on-shown); box-shadow: inset 0 0 0 1px var(--shown-edge); }
.link { font: 600 ${size(12)}/1.3333 ${SANS}; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; min-height: 24px; }
.tool { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 999px; color: var(--muted); transition: background-color 120ms ease-out, color 120ms ease-out, box-shadow 120ms ease-out; }
@media (hover: hover) { .tool:not(:disabled):hover { background: var(--sunk); color: var(--primary); } }

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
.header { flex: none; position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 40px; margin: 4px 6px 0; padding: 0 8px 0 14px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); }
.header .brand { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--ink); }
.wordmark { display: block; flex: none; }
.report { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 ${size(10)}/1.4 ${MONO}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--faint); font-variant-numeric: tabular-nums; }
.header .report { padding-top: 4px; }
.tools { flex: none; display: flex; align-items: center; gap: 2px; }
.select-tools { display: flex; gap: 2px; padding: 2px; border-radius: 999px; background: var(--tools-wash); }
.select-tools .tool[aria-pressed="true"], .select-tools .tool.armed { background: var(--card); color: var(--primary); box-shadow: var(--raised-shadow); }
.tools .divider { flex: none; width: 1px; height: 16px; margin: 0 2px 0 11px; border-radius: 1px; background: var(--divider); }
.tool[data-marks][aria-pressed="true"] { background: var(--sunk); color: var(--primary); }
.status-region { flex: none; }
.status-line { flex: none; margin: 6px 6px 0; padding: 8px 14px; border-radius: 14px; background: var(--shown); color: var(--on-shown); box-shadow: inset 0 0 0 1px var(--shown-edge); font-size: ${size(12)}; line-height: 1.4167; }
.status-line .dot { display: inline-block; width: 8px; height: 8px; margin-right: 8px; vertical-align: 0; }
.middle {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 6px; padding: 6px;
  scrollbar-width: thin; scrollbar-color: var(--rule-strong) transparent;
}
/* Cards keep their height and the middle scrolls: a card that clips its overflow would otherwise shrink to nothing. */
.middle > * { flex: none; }

/* The footer: the count and Reset all, then light or dark and Copy Proposal */
.footer { position: relative; flex: none; display: flex; flex-direction: column; gap: 10px; margin: 0 6px 6px; padding: 14px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); }
.footer .tally { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 8px; min-height: 24px; }
.footer .count { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; }
.footer .count .n { font: 600 ${size(20)}/1.2 ${SANS}; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; }
.footer .count .word { font: 500 ${size(13)}/1.3846 ${SANS}; color: var(--muted); white-space: nowrap; }
.footer .held-chip { display: inline-flex; align-items: center; gap: 5px; height: 20px; margin-left: 4px; padding: 0 8px 0 7px; border-radius: 999px; background: var(--warn-bg); color: var(--warn-fg); font: 500 ${size(10)}/1.4 ${MONO}; white-space: nowrap; }
.footer .held-chip .dot { width: 6px; height: 6px; background: var(--warn-dot); }
.footer .reset-all { height: 24px; padding: 0 8px 0 6px; gap: 5px; color: var(--muted); }
.footer .act { display: flex; align-items: center; gap: 8px; }
/* Copy Proposal (Copy flow v2 · A): a split button, its main half copying in one click, its chevron opening the details */
.split { flex: 1; min-width: 0; display: flex; align-items: center; height: 40px; overflow: hidden; border-radius: 999px; background: var(--primary); color: var(--on-primary); box-shadow: var(--primary-shadow); transition: background-color 160ms ease-out, color 160ms ease-out; }
.split button { height: 40px; color: inherit; }
.split-main { flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 ${size(13)}/1.3077 ${SANS}; white-space: nowrap; }
.split-rule { flex: none; width: 1px; height: 20px; background: var(--on-primary-rule); }
.split-more { flex: none; display: grid; place-items: center; width: 41px; background: var(--on-primary-wash); }
/* Hover belongs to the ink button: the green and amber states are read, not pressed again. */
@media (hover: hover) { .split[data-state="idle"] .split-main:not(:disabled):hover { background: var(--on-primary-wash); } .split[data-state="idle"] .split-more:not(:disabled):hover { background: var(--on-primary-rule); } }
.split:has(button:disabled) { opacity: 0.45; }
.split button:disabled { opacity: 1; }
.split button:focus-visible { outline-offset: -3px; border-radius: 999px; }
.split[data-state="copied"] { background: var(--copied-bg); color: var(--copied-fg); box-shadow: inset 0 0 0 1px var(--copied-edge); }
.split[data-state="copied"] .split-rule { background: var(--copied-rule); }
.split[data-state="copied"] .split-more { background: none; }
.split[data-state="failed"] { background: var(--warn-bg); color: var(--warn-fg); box-shadow: inset 0 0 0 1px var(--warn-edge); }
.split[data-state="failed"] .split-rule { background: var(--warn-rule); }
.split[data-state="failed"] .split-more { background: var(--warn-wash); }
/* Over the footer, pointing down at what opened it: the chevron, or the button a one-click copy came from. */
.copy-popover { position: absolute; left: 8px; right: 8px; bottom: calc(100% + 10px); z-index: 1; padding: 14px; border-radius: 18px; background: var(--card); box-shadow: var(--popover-shadow); }
.copy-popover .caret { position: absolute; bottom: -11px; right: 16px; }
.copy-popover[data-anchor="copy"] .caret { right: auto; left: calc(50% - 8px); }
.copy-popover .caret .fill { fill: var(--card); }
.copy-popover .caret .edge { fill: none; stroke: var(--popover-edge); }
.copy-popover .details { display: flex; flex-direction: column; gap: 12px; }
.copy-popover .field { display: flex; flex-direction: column; gap: 4px; }
.copy-popover .field > label, .copy-popover .field > span:not(.field-error) { font: 500 ${size(11)}/1.2727 ${SANS}; color: var(--muted); }
.copy-popover .optional { color: var(--faint); }
.copy-popover input { width: 100%; height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--sunk); box-shadow: inset 0 0 0 1px var(--field-edge); color: var(--ink); font: 400 ${size(13)}/1.3846 ${SANS}; outline: none; }
.copy-popover input::placeholder { color: var(--faint); }
.copy-popover input:focus { background: var(--card); box-shadow: inset 0 0 0 1.5px var(--accent), 0 0 0 3px var(--focus-glow); }
.copy-popover input[aria-invalid="true"] { box-shadow: inset 0 0 0 1.5px var(--alert); }
.copy-popover .field-error { font: 400 ${size(12)}/1.4167 ${SANS}; color: var(--warn-fg); }
.copy-popover .btn.primary { width: 100%; }
.not-copied { display: flex; gap: 10px; }
.not-copied .badge { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 12px; background: var(--warn-bg); color: var(--warn-fg); }
.not-copied h3 { padding-top: 1px; font: 600 ${size(13)}/1.3846 ${SANS}; letter-spacing: 0; color: var(--warn-fg); }
.not-copied p { margin-top: 2px; font: 400 ${size(12)}/1.4167 ${SANS}; color: var(--warn-muted); }
.proposal-text { position: relative; height: 130px; margin-top: 15px; overflow: hidden; border-radius: 12px; background: var(--hover); box-shadow: inset 0 0 0 1px var(--popover-edge); }
.proposal-text textarea { display: block; width: 100%; height: 100%; padding: 10px; border: 0; resize: none; background: none; color: var(--ink); font: 400 ${size(10)}/1.5 ${MONO}; white-space: pre-wrap; outline: none; scrollbar-width: thin; }
.proposal-text textarea::selection { background: var(--text-select); }
.proposal-text textarea:focus-visible { box-shadow: inset 0 0 0 1.5px var(--accent); border-radius: 12px; }
/* The text runs on below the fold: it fades rather than stopping at a line. */
.proposal-text::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 32px; pointer-events: none; background: linear-gradient(to bottom, transparent, var(--hover)); }
.popover-actions { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 8px; margin-top: 14px; }
.popover-actions.alone { grid-template-columns: minmax(0, 1fr); }
.popover-actions .btn { height: 40px; font: 500 ${size(13)}/1.3077 ${SANS}; }
.popover-actions .btn.primary { font-weight: 600; }
.copy-toast { position: absolute; left: 8px; right: 8px; bottom: calc(100% + 10px); z-index: 1; display: flex; align-items: flex-start; gap: 10px; min-height: 50px; padding: 8px 12px 9px; border-radius: 14px; background: var(--toast); color: var(--on-toast); box-shadow: inset 0 0 0 1px var(--toast-edge), var(--toast-shadow); animation: loupe-toast-in 180ms ease-out; }
.copy-toast .badge { flex: none; margin-top: 5px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 12px; background: var(--copied-badge); color: var(--on-toast); }
.copy-toast .what { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.copy-toast .line { display: flex; min-width: 0; font: 600 ${size(12)}/1.3333 ${SANS}; white-space: nowrap; }
.copy-toast .copied-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.copy-toast .sub { font: 400 ${size(11)}/1.3636 ${SANS}; color: var(--toast-muted); }
@keyframes loupe-toast-in { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .copy-toast { animation: none; } .split { transition: none; } }
.footer .theme { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 999px; background: var(--sunk); color: var(--primary); box-shadow: inset 0 0 0 1px var(--hairline); transition: background-color 120ms ease-out; }
@media (hover: hover) { .footer .theme:hover { background: var(--sunk-hover); } }
.footer .undo { flex: 1 1 100%; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: ${size(12)}; line-height: 1.4167; color: var(--muted); }
/* Empty, it stays a live region, out of the layout but not out of the accessibility tree. */
.footer .undo:empty { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.footer .undo .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Collapsed (launcher.tsx): a flat dark pill with the L, free, or docked a few px off a side and
   held to it by a liquid neck. Its body is drawn in .goo, where it runs together with the window's edge. */
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
.launcher .mark { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; transform: translate(-50%, -50%); pointer-events: none; }
.launcher .glyph { display: block; }
.launcher.dragging { cursor: grabbing; }
/* After a drop, a dock or a key: it travels to its place, quick out and a soft landing. */
.launcher.settling { transition: translate 260ms cubic-bezier(0.23, 1, 0.32, 1), transform 240ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms ease-out; }
.launcher:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* Where the held pill would dock if let go now: the pill, faint, at its docked place a few px off the side. */
.dock-ghost { position: fixed; left: 0; top: 0; z-index: 2147483646; width: 44px; height: 32px; border-radius: 16px; background: var(--band); opacity: 0; pointer-events: none; transition: opacity 120ms ease-out; }
.dock-ghost.shown { opacity: 0.16; }
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
  .launcher.settling .goo .wall { transition: none; }
  .launcher.leaving[data-edge] { transform: none; opacity: 0; }
  @starting-style { .launcher[data-edge] { transform: none; opacity: 0; } }
}

/* Cards on the sheet */
/* Every card: text 14px from its left edge, 12px above and 14px below. */
.section, .card { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 14px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.head .title { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 500; }
.section.list-card { gap: 4px; padding: 12px 0 6px; overflow: hidden; }
.section.list-card > .head { padding: 0 14px 4px; }

/* Dots: the Override count's, notices amber and alert, held for review in pencil */
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
.dot.small { width: 6px; height: 6px; }
.dot.alert { background: var(--alert); }
.dot.purple { background: var(--revision-line); }
.dot.amber { background: var(--warn-dot); }
.dot.hollow { box-shadow: inset 0 0 0 1.5px var(--rule-strong); }
.dot.ring { width: 10px; height: 10px; border: 1.5px solid var(--held); }

/* Revision deltas: a change's number, as on the page and in the Proposal */
.key { position: relative; display: inline-block; flex: none; width: 22px; height: 20px; }
.key .delta { width: 22px; height: 20px; }
.key .n { position: absolute; inset: 0; display: grid; place-items: end center; padding-bottom: 2.5px; font: 700 ${size(9)}/1 ${SANS}; color: var(--revision-text); font-variant-numeric: tabular-nums; }
.keys { display: inline-flex; gap: 2px; flex: none; }
.delta { display: block; overflow: visible; }
.delta path { fill: var(--card); stroke: var(--revision-line); stroke-width: 1.25; }
.delta.dashed path { stroke-dasharray: 2.2 1.6; }

/* Words for state: a chip for the verdict, tags only on the exceptions */
.status { display: inline-flex; align-items: center; gap: 4px; flex: none; height: 16px; padding: 0 7px 0 6px; border-radius: 999px; background: var(--sunk); font: 500 ${size(10)}/1.4 ${MONO}; color: var(--muted); white-space: nowrap; }
.status.supported { background: var(--ok-bg); color: var(--ok-fg); }
.status.stale { background: var(--warn-bg); color: var(--warn-fg); }
.tag { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 1px 8px; border-radius: 999px; background: var(--sunk); font: 400 ${size(11)}/1.4545 ${SANS}; color: var(--muted); white-space: nowrap; }
.tag.reason { font: 400 ${size(10)}/1.6 ${MONO}; letter-spacing: 0.02em; cursor: help; }
.tag.stale { background: var(--warn-bg); color: var(--warn-fg); }
.tag.held { background: none; box-shadow: inset 0 0 0 1px var(--held); }
.tag.dashed { background: none; outline: 1px dashed var(--rule-strong); outline-offset: -1px; }
.tag.empty { background: none; outline: 1px dashed var(--ink); outline-offset: -1px; color: var(--ink); }
.tag.picked { height: 16px; padding: 0 8px; background: var(--accent-wash); color: var(--accent-text); font: 500 ${size(10)}/1.4 ${MONO}; }
.default { font: 400 ${size(12)}/1.3333 ${SANS}; color: var(--muted); }

/* The Inspector: one card of rows, hairlines between them (Paper, "Inspector as property rows") */
.inspector { gap: 0; padding: 0; overflow: hidden; }
.inspector > * + * { border-top: 1px solid var(--rule); }

/* The identity: back, component and route, the verdict; the name; where it is written; what it is inside */
.identity { display: flex; flex-direction: column; padding: 10px 14px 14px 10px; }
.identity:has(.inside) { padding-bottom: 0; }
.identity > .body { padding: 6px 0 0 4px; }
.back { display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 999px; background: var(--ground); color: var(--ink); transition: background-color 120ms ease-out; }
@media (hover: hover) { .back:hover { background: var(--sunk-hover); } }
.title-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; min-height: 28px; }
.title-line .lead { display: flex; align-items: center; gap: 8px; min-width: 0; }
.title-line .component { min-width: 0; overflow-wrap: break-word; font: 500 ${size(13)}/1.3846 ${SANS}; color: var(--muted); }
.title-line .route { flex: none; margin-left: 1px; }
.title-line .keys { margin-left: auto; }
/* The whole name, however long: the headline is the one place it is read in full. */
.identity .name {
  min-width: 0; margin: 8px 0 0 4px; overflow-wrap: anywhere;
  font: 600 ${size(17)}/1.2941 ${SANS}; letter-spacing: -0.015em; color: var(--ink); text-wrap: balance; outline-offset: 4px;
}
.identity .id { display: flex; align-items: center; gap: 4px; margin: 4px 0 0 4px; font: 400 ${size(11)}/1.6364 ${MONO}; color: var(--muted); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.identity .id .icon { color: var(--faint); }
.identity .id .line { color: var(--line-faint); }
.verdicts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 0 0 4px; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 10px 0 0 4px; }
.identity .warn { margin: 10px 0 0 4px; }
/* Inside: the adapted Instances around it, outermost first, each a step in from the last. */
.inside { position: relative; display: grid; grid-template-columns: 42px minmax(0, 1fr); margin: 10px -14px 0 -10px; padding: 10px 14px 9px; background: var(--hover); }
.inside .inside-label { font: 500 ${size(11)}/1.4545 ${SANS}; letter-spacing: 0.01em; color: var(--faint); padding-top: 2px; }
.inside ol { list-style: none; margin: 0; padding: 0; }
.inside li { display: flex; align-items: flex-start; min-height: 20px; }
.inside .elbow { flex: none; margin: -2px 2px 0 3px; color: var(--tree); }
.inside button { min-height: 20px; font: 400 ${size(12)}/1.6667 ${SANS}; color: var(--faint); text-align: left; overflow-wrap: anywhere; }
.inside li:nth-last-child(2) button { color: var(--tree-ink); }
.inside li:last-child button { color: var(--ink); font-weight: 500; }
@media (hover: hover) { .inside button:hover { text-decoration: underline; text-underline-offset: 3px; } }

/* The scope of Select multiple: who it reaches, how far the page goes, and the Instances it lists */
.scope { display: flex; flex-direction: column; gap: 6px; padding: 14px; }
.scope .scope-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
.scope .scope-title .lead { display: flex; align-items: center; gap: 8px; min-width: 0; }
.scope h3 { min-width: 0; overflow-wrap: anywhere; font: 500 ${size(14)}/1.2857 ${SANS}; letter-spacing: -0.01em; }
.meter { display: flex; flex: none; gap: 4px; }
.meter i { flex: none; width: 8px; height: 8px; border-radius: 4px; box-shadow: inset 0 0 0 1.25px var(--rule-strong); }
.meter i.in { background: var(--accent); box-shadow: none; }
.scope .reach { margin-left: 28px; font: 400 ${size(11)}/1.2727 ${SANS}; color: var(--faint); }
.scope .reach b { font-weight: 600; color: var(--ink); }
.scope .scope-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; margin: 4px 0 0 28px; }
.widen { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px 0 9px; border-radius: 999px; background: var(--link-wash); box-shadow: inset 0 0 0 1px var(--link-edge); color: var(--link); font: 500 ${size(12)}/1.3333 ${SANS}; white-space: nowrap; }
@media (hover: hover) { .widen:hover { background: var(--link-edge); } }
.scope .count-toggle { display: inline-flex; align-items: center; gap: 2px; min-height: 28px; margin-left: auto; font: 500 ${size(12)}/1.3333 ${SANS}; color: var(--ink); }
.scope .count-toggle .icon { color: var(--muted); transition: transform 160ms ease-out; }
.scope .count-toggle[aria-expanded="true"] .icon { transform: rotate(90deg); }
.selection { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding-top: 10px; font-size: ${size(12)}; line-height: 1.4167; }

/* The scope's Instances, opened: a box to leave each one out */
.members { display: flex; flex-direction: column; padding: 12px 0 10px; background: var(--hover); }
.members[hidden] { display: none; }
.members .hint { padding: 0 14px 8px; font: 400 ${size(11)}/1.2727 ${SANS}; color: var(--faint); }
.members .list > li, .members legend > label { display: flex; align-items: center; gap: 12px; min-height: 32px; padding: 0 14px; }
.members label { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; cursor: pointer; }
.members .who { flex: 1; min-width: 0; }
.members .who .screen-name, .members legend .screen-name { min-width: 0; white-space: normal; overflow-wrap: anywhere; font: 400 ${size(13)}/1.3846 ${SANS}; color: var(--ink); }
.members .who.picked .screen-name { font-weight: 500; }
.members .server-name { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--muted); }
.members input[type="checkbox"] { appearance: none; flex: none; width: 16px; height: 16px; margin: 0; border: 1.5px solid var(--field-edge); border-radius: 5px; display: grid; place-content: center; cursor: pointer; }
.members input[type="checkbox"]:checked { border-color: var(--accent); background: var(--accent); }
.members input[type="checkbox"]:checked::after { content: ""; width: 8px; height: 4px; margin-top: -2px; border: solid var(--on-check); border-width: 0 0 2px 2px; transform: rotate(-45deg); }
.members input:disabled { opacity: 0.45; cursor: default; }
fieldset.site { border: 0; padding: 0; margin: 0; }
fieldset.site legend { width: 100%; padding: 0; }
fieldset.site .list > li { padding-left: 42px; }
.reset-scope { align-self: flex-start; margin: 6px 0 0 14px; }

/* Notices: the Product layer's, Overrides off, and an Instance's note */
.notice-card { gap: 8px; }
.notice-card .title { font-size: ${size(13)}; line-height: 1.3846; }
.notice-card ul { list-style: none; margin: 0; padding: 0; }
.notice-card li { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-top: 1px solid var(--rule); font-size: ${size(13)}; }
.notice-card li .mono { color: var(--muted); }
.command { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 38px; padding: 4px 4px 4px 12px; border-radius: 12px; background: var(--well); font: 400 ${size(12)}/1.3333 ${MONO}; color: var(--ink); }
.command .btn { height: 28px; padding: 0 10px; background: var(--card); }
.command-refused { font-size: ${size(12)}; line-height: 1.4167; }
.command-refused:not(:empty) { margin-top: 6px; }
.note-card { display: flex; flex-direction: row; gap: 10px; padding: 12px 14px; }
.note-card .icon { margin-top: 2px; color: var(--muted); }
.note-card .text { display: flex; flex-direction: column; gap: 4px; }
.notice { padding: 10px 12px; border-radius: 12px; background: var(--well); font: 400 ${size(12)}/1.5 ${SANS}; }
.notice code { font-family: ${MONO}; font-weight: 600; color: var(--ink); }
.notice .btn { margin-top: 8px; background: var(--card); }
.warn { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--warn-bg); color: var(--warn-fg); font: 400 ${size(12)}/1.4167 ${SANS}; }
.warn .dot { width: 8px; height: 8px; margin-top: 5px; background: var(--warn-dot); }

/* The change list: each change by its delta */
.section.changes { gap: 6px; padding: 12px 0 6px; overflow: hidden; }
.section.changes > .head { padding: 0 14px 4px; }
.keylist { list-style: none; margin: 0; padding: 0; }
.keylist button {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "key what" "key where"; column-gap: 10px;
  width: 100%; padding: 8px 14px; border-top: 1px solid var(--rule); text-align: left;
}
@media (hover: hover) { .keylist button:not(:disabled):hover { background: var(--hover); } }
.keylist .key { grid-area: key; align-self: start; margin-top: 0; }
.keylist .what { grid-area: what; font: 400 ${size(12)}/1.5 ${MONO}; overflow-wrap: anywhere; }
.keylist .where { grid-area: where; min-width: 0; overflow-wrap: break-word; color: var(--muted); font-size: ${size(12)}; line-height: 1.3333; }

/* A property row: its glyph, its name and what qualifies it, then its chips under the name */
/* Each row sits under a 1px hairline: 14px of padding puts its glyph 15px down, as Paper draws it. */
.prop { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr); column-gap: 8px; padding: 14px 14px 13px; }
.prop > .glyph { grid-row: 1 / span 9; padding-top: 0; color: var(--ink); }
.prop > .row { grid-column: 2; }
.prop.switch-row { padding-bottom: 14px; }
.prop.switch-row > .glyph { padding-top: 1px; }
.prop.switch-row .row.switch .line { min-height: 22px; }
.row { display: flex; flex-direction: column; gap: 13px; }
/* The head and the lines that qualify it sit tight; the control sits apart. */
.row .head-group { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.row .line { display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; min-height: 20px; flex-shrink: 0; }
.row .key { margin: -1px -2px -1px -3px; }
.row .name { flex: none; display: flex; align-items: baseline; gap: 6px; max-width: 100%; font: 500 ${size(14)}/1.2857 ${SANS}; letter-spacing: -0.01em; }
.row .name .mono { font-size: ${size(11)}; color: var(--faint); letter-spacing: 0; }
.row .value { flex: 1; min-width: 0; text-align: right; font: 400 ${size(11)}/1.2727 ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.row .value .muted, .row .value .default { font: inherit; }
/* Counts quote values, so they are never recased: "outline" 1 · "ghost" 3. */
.row .value.counts { font: 400 ${size(11)}/1.2727 ${MONO}; letter-spacing: 0; color: var(--muted); font-variant-numeric: tabular-nums; }
.row .reset { margin-left: auto; }
.row .value ~ .reset { margin-left: 0; }
.row .change { font: 400 ${size(11)}/1.4545 ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.row .change .arrow { color: var(--faint); font-family: ${SANS}; }
.row .change .to { color: var(--ink); font-weight: 600; }
.row .change .from-scope { font-family: ${SANS}; color: var(--muted); }
.row .current { font: 400 ${size(12)}/1.3333 ${MONO}; color: var(--ink); }
.row .current .meta { font-family: ${SANS}; margin-right: 4px; }
.row .explain { font: 400 ${size(12)}/1.4167 ${SANS}; color: var(--muted); }
.row .refusal { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: ${size(12)}; line-height: 1.4167; }
.row .keeping { align-self: flex-start; min-height: 24px; font: 500 ${size(12)}/1.3333 ${SANS}; color: var(--link); text-decoration: underline; text-decoration-color: var(--link-edge); text-underline-offset: 3px; }
@media (hover: hover) { .row .keeping:hover { text-decoration-color: currentColor; } }

/* The options: chips that wrap; what shows now in salmon with its count, the app's value ringed, the default dotted */
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pills button {
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 0; min-height: 26px; padding: 4px 10px;
  border-radius: 8px; background: var(--sunk); box-shadow: inset 0 0 0 1px var(--hairline); color: var(--muted); font: 400 ${size(12)}/1.3333 ${SANS}; text-align: center;
  transition: background-color 120ms ease-out, color 120ms ease-out;
}
@media (hover: hover) { .pills button:not([aria-pressed="true"]):not([aria-checked="true"]):not(:disabled):hover { background: var(--sunk-hover); color: var(--ink); } }
.pills button[aria-pressed="true"], .pills button[aria-checked="true"] { background: var(--shown); color: var(--on-shown); font-weight: 500; box-shadow: inset 0 0 0 1px var(--shown-edge); }
.pills button:focus-visible { outline-offset: 1px; }
/* A long value wraps in its chip rather than losing its end: it is what the designer picks between. */
.pills .opt { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.pills .app { box-shadow: inset 0 0 0 1px var(--field-edge); color: var(--ink); }
.pills .app-tag { flex: none; font: 500 ${size(10)}/1.4 ${MONO}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--faint); }
.pills .is-default::after { content: ""; flex: none; order: 2; width: 4px; height: 4px; border-radius: 2px; background: var(--faint); }
.pills .count { flex: none; order: 3; font: 500 ${size(10)}/1.4 ${MONO}; font-variant-numeric: tabular-nums; color: var(--faint); }
.pills button[aria-pressed="true"] .count, .pills button[aria-checked="true"] .count { color: inherit; }
.row .text { width: 100%; min-height: 36px; padding: 8px 12px; resize: none; overflow: hidden; border: 1px solid var(--field-edge); border-radius: 12px; background: var(--card); color: var(--ink); font: 400 ${size(13)}/1.3846 ${SANS}; outline: none; }
.row .text:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-glow); }
.row.overridden .text { border-color: var(--shown-edge); }
/* What the chips' marks mean, said once on a row of its own. */
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; min-height: 34px; padding: 10px 14px 10px 42px; font: 400 ${size(11)}/1.2727 ${SANS}; color: var(--faint); }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.legend i { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.legend .shown { background: var(--shown); }
.legend .app { box-shadow: inset 0 0 0 1px var(--field-edge); }
.legend .is-default { width: 4px; height: 4px; margin: 0 2px 0 4px; border-radius: 2px; background: var(--faint); }

/* True or false: a row with its switch at the right edge */
.row.switch .line { min-height: 20px; flex-wrap: nowrap; }
.row.switch .name { min-width: 0; flex: 0 1 auto; }
.toggle { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
/* A pill on a taupe edge; the thumb is the filled half it sits in, a round hole through it: taupe on the left off, teal on the right on. Each at 3:1 on the card. */
.switch-track { position: relative; flex: none; width: 42px; height: 22px; overflow: hidden; border-radius: 999px; background: var(--card); box-shadow: inset 0 0 0 1.5px var(--switch-off); }
.switch-track .thumb { position: absolute; inset: 0 auto 0 0; width: 50%; border-radius: 11px 0 0 11px; background: var(--switch-off); transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), border-radius 180ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 160ms ease-out; }
.switch-track .thumb::after { content: ""; position: absolute; inset: 0; width: 16px; height: 16px; margin: auto; border-radius: 50%; background: var(--card); }
.switch-track[aria-checked="true"] .thumb { transform: translateX(calc(100% + 6px)); border-radius: 0 11px 11px 0; background: var(--switch-on); }
/* Under reduced motion the thumb and the chevrons still move to their place, without travelling there. */
@media (prefers-reduced-motion: reduce) {
  .switch-track, .switch-track .thumb, .inspect summary .icon, .group summary > .icon, .scope .count-toggle .icon, .flags .off summary .icon { transition: none; }
}

/* Inspect only: the props this Instance shows but can't change here, folded to one row */
.inspect { overflow: hidden; }
.inspect > details > summary { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto 16px; align-items: center; column-gap: 8px; min-height: 44px; padding: 12px 14px; cursor: pointer; list-style: none; }
@media (hover: hover) { .inspect > details > summary:hover { background: var(--hover); } }
.inspect summary::-webkit-details-marker { display: none; }
.inspect summary > .glyph { color: var(--ink); }
.inspect summary > .icon:last-child { color: var(--muted); transition: transform 160ms ease-out; }
.inspect .summary-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 ${size(14)}/1.2857 ${SANS}; letter-spacing: -0.01em; }
.inspect .summary-text .muted { font-size: ${size(12)}; letter-spacing: 0; }
.inspect details[open] > summary > .icon:last-child { transform: rotate(90deg); }
.inspect .why { padding: 0 14px 8px 42px; font: 400 ${size(12)}/1.4167 ${SANS}; color: var(--muted); }
.inspect-rows { display: flex; flex-direction: column; padding: 0 14px 8px 42px; }
.inspect .row { gap: 2px; padding: 6px 0; border-top: 1px solid var(--rule); }
.inspect .row .line { display: grid; grid-template-columns: minmax(96px, 38%) minmax(0, 1fr) auto; align-items: baseline; min-height: 24px; gap: 8px; }
.inspect .row .name { min-width: 0; font: 400 ${size(12)}/1.5 ${MONO}; letter-spacing: 0; color: var(--muted); overflow-wrap: normal; word-break: normal; }
.inspect .row .name .mono { display: none; }
.inspect .row .value { text-align: left; color: var(--ink); font-size: ${size(12)}; }
.inspect .injected { padding: 0 14px 12px 42px; }
.inspect .injected summary { display: flex; align-items: center; gap: 6px; min-height: 28px; color: var(--muted); font-size: ${size(12)}; cursor: pointer; list-style: none; }
.inspect .injected[open] summary .icon { transform: rotate(90deg); }

/* On this page (Rows option B): the page map over its usage rows, most used first */
.list { list-style: none; margin: 0; padding: 0; }
.on-page { gap: 0; padding: 14px 0 0; overflow: hidden; }
.on-page > .head { align-items: center; padding: 0 14px; }
.on-page > .head h3 { font: 500 ${size(14)}/1.2857 ${SANS}; }
.on-page .list { padding-bottom: 0; }
.group > details > summary { list-style: none; cursor: pointer; }
.group > details > summary::-webkit-details-marker { display: none; }
.group { position: relative; }
.group summary {
  display: grid; grid-template-columns: minmax(0, 1fr) 40px 30px; grid-template-areas: "name n go" "bar n go" "sub sub sub";
  align-items: start; min-height: 44px; padding: 6px 12px 10px 14px;
}
.group details[open] { background: var(--hover); }
.group details[open]::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 3px; border-radius: 0 2px 2px 0; background: var(--hue); }
@media (hover: hover) { .group summary:hover { background: var(--hover); } }
.group summary .cname { grid-area: name; display: flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: break-word; font: 500 ${size(13)}/1.3846 ${SANS}; }
.group summary .cname .icon { color: var(--muted); }
.group summary .bar { grid-area: bar; position: relative; height: 4px; margin-top: 6px; border-radius: 2px; background: var(--rule); }
.group summary .bar i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--hue); }
.group.inspect-only summary .bar i { opacity: 0.55; }
.group details[open] > summary .bar { height: 6px; margin-top: 5px; border-radius: 3px; }
.group summary .times { grid-area: n; margin-top: 6px; text-align: right; font: 600 ${size(13)}/1.3846 ${MONO}; font-variant-numeric: tabular-nums; color: var(--ink); }
.group summary > .icon { grid-area: go; justify-self: end; margin-top: 8px; color: var(--icon-faint); transition: transform 160ms ease-out; }
.group details[open] > summary > .icon { transform: rotate(90deg); color: var(--ink); }
.group summary .sub { grid-area: sub; font-variant-numeric: tabular-nums; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; margin-top: 6px; color: var(--muted); font-size: ${size(12)}; line-height: 1.3333; }
.group summary .sub:empty { display: none; }
.group summary .sub span { display: inline-flex; align-items: center; gap: 6px; }
.group summary .sub .changed { color: var(--ink); font-weight: 500; }
.group summary .sub .stale { color: var(--warn-fg); }
.group .sites { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px 12px; }
.group .sites-head { font: 400 ${size(11)}/1.2727 ${SANS}; color: var(--faint); padding-bottom: 2px; }
.site-card { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto 16px; align-items: center; column-gap: 8px; min-height: 52px; padding: 8px 10px 8px 12px; border-radius: 12px; background: var(--card); box-shadow: var(--site-shadow); }
.site-card > .open { position: absolute; inset: 0; border-radius: inherit; }
.site-card > .open:focus-visible { outline-offset: -2px; }
@media (hover: hover) { .site-card:has(> .open:hover) { box-shadow: var(--raised-shadow); } }
.site-card .where { display: flex; flex-direction: column; min-width: 0; pointer-events: none; }
.site-card .file { font: 600 ${size(11)}/1.4545 ${MONO}; color: var(--ink); overflow-wrap: anywhere; }
.site-card .names { display: flex; align-items: center; gap: 4px; min-width: 0; font: 400 ${size(12)}/1.3333 ${SANS}; color: var(--muted); }
.site-card .names > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site-card .dots { position: relative; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 3px; max-width: 74px; }
.site-card .dots button { position: relative; width: 8px; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--hue) 22%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hue) 90%, transparent); }
/* Each dot an Instance: a larger target than it looks. */
.site-card .dots button::before { content: ""; position: absolute; inset: -6px -2px; }
.site-card > .icon { color: var(--icon-faint); pointer-events: none; }
.group .unmounted { display: flex; flex-direction: column; gap: 2px; padding: 0 14px 12px; }
.group .unmounted li { display: flex; flex-direction: column; }
.group .unmounted button { display: flex; align-items: flex-start; gap: 8px; width: 100%; min-height: 32px; padding: 6px 0; text-align: left; }
.group summary:focus-visible, .keylist button:focus-visible, .inspect > details > summary:focus-visible { outline-offset: -2px; }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.who .screen-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who .site { font: 400 ${size(11)}/1.4545 ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.who.out .screen-name, .who.out .site { color: var(--faint); text-decoration: line-through; }
.held-values { padding: 0 0 6px; font: 400 ${size(11)}/1.4545 ${MONO}; color: var(--muted); }
.interaction li { display: flex; flex-direction: column; gap: 2px; padding: 8px 14px; border-top: 1px solid var(--rule); }
.interaction .muted { font-size: ${size(12)}; line-height: 1.4167; }

/* Held for review: in pencil, applying to nothing */
.held-list { display: flex; flex-direction: column; }
.held-item { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; border-top: 1px solid var(--rule); }
.held-item .target { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: 400 ${size(12)}/1.3333 ${MONO}; }
.held-item .muted { font-size: ${size(12)}; line-height: 1.4167; }

/* Feature flags */
.flags { gap: 10px; }
.flag { gap: 8px; padding: 10px 0; border-top: 1px solid var(--rule); }
.flag .line { min-height: 28px; }
.flag .name { font: 500 ${size(12)}/1.3333 ${MONO}; }
.flag .pills { flex-wrap: nowrap; }
.flag .pills button { flex: 1; }
.flag .foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.flag .state { margin-left: auto; font: 400 ${size(11)}/1.2727 ${SANS}; color: var(--muted); white-space: nowrap; padding-bottom: 6px; }
.flag.overridden .state { color: var(--ink); }
.flags .lasts { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--rule); color: var(--muted); font-size: ${size(12)}; line-height: 1.4167; }
.flags .lasts .icon { margin-top: 1px; }
.flags .clear { align-self: flex-start; }
.flags .off { display: flex; flex-direction: column; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--well); }
.flags .off summary { display: flex; align-items: center; gap: 8px; min-height: 24px; cursor: pointer; list-style: none; font-weight: 500; }
.flags .off summary::-webkit-details-marker { display: none; }
.flags .off > .muted { line-height: 1.4615; }
.flags .off summary .icon { margin-left: auto; color: var(--muted); transition: transform 160ms ease-out; }
.flags .off[open] summary .icon { transform: rotate(90deg); }

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

/* iOS Safari zooms the page into any field under 16px: on a touch screen they are 16px. */
@media (pointer: coarse) {
  .row .text, .copy-popover input { font-size: max(16px, ${size(16)}); line-height: 1.375; }
}

/* The page map: every component a tinted block where it sits, one hue each, fit into a dotted well; each row is its legend. */
${MAP_HUES.map((hue, index) => `.hue-${index} { --hue: ${hue}; }`).join(" ")}
.map-sheet { position: relative; height: 108px; margin: 12px 14px 8px; border-radius: 12px; background-color: var(--hover); background-image: radial-gradient(circle at 6px 6px, var(--map-dot) 0.7px, transparent 1.2px); background-size: 12px 12px; box-shadow: inset 0 0 0 1px var(--hairline); overflow: hidden; container-type: size; }
/* The page's own shape, as large as the well lets it be, centred. */
.map-sheet .fit { position: absolute; inset: 0; margin: auto; width: min(100cqw - 16px, (100cqh - 16px) * var(--ratio)); height: min(100cqh - 16px, (100cqw - 16px) / var(--ratio)); }
.map-sheet .blk { position: absolute; min-width: 5px; min-height: 5px; padding: 0; border-radius: 4px; background: color-mix(in srgb, var(--hue) 18%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hue) 75%, transparent); transition: opacity 140ms ease-out, background-color 140ms ease-out, box-shadow 140ms ease-out; }
.map-sheet[data-lit] .blk { opacity: 0.22; }
.map-sheet[data-lit] .blk.lit { opacity: 1; background: color-mix(in srgb, var(--hue) 30%, transparent); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hue) 95%, transparent); }
.group.lit > details > summary { background: var(--hover); }

/* The list's start (guided start): what to change, and the two select tools as tiles that show what each does */
.hero { gap: 0; padding: 16px 14px 14px; }
.hero .hero-title { font-size: ${size(20)}; line-height: 1.3; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.hero .hero-title:focus { outline: none; }
.hero .body { margin-top: 6px; line-height: 1.4615; }
.hero-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
.big-tool { display: flex; flex-direction: column; align-items: stretch; padding: 4px 4px 12px; border-radius: 14px; background: var(--card); color: var(--ink); text-align: left; box-shadow: var(--tile-shadow); transition: box-shadow 120ms ease-out; }
@media (hover: hover) { .big-tool:hover { box-shadow: var(--raised-shadow); } }
.big-tool.armed { box-shadow: inset 0 0 0 1.5px var(--accent), var(--raised-shadow); }
.big-tool .preview { position: relative; display: flex; align-items: center; justify-content: center; gap: 12px; height: 56px; border-radius: 10px; background: var(--sunk); overflow: hidden; }
.big-tool .preview .chip { position: relative; width: 28px; height: 16px; border-radius: 5px; background: var(--card); box-shadow: 0 0 0 1px var(--divider), 0 1px 1px var(--hairline); }
.big-tool .preview .chip.ringed::after, .big-tool .preview .chip.dashed::after { content: ""; position: absolute; inset: -3px; border: 1.5px solid var(--accent); border-radius: 8px; }
.big-tool .preview .chip.dashed::after { border-style: dashed; }
.big-tool .preview .pointer { position: absolute; left: calc(50% + 8px); top: 32px; width: 14px; height: 14px; }
.big-tool .preview .pointer path { fill: var(--card); stroke: var(--primary); stroke-width: 2.5; stroke-linejoin: round; }
.big-tool .t { margin: 10px 8px 0; font: 600 ${size(13)}/1.3846 ${SANS}; }
.big-tool .h { margin: 2px 8px 0; font: 400 ${size(11)}/1.3636 ${SANS}; color: var(--faint); }
/* Forced colours (Windows High Contrast) drop backgrounds and box-shadows: draw edges and states in system colours. */
@media (forced-colors: active) {
  .panel, .copy-popover, .section, .card, .footer, .header { border: 1px solid transparent; }
  .launcher { forced-color-adjust: none; color: ButtonFace; filter: none; }
  .launcher .goo rect { fill: ButtonText; }
  .launcher:focus-visible { outline-color: Highlight; }
  .dock-ghost { forced-color-adjust: none; background: ButtonText; }
  .pills button[aria-pressed="true"], .pills button[aria-checked="true"] { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  .pills .app { outline: 1px dashed CanvasText; outline-offset: -4px; }
  .pills .is-default::after, .legend i { forced-color-adjust: none; background: CanvasText; }
  .switch-track { forced-color-adjust: none; background: Canvas; box-shadow: inset 0 0 0 1.5px ButtonText; }
  .switch-track .thumb { forced-color-adjust: none; background: ButtonText; }
  .switch-track .thumb::after { forced-color-adjust: none; background: Canvas; }
  .switch-track[aria-checked="true"] .thumb { background: Highlight; }
  .members input[type="checkbox"]:checked { forced-color-adjust: none; background: Highlight; border-color: Highlight; }
  .members input[type="checkbox"]:checked::after { border-color: HighlightText; }
  .dot:not(.hollow):not(.ring):not(.none), .meter i.in { forced-color-adjust: none; background: CanvasText; }
}
`;
