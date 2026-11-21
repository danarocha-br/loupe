// The Toolbar's look: the Revision Set (2026-11-20, from the Paper exploration "A ·
// Revision Set"), after the Grading Report of the 2026-11-19 critique. A warm sheet
// in the column the page makes room for, an ink band on top, and white cards on the
// sheet: one per prop, each a table of options with the chosen one in lilac. Changes
// carry a numbered delta on their row and in the Proposal; on the page, plain
// outlines (2026-11-20) mark the selection and, for a moment, what a change reached.
// It lives in the Toolbar's shadow root, so the app's CSS
// can't reach it and none of it reaches the app. Every colour is a token on the host,
// light by default and dark under `data-loupe-theme="dark"`, set from the OS
// preference or the header's toggle. System faces only: a shadow root can't load a
// web font.

export const HOST_ATTRIBUTE = "data-loupe-toolbar";

/** On the host: `light` or `dark`. Loupe's own name, so an app's `[data-theme]` CSS never matches it. */
export const THEME_ATTRIBUTE = "data-loupe-theme";

/** Where the reader's choice of light or dark is kept; absent, the OS preference decides. */
export const THEME_KEY = "loupe:theme";

type Tokens = Record<string, string>;


const LIGHT: Tokens = {
  sheet: "#F6F3EF",
  card: "#FFFFFF",
  sunk: "#F1F3F3",
  "sunk-hover": "#E5E8E8",
  hover: "#F8F7F4",
  ink: "#0A0A0A",
  "on-ink": "#FFFFFF",
  muted: "#5E5E5E",
  faint: "#737373",
  rule: "#E4E4E4",
  "rule-soft": "#F0F0EE",
  "rule-strong": "#C9C5BE",
  edge: "rgba(27, 34, 32, 0.07)",
  band: "#1B2220",
  "on-band": "#F0F0F0",
  "band-muted": "#9A9A9A",
  "band-hover": "rgba(246, 243, 239, 0.1)",
  "band-pressed": "rgba(246, 243, 239, 0.16)",
  lilac: "#CCCDFF",
  "on-lilac": "#0A0A0A",
  "lilac-line": "#8276CF",
  "lilac-ink": "#4F43B8",
  "ok-bg": "#DFF7E4",
  "ok-fg": "#14532D",
  "switch-off": "#EBE7E0",
  "switch-on": "#27917E",
  primary: "#1B2220",
  "on-primary": "#FFFFFF",
  pencil: "#8E959C",
  alert: "#C2570C",
  "amber-fg": "#7A4B00",
  "amber-bg": "#FFF3DC",
  "amber-dot": "#C98A12",
  select: "rgba(130, 118, 207, 0.28)",
  shadow: "0 1px 2px rgba(27, 34, 32, 0.05), 0 8px 24px rgba(27, 34, 32, 0.07)",
  "overlay-shadow": "0 12px 36px rgba(27, 34, 32, 0.22), 0 2px 6px rgba(27, 34, 32, 0.1)",
  "dialog-shadow": "0 24px 64px rgba(27, 34, 32, 0.22)",
};

const DARK: Tokens = {
  sheet: "#0E1110",
  card: "#181C1B",
  sunk: "#242928",
  "sunk-hover": "#2E3432",
  hover: "#1F2423",
  ink: "#ECEDEA",
  "on-ink": "#0E1110",
  muted: "#A4AAA7",
  faint: "#8B918E",
  rule: "#2C3230",
  "rule-soft": "#232827",
  "rule-strong": "#4A514E",
  edge: "rgba(255, 255, 255, 0.06)",
  band: "#29322F",
  "on-band": "#F0F0F0",
  "band-muted": "#A3AAA7",
  "band-hover": "rgba(246, 243, 239, 0.09)",
  "band-pressed": "rgba(246, 243, 239, 0.15)",
  lilac: "#3A3884",
  "on-lilac": "#F1F0FF",
  "lilac-line": "#A99FF2",
  "lilac-ink": "#BDB5FF",
  "ok-bg": "#143A25",
  "ok-fg": "#93E2AC",
  "switch-off": "#353B39",
  "switch-on": "#2FA58F",
  primary: "#F6F3EF",
  "on-primary": "#1B2220",
  pencil: "#6B737C",
  alert: "#F0904A",
  "amber-fg": "#E5B567",
  "amber-bg": "#2A2109",
  "amber-dot": "#D9963B",
  select: "rgba(169, 159, 242, 0.32)",
  shadow: "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.35)",
  "overlay-shadow": "0 12px 36px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3)",
  "dialog-shadow": "0 24px 64px rgba(0, 0, 0, 0.6)",
};

const declare = (tokens: Tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(" ");

const SANS = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`;

/** The page's marks don't follow the panel's theme: they sit on the app, in its light. */
const PAGE = { line: "#8276CF", ink: "#4F43B8", fill: "rgba(204, 205, 255, 0.34)", band: "#1B2220" };

export const CSS = `
:host { all: initial; ${declare(LIGHT)} color-scheme: light; }
:host([data-loupe-theme="dark"]) { ${declare(DARK)} color-scheme: dark; }
* { box-sizing: border-box; }
::selection { background: var(--select); }
.icon { display: block; flex: none; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* Text */
.panel, .show-tab, .dialog {
  font: 400 13px/18px ${SANS}; color: var(--ink);
  -webkit-font-smoothing: antialiased; font-synthesis: none;
}
.panel, .dialog { overflow-wrap: break-word; }
.mono { font-family: ${MONO}; font-weight: 400; font-size: 12px; }
.verbatim { white-space: pre-wrap; }
.muted { color: var(--muted); font-weight: 400; }
.meta { font: 400 11px/14px ${SANS}; color: var(--faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.label { font: 500 11px/14px ${SANS}; color: var(--muted); }
.body { font: 400 13px/19px ${SANS}; color: var(--muted); margin: 0; }
p { margin: 0; }
h2, h3 { margin: 0; }
h3 { font: 500 14px/18px ${SANS}; letter-spacing: -0.01em; color: var(--ink); }
kbd { font: 500 11px/14px ${MONO}; padding: 1px 5px; border-radius: 5px; background: rgba(10, 10, 10, 0.08); }

/* Controls: soft pills, the ink primary, the band's round tools */
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
button:disabled { cursor: default; opacity: 0.45; }
:focus-visible { outline: 2px solid var(--lilac-line); outline-offset: 2px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 12px;
  border-radius: 999px; background: var(--sunk); color: var(--ink); font: 500 12px/16px ${SANS}; white-space: nowrap;
  transition: background-color 120ms ease-out;
}
.btn.small { height: 26px; padding: 0 11px; gap: 5px; }
.btn.icon, .btn.round { width: 30px; padding: 0; }
.btn.small.round { width: 26px; }
.btn:not(:disabled):hover { background: var(--sunk-hover); }
.btn.primary { height: 40px; padding: 0 18px 0 16px; gap: 8px; background: var(--primary); color: var(--on-primary); font-size: 13px; font-weight: 600; }
.btn.primary:not(:disabled):hover { background: var(--primary); filter: brightness(1.3); }
:host([data-loupe-theme="dark"]) .btn.primary:not(:disabled):hover { filter: brightness(0.92); }
.btn.holding { background: var(--lilac); color: var(--on-lilac); }
.link { font: 600 12px/16px ${SANS}; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; min-height: 24px; }
.tool { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 999px; color: var(--on-band); transition: background-color 120ms ease-out, color 120ms ease-out; }
.tool:not(:disabled):hover { background: var(--band-hover); }
.tool:focus-visible { outline-color: var(--on-band); }

/* The panel: a sheet in the column the page makes room for (dock.ts) */
.panel {
  position: fixed; top: 8px; right: 8px; bottom: 8px; z-index: 2147483647; width: 344px;
  display: flex; flex-direction: column; overflow: hidden; background: var(--sheet);
  border-radius: 24px; box-shadow: 0 0 0 1px var(--edge), var(--shadow); transition: opacity 120ms ease-out;
}
.panel.overlay { box-shadow: 0 0 0 1px var(--edge), var(--overlay-shadow); }
/* Alt held: see through to what runs under the column, such as an app's own dialog. */
.panel.peek { opacity: 0.08; pointer-events: none; }
.header { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 48px; padding: 0 9px 0 18px; background: var(--band); color: var(--on-band); }
.header .brand { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.wordmark { font: 600 14px/20px ${SANS}; letter-spacing: -0.01em; color: var(--on-band); }
.report { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 10px/14px ${MONO}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--band-muted); font-variant-numeric: tabular-nums; }
.tools { flex: none; display: flex; align-items: center; gap: 2px; }
.select-tools { display: flex; gap: 2px; margin-right: 6px; padding: 2px; border-radius: 999px; background: rgba(246, 243, 239, 0.05); }
.select-tools .tool[aria-pressed="true"] { background: var(--band-pressed); }
.select-tools .tool.armed, .select-tools .tool.armed:hover { background: var(--sheet); color: var(--band); }
.tool[data-marks][aria-pressed="true"] { background: var(--band-pressed); }
.status-line { flex: none; margin: 6px 6px 0; padding: 8px 12px; border-radius: 14px; background: var(--lilac); color: var(--on-lilac); font-size: 12px; line-height: 16px; }
.status-line .dot { display: inline-block; width: 8px; height: 8px; margin-right: 8px; vertical-align: 0; }
.middle {
  flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 6px;
  scrollbar-width: thin; scrollbar-color: var(--rule-strong) transparent;
}
.footer { flex: none; display: flex; flex-direction: column; gap: 10px; margin: 0 6px 6px; padding: 12px 10px 10px 14px; border-radius: 18px; background: var(--card); }
.footer .tally { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-height: 30px; }
.footer .count { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; font: 500 14px/18px ${SANS}; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.footer .count .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.footer .act { display: flex; align-items: center; gap: 6px; }
.footer .act [data-copy] { margin-left: auto; }
.footer .undo { flex: 1 1 100%; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 16px; color: var(--muted); }
.footer .undo:empty { display: none; }
.footer-keys { flex: none; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 0; list-style: none; margin: 0 0 0 auto; padding: 0; }
.footer-keys button { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; }
.footer-keys button:not(:disabled):hover { background: var(--sunk); }
.footer-keys .more { font-size: 12px; color: var(--muted); padding-left: 4px; }
.footer .undo .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.show-tab {
  position: fixed; right: 12px; bottom: 12px; z-index: 2147483647; display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 16px 0 12px; border-radius: 999px; background: var(--band); color: var(--on-band);
  box-shadow: var(--overlay-shadow); font-weight: 600;
}
.show-tab:hover { filter: brightness(1.2); }

/* Cards on the sheet */
.section, .card { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 14px; border-radius: 18px; background: var(--card); }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.head .title { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 500; }
.section.list-card { gap: 4px; padding: 12px 0 6px; overflow: hidden; }
.section.list-card > .head { padding: 0 14px 4px; }

/* Dots: the Override count's lilac, notices amber and alert, held for review in pencil */
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
.dot.small { width: 6px; height: 6px; }
.dot.alert { background: var(--alert); }
.dot.override, .dot.purple { background: var(--lilac-line); }
.dot.amber { background: var(--amber-dot); }
.dot.none { background: var(--rule); }
.dot.hollow { box-shadow: inset 0 0 0 1.5px var(--rule-strong); }
.dot.ring { width: 10px; height: 10px; border: 1.5px solid var(--pencil); }

/* Revision deltas: a change's number, as on the page and in the Proposal */
.key { position: relative; display: inline-block; flex: none; width: 22px; height: 20px; }
.key .delta { width: 22px; height: 20px; }
.key .n { position: absolute; inset: 0; display: grid; place-items: end center; padding-bottom: 2.5px; font: 700 9px/1 ${SANS}; color: var(--lilac-ink); font-variant-numeric: tabular-nums; }
.keys { display: inline-flex; gap: 2px; flex: none; }
.delta { display: block; overflow: visible; }
.delta path { fill: var(--card); stroke: var(--lilac-line); stroke-width: 1.25; }
.delta text { font: 700 7.5px ${SANS}; fill: var(--lilac-ink); font-variant-numeric: tabular-nums; }
.delta.dashed path { stroke-dasharray: 2.2 1.6; }

/* Words for state: a chip for the verdict, tags only on the exceptions */
.status { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 2px 7px 2px 6px; border-radius: 999px; background: var(--sunk); font: 500 10px/12px ${MONO}; letter-spacing: -0.02em; color: var(--muted); white-space: nowrap; }
.status.supported { background: var(--ok-bg); color: var(--ok-fg); }
.status.stale { background: var(--amber-bg); color: var(--amber-fg); }
.tag { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 1px 8px; border-radius: 999px; background: var(--sunk); font: 400 11px/16px ${SANS}; color: var(--muted); white-space: nowrap; }
.tag.reason { font: 400 10.5px/16px ${MONO}; letter-spacing: 0.02em; cursor: help; }
.tag.stale { background: var(--amber-bg); color: var(--amber-fg); }
.tag.held { background: none; box-shadow: inset 0 0 0 1px var(--pencil); }
.tag.dashed { background: none; outline: 1px dashed var(--rule-strong); outline-offset: -1px; }
.tag.empty { background: none; outline: 1px dashed var(--ink); outline-offset: -1px; color: var(--ink); }
.default { font: 400 12px/16px ${SANS}; color: var(--muted); }

/* The identity: the page, or the selected Instance by what it shows */
.identity { gap: 4px; padding: 8px 12px 14px; }
.identity > .body { padding-top: 2px; }
.back { display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px; margin-left: -4px; border-radius: 999px; background: var(--sheet); color: var(--ink); transition: background-color 120ms ease-out; }
.back:hover { background: var(--sunk-hover); }
.title-line { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 28px; }
.title-line .component { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 14px/18px ${SANS}; letter-spacing: -0.02em; }
.title-line .keys { margin-left: auto; }
.identity .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 17px/22px ${SANS}; letter-spacing: -0.015em; color: var(--ink); outline-offset: 4px; }
.title-line + .name { margin-top: 8px; }
.identity .id { font: 400 12px/16px ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.verdicts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 4px; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding-top: 8px; }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding-top: 4px; color: var(--muted); font-size: 12px; }
.crumbs button { min-height: 24px; padding: 0 9px; border-radius: 999px; background: var(--sunk); color: var(--ink); font: 400 11px/24px ${MONO}; }
.crumbs button:hover { background: var(--sunk-hover); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 4px; }

/* Select multiple: the call site's selection, and the page one link away */
.selection { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-top: 8px; padding: 9px 12px; border-radius: 12px; background: var(--sheet); font-size: 12px; line-height: 16px; }
.widen { align-self: flex-start; min-height: 24px; color: var(--lilac-ink); font: 500 12px/16px ${SANS}; text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--lilac-ink) 40%, transparent); text-underline-offset: 3px; }
.widen:hover { text-decoration-color: currentColor; }
.selection-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; }
.fold > summary { display: flex; align-items: center; gap: 6px; min-height: 30px; margin: 0 -14px; padding: 4px 14px; cursor: pointer; list-style: none; font: 500 12px/16px ${SANS}; border-top: 1px solid var(--rule-soft); }
.fold > summary::-webkit-details-marker { display: none; }
.fold > summary:hover { background: var(--hover); }
.fold > summary .icon { color: var(--muted); transition: transform 160ms ease-out; }
.fold[open] > summary .icon { transform: rotate(90deg); }
.fold[open] > summary { margin-bottom: 4px; }
.fold > .muted { padding-bottom: 4px; font-size: 12px; line-height: 16px; }

/* Notices: the Product layer's, Overrides off, and an Instance's note */
.notice-card { gap: 8px; }
.notice-card .title { font-size: 13px; line-height: 18px; }
.notice-card ul { list-style: none; margin: 0; padding: 0; }
.notice-card li { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-top: 1px solid var(--rule-soft); font-size: 13px; }
.notice-card li .mono { color: var(--muted); }
.command { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 38px; padding: 4px 4px 4px 12px; border-radius: 12px; background: var(--sheet); font: 400 12px/16px ${MONO}; color: var(--ink); }
.command .btn { height: 28px; padding: 0 10px; background: var(--card); }
.note-card { flex-direction: row; gap: 10px; }
.note-card .icon { margin-top: 2px; color: var(--muted); }
.note-card .text { display: flex; flex-direction: column; gap: 4px; }
.notice { padding: 10px 12px; border-radius: 12px; background: var(--sheet); font: 400 12px/18px ${SANS}; }
.notice code { font-family: ${MONO}; font-weight: 600; color: var(--ink); }
.notice .btn { margin-top: 8px; background: var(--card); }
.warn { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--amber-bg); color: var(--amber-fg); font: 400 12px/17px ${SANS}; }
.warn .dot { width: 8px; height: 8px; margin-top: 5px; background: var(--amber-dot); }

/* The change list: each change by its delta */
.section.changes { gap: 6px; padding: 12px 0 6px; overflow: hidden; }
.section.changes > .head { padding: 0 14px 4px; }
.keylist { list-style: none; margin: 0; padding: 0; }
.keylist button {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "key what" "key where"; column-gap: 10px;
  width: 100%; padding: 8px 14px; border-top: 1px solid var(--rule-soft); text-align: left;
}
.keylist button:not(:disabled):hover { background: var(--hover); }
.keylist .key { grid-area: key; align-self: start; margin-top: 0; }
.keylist .what { grid-area: what; font: 400 12px/18px ${MONO}; overflow-wrap: anywhere; }
.keylist .where { grid-area: where; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; line-height: 16px; }

/* Coverage, with the call site */
.coverage { gap: 8px; }
.coverage .bar { display: flex; gap: 2px; height: 4px; }
.coverage .bar span { flex: 1; border-radius: 2px; background: var(--rule); }
.coverage .bar span.on { background: var(--lilac-line); }
.coverage .site { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 10px; }
.coverage .site .mono { margin-left: auto; text-align: right; color: var(--muted); }

/* A prop's card: its name, its delta and Reset, then its table of options */
.prop-card { gap: 8px; padding: 6px 6px 12px 12px; }
.row { display: flex; flex-direction: column; gap: 8px; }
.row .line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-height: 26px; }
.row .key { margin: 0 -2px 0 -3px; }
.row .name { flex: none; display: flex; align-items: baseline; gap: 6px; font: 500 14px/18px ${SANS}; letter-spacing: -0.01em; }
.row .name .mono { font-size: 11px; color: var(--faint); letter-spacing: 0; }
.row .value { flex: 1; min-width: 0; padding-right: 6px; text-align: right; font: 400 12px/16px ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.row .value .muted, .row .value.counts { font-family: ${SANS}; }
.row .value.counts { font: 500 10px/14px ${MONO}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--faint); }
.row .reset { margin-left: auto; }
.row .value ~ .reset { margin-left: 0; }
.row .change { margin-top: -6px; font: 400 11.5px/16px ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.row .change .arrow { color: var(--faint); font-family: ${SANS}; }
.row .change .to { color: var(--lilac-ink); font-weight: 600; }
.row .current { font: 400 12px/16px ${MONO}; color: var(--ink); }
.row .current .meta { font-family: ${SANS}; margin-right: 4px; }
.row .source { margin-top: -4px; font: 400 11px/14px ${SANS}; color: var(--muted); }
.row .explain { font: 400 12px/17px ${SANS}; color: var(--muted); }
.row .refusal { display: flex; align-items: center; gap: 6px; padding-right: 6px; color: var(--muted); font-size: 12px; line-height: 16px; }
.row .keeping { align-self: flex-start; min-height: 24px; font: 500 12px/16px ${SANS}; color: var(--lilac-ink); text-decoration: underline; text-underline-offset: 3px; }
.prop-card .row > .notice, .prop-card .row > .text { margin-right: 6px; }
.prop-card .row > .text { width: calc(100% - 6px); }

/* The options table: hairline cells, the chosen one in lilac */
.pills {
  display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 1px; margin-right: 6px; overflow: hidden;
  border: 1px solid var(--rule); border-radius: 12px; background: var(--rule);
}
.pills button {
  display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 0; min-height: 30px; padding: 4px 8px;
  background: var(--card); color: var(--muted); font: 400 12px/16px ${SANS}; text-align: center;
  transition: background-color 120ms ease-out, color 120ms ease-out;
}
.pills button:not([aria-pressed="true"]):not(:disabled):hover { background: var(--hover); color: var(--ink); }
.pills button[aria-pressed="true"] { background: var(--lilac); color: var(--on-lilac); font-weight: 500; }
.pills button:focus-visible { outline-offset: -2px; border-radius: 10px; }
.pills .opt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre; }
.pills .app .opt { text-decoration: underline dotted var(--faint); text-underline-offset: 4px; }
.pills .count { flex: none; font: 500 10px/14px ${MONO}; font-variant-numeric: tabular-nums; color: var(--faint); }
.pills button[aria-pressed="true"] .count { color: inherit; opacity: 0.7; }
.row .text { width: 100%; min-height: 36px; padding: 8px 12px; resize: none; overflow: hidden; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); color: var(--ink); font: 400 13px/18px ${SANS}; outline: none; }
.row .text:focus { border-color: var(--lilac-line); box-shadow: 0 0 0 3px var(--select); }
.row.overridden .text { border-color: var(--lilac-line); }

/* True or false: one card of switches */
.switches { gap: 0; padding: 2px 12px 2px 16px; }
.switches .row { gap: 6px; padding: 7px 0; border-top: 1px solid var(--rule-soft); }
.switches .row:first-child { border-top: 0; }
.row.switch .line { min-height: 26px; }
.row.switch .change { margin-top: -4px; }
.toggle { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
.state-text { font: 400 10px/12px ${MONO}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.switch-track { position: relative; flex: none; width: 40px; height: 22px; border-radius: 999px; background: var(--switch-off); transition: background-color 160ms ease-out; }
.switch-track .thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 2px rgba(10, 10, 10, 0.22); transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }
.switch-track[aria-checked="true"] { background: var(--switch-on); }
.switch-track[aria-checked="true"] .thumb { transform: translateX(18px); }
@media (prefers-reduced-motion: reduce) { .switch-track, .switch-track .thumb { transition: none; } }

/* Set by the code: inspect-only rows, folded to one line */
.inspect { gap: 0; padding: 0; overflow: hidden; }
.inspect > details > summary { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 14px; cursor: pointer; list-style: none; font-weight: 500; font-size: 13px; }
.inspect > details > summary:hover { background: var(--hover); }
.inspect summary::-webkit-details-marker { display: none; }
.inspect summary .icon { color: var(--muted); transition: transform 160ms ease-out; }
.inspect .summary-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.inspect details[open] > summary > .icon { transform: rotate(90deg); }
.inspect-rows { display: flex; flex-direction: column; padding: 0 14px 8px; }
.inspect .row { gap: 2px; padding: 5px 0; border-top: 1px solid var(--rule-soft); }
.inspect .row .line { min-height: 24px; gap: 8px; flex-wrap: nowrap; }
.inspect .row .name { width: 112px; font: 400 12px/18px ${MONO}; letter-spacing: 0; color: var(--muted); overflow-wrap: anywhere; }
.inspect .row .name .mono { display: none; }
.inspect .row .value { text-align: left; color: var(--ink); }
.inspect .injected { padding: 0 14px 12px; }
.inspect .injected summary { display: flex; align-items: center; gap: 6px; min-height: 28px; color: var(--muted); font-size: 12px; cursor: pointer; list-style: none; }
.inspect .injected[open] summary .icon { transform: rotate(90deg); }

/* The component list: names, counts and the exceptions */
.list { list-style: none; margin: 0; padding: 0; }
.group > details > summary { list-style: none; cursor: pointer; }
.group > details > summary::-webkit-details-marker { display: none; }
.group summary {
  display: grid; grid-template-columns: minmax(0, 1fr) auto auto 16px; grid-template-areas: "name n verdict go" "sub sub sub sub";
  align-items: center; column-gap: 10px; min-height: 42px; padding: 8px 12px 8px 14px; border-top: 1px solid var(--rule-soft);
}
.group summary:hover, .group details[open] > summary { background: var(--hover); }
.group summary .cname { grid-area: name; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.group summary .times { grid-area: n; text-align: right; font: 400 11px/16px ${MONO}; font-variant-numeric: tabular-nums; color: var(--muted); }
.group summary .verdict { grid-area: verdict; justify-self: end; }
.group summary > .icon { grid-area: go; color: var(--muted); transition: transform 160ms ease-out; }
.group details[open] > summary > .icon { transform: rotate(90deg); }
.group summary .sub { grid-area: sub; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; color: var(--muted); font-size: 12px; line-height: 16px; }
.group summary .sub:empty { display: none; }
.group summary .sub span { display: inline-flex; align-items: center; gap: 6px; }
.group summary .sub .changed { color: var(--lilac-ink); font-weight: 500; }
.group summary .sub .stale { color: var(--amber-fg); }
.group .instances { padding: 2px 0 6px; background: var(--hover); }
.group .instances li { display: flex; flex-direction: column; }
.group .instances button { display: flex; align-items: flex-start; gap: 8px; width: 100%; min-height: 38px; padding: 6px 12px 6px 26px; text-align: left; }
.group .instances button:hover { background: var(--sunk); }
.group .instances button:focus-visible { outline-offset: -2px; }
.group .instances .keys { margin-top: 0; }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.who .screen-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who .site { font: 400 11px/16px ${MONO}; color: var(--muted); overflow-wrap: anywhere; }
.who .self { font-size: 11px; line-height: 16px; color: var(--muted); }
.who.out .screen-name, .who.out .site { color: var(--faint); text-decoration: line-through; }
.held-values { padding: 0 14px 6px 26px; font: 400 11px/16px ${MONO}; color: var(--muted); }
.interaction li { display: flex; flex-direction: column; gap: 2px; padding: 8px 14px; border-top: 1px solid var(--rule-soft); }
.interaction .muted { font-size: 12px; line-height: 16px; }

/* Held for review: in pencil, applying to nothing */
.held-list { display: flex; flex-direction: column; }
.held-item { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; border-top: 1px solid var(--rule-soft); }
.held-item .target { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: 400 12px/16px ${MONO}; }
.held-item .muted { font-size: 12px; line-height: 16px; }

/* The selection's Instances */
.members { gap: 8px; }
.members .list > li, .members legend > label { display: flex; align-items: center; gap: 10px; min-height: 38px; border-top: 1px solid var(--rule-soft); }
.members label { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
.members input[type="checkbox"] { appearance: none; flex: none; width: 16px; height: 16px; margin: 0; border: 1.5px solid var(--rule-strong); border-radius: 5px; display: grid; place-content: center; cursor: pointer; }
.members input[type="checkbox"]:checked { border-color: var(--lilac-line); background: var(--lilac-line); }
.members input[type="checkbox"]:checked::after { content: ""; width: 8px; height: 4px; margin-top: -2px; border: solid #FFFFFF; border-width: 0 0 2px 2px; transform: rotate(-45deg); }
.members input:disabled { opacity: 0.45; cursor: default; }
.members { padding-bottom: 6px; }
fieldset.site { border: 0; padding: 0; margin: 0; }
fieldset.site legend { width: 100%; padding: 0; }
fieldset.site .list { padding-left: 26px; }

/* Feature flags */
.flags { gap: 10px; }
.flag { gap: 8px; padding: 10px 0; border-top: 1px solid var(--rule-soft); }
.flag .line { min-height: 28px; }
.flag .name { font: 500 12px/16px ${MONO}; }
.flag .pills { margin-right: 0; grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.flag .foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.flag .state { margin-left: auto; font: 400 11px/14px ${SANS}; color: var(--muted); white-space: nowrap; padding-bottom: 6px; }
.flag.overridden .state { color: var(--lilac-ink); }
.flags .lasts { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--rule-soft); color: var(--muted); font-size: 12px; line-height: 16px; }
.flags .lasts .icon { margin-top: 1px; }
.flags .clear { align-self: flex-start; }
.flags .off { display: flex; flex-direction: column; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--sheet); }
.flags .off summary { display: flex; align-items: center; gap: 8px; min-height: 24px; cursor: pointer; list-style: none; font-weight: 500; }
.flags .off summary::-webkit-details-marker { display: none; }

/* On the page: the selected Instance solid and tagged with its size, the others it reaches
   dashed, left-out and hovered ones dashed grey; a change's outlines fade once it has landed */
.ring[data-ring], .mark[data-mark] { position: fixed; pointer-events: none; z-index: 2147483646; border-radius: 8px; transition: opacity 160ms ease-out; }
.ring[data-ring] { border: 2px solid ${PAGE.ink}; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85); }
.ring[data-ring].member, .mark[data-mark] { border: 1.5px dashed ${PAGE.line}; box-shadow: none; }
.ring[data-ring].out, .ring[data-ring].hover { border: 1.5px dashed #6F7472; box-shadow: none; }
.ring[data-ring] .label { position: absolute; bottom: calc(100% + 4px); right: -2px; padding: 1px 6px; border-radius: 4px; background: ${PAGE.ink}; color: #FFFFFF; font: 500 11px/16px ${MONO}; white-space: nowrap; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; font-synthesis: none; box-shadow: 0 1px 2px rgba(27, 34, 32, 0.2); }
.ring[data-ring] .label.below { bottom: auto; top: calc(100% + 4px); }
.mark[data-mark] { animation: loupe-mark-in 160ms ease-out; }
.ring[data-ring].quiet, .mark[data-mark].quiet { opacity: 0; transition: opacity 480ms ease-in; }
/* Picking: what a click would select, washed so it shows at a glance, and its tag */
.ring[data-ring].pick { border: 1.5px solid ${PAGE.line}; background: ${PAGE.fill}; }
.pick-tag { position: fixed; pointer-events: none; z-index: 2147483646; padding: 2px 9px; border-radius: 999px; background: ${PAGE.band}; color: #F0F0F0; font: 500 11px/17px ${SANS}; white-space: nowrap; -webkit-font-smoothing: antialiased; font-synthesis: none; box-shadow: 0 1px 2px rgba(27, 34, 32, 0.24); }
.pick-tag .detail { color: rgba(240, 240, 240, 0.62); font-weight: 400; }
@keyframes loupe-mark-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ring[data-ring], .mark[data-mark], .ring[data-ring].quiet, .mark[data-mark].quiet { animation: none; transition: none; } }

/* The Export dialog, centred on the page */
.dialog { width: 440px; max-width: calc(100vw - 32px); max-height: min(780px, calc(100vh - 32px)); overflow-y: auto; padding: 6px; border: 0; border-radius: 24px; background: var(--sheet); color: var(--ink); box-shadow: 0 0 0 1px var(--edge), var(--dialog-shadow); scrollbar-width: thin; }
.dialog::backdrop { background: rgba(27, 34, 32, 0.32); }
.dialog form { display: flex; flex-direction: column; gap: 6px; }
.dialog .sec { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; border-radius: 18px; background: var(--card); }
.dialog .sec.soft { gap: 10px; }
.dialog h2 { margin: 0; font: 600 18px/24px ${SANS}; letter-spacing: -0.015em; }
.dialog .field { display: flex; flex-direction: column; gap: 6px; }
.dialog .field input, .dialog .field textarea { width: 100%; padding: 8px 12px; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); color: var(--ink); font: 400 13px/18px ${SANS}; outline: none; }
.dialog .field textarea { min-height: 52px; resize: vertical; }
.dialog .field input:focus, .dialog .field textarea:focus { border-color: var(--lilac-line); box-shadow: 0 0 0 3px var(--select); }
.dialog .field > span { font-weight: 500; }
.dialog .notes { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.dialog .notes legend { padding: 0 0 10px; font-weight: 600; }
.dialog .notes .field > .entry { display: flex; align-items: flex-start; gap: 8px; font: 400 12px/18px ${SANS}; color: var(--muted); }
.dialog .tiles { display: flex; flex-wrap: wrap; gap: 20px; }
.dialog .tile { display: flex; flex-direction: column; gap: 2px; }
.dialog .tile b { font: 600 20px/24px ${SANS}; font-variant-numeric: tabular-nums; }
.dialog .actions { justify-content: flex-end; gap: 8px; padding: 6px 4px 4px; }
`;
