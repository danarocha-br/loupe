// The Toolbar's look (PER-140), from the 2e sketch and the PER-140 gap screens.
// Lives in the Toolbar's shadow root, so the app's CSS can't reach it and none of
// it reaches the app. Every colour is a token on the host, light by default and
// dark under `data-loupe-theme="dark"`, which the Toolbar sets from the OS preference or
// the header's toggle.

export const HOST_ATTRIBUTE = "data-loupe-toolbar";

/** On the host: `light` or `dark`. Loupe's own name, so an app's `[data-theme]` CSS never matches it. */
export const THEME_ATTRIBUTE = "data-loupe-theme";

/** Where the reader's choice of light or dark is kept; absent, the OS preference decides. */
export const THEME_KEY = "loupe:theme";

type Tokens = Record<string, string>;

const LIGHT: Tokens = {
  shell: "#E8EAEB",
  card: "#FFFFFF",
  "card-soft": "rgba(255, 255, 255, 0.6)",
  chip: "#F1F3F3",
  ink: "#0A0A0A",
  "on-ink": "#FFFFFF",
  muted: "#575757",
  label: "#4A4A48",
  faint: "#8A8F91",
  border: "#D5D9DA",
  divider: "#F0F0EE",
  "tag-fg": "#3A3F41",
  purple: "#A343F5",
  "on-purple": "#FFFFFF",
  "purple-strong": "#5B1A99",
  "ok-bg": "#DFF7E4",
  "ok-fg": "#14532D",
  "amber-bg": "#FFF1D6",
  "amber-fg": "#7A4B00",
  "amber-dot": "#E0A030",
  "held-bg": "#F3E8FE",
  "held-fg": "#3B0E66",
  red: "#E5484D",
  dock: "#E9E9E7",
  shadow: "0 12px 28px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06)",
  "dialog-shadow": "0 24px 64px rgba(0, 0, 0, 0.18)",
};

// The decision's dark table (PER-140, 2026-11-12) where it names a role; the rest
// follow it: cards sit darker than the shell, like wells, and purple goes lighter.
const DARK: Tokens = {
  shell: "#1C1D1D",
  card: "#121212",
  "card-soft": "rgba(18, 18, 18, 0.55)",
  chip: "#1B1D1D",
  ink: "#E5E5E5",
  "on-ink": "#121212",
  muted: "#A2A2A2",
  label: "#B0B0AE",
  faint: "#6F7476",
  border: "#303435",
  divider: "#1F1F1D",
  "tag-fg": "#C2C6C8",
  purple: "#CD7AFF",
  "on-purple": "#121212",
  "purple-strong": "#ECC6FF",
  "ok-bg": "#0F2414",
  "ok-fg": "#8BC2A1",
  "amber-bg": "#281C05",
  "amber-fg": "#CDA564",
  "amber-dot": "#D9893B",
  "held-bg": "#281F32",
  "held-fg": "#ECC6FF",
  red: "#FC7579",
  dock: "#1C1D1D",
  shadow: "0 12px 28px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)",
  "dialog-shadow": "0 24px 64px rgba(0, 0, 0, 0.6)",
};

const declare = (tokens: Tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(" ");

const SANS = `"Inter Tight", system-ui, -apple-system, "Segoe UI", sans-serif`;
const MONO = `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

export const CSS = `
:host { all: initial; ${declare(LIGHT)} color-scheme: light; }
:host([data-loupe-theme="dark"]) { ${declare(DARK)} color-scheme: dark; }
* { box-sizing: border-box; }
.icon { display: block; flex: none; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* Text */
.panel, .dock, .dialog, .ring .label {
  font: 500 12px/16px ${SANS}; color: var(--ink);
  -webkit-font-smoothing: antialiased; font-synthesis: none; overflow-wrap: anywhere;
}
.mono { font-family: ${MONO}; font-weight: 400; }
.muted { color: var(--muted); font-weight: 400; }
.meta { font: 400 10px/12px ${MONO}; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.body { font: 400 13px/18px ${SANS}; color: var(--muted); margin: 0; }
p { margin: 0; }
h3 { margin: 0; font: 500 14px/18px ${SANS}; color: var(--ink); }

/* Buttons: pills, the ink primary, round icon buttons */
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
button:disabled { cursor: default; opacity: .4; }
button:focus-visible, input:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--chip); color: var(--ink); font-weight: 500; white-space: nowrap; }
.btn.small { height: 28px; }
.btn.tall { height: 40px; padding: 0 16px; }
.btn.primary { background: var(--ink); color: var(--on-ink); height: 38px; padding: 0 18px 0 14px; gap: 8px; }
.btn.round { width: 38px; height: 38px; padding: 0; }
.btn.round.tall { width: 40px; height: 40px; }
.btn.circle { width: 36px; height: 36px; padding: 0; }
.btn:not(:disabled):hover { filter: brightness(.96); }
:host([data-loupe-theme="dark"]) .btn:not(:disabled):hover { filter: brightness(1.25); }

/* The panel: a pinned header and footer, and a scrolling middle */
.panel {
  position: fixed; top: 12px; right: 16px; bottom: 82px; z-index: 2147483647;
  width: 360px; max-height: 820px;
  display: flex; flex-direction: column; gap: 6px; padding: 6px;
  background: var(--shell); border-radius: 30px;
}
.header { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 3px; border-radius: 20px; background: var(--card); }
.header .end { display: flex; align-items: center; gap: 4px; }
.header .btn { height: 38px; }
.middle { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; scrollbar-width: none; border-radius: 20px; }
.middle::-webkit-scrollbar { display: none; }
.footer { flex: none; display: flex; align-items: center; gap: 4px; height: 52px; padding: 0 6px 0 18px; border-radius: 999px; background: var(--card); }
.footer .count { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 13px; white-space: nowrap; }
.footer .count .text { overflow: hidden; text-overflow: ellipsis; }
.footer .btn.tall { padding: 0 14px; }
.footer .btn.round.tall { padding: 0; }

/* Cards */
.card { flex: none; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 16px 20px; border-radius: 20px; background: var(--card); }
.card.soft { background: var(--card-soft); border-radius: 24px; }
.card.stretch { flex: 1 0 auto; }
.card.list-card { padding: 10px 6px 6px; gap: 2px; }
.card.list-card > .head { padding: 0 8px 4px 14px; min-height: 28px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.head .title { display: flex; align-items: center; gap: 10px; min-width: 0; }

/* Dots: Override purple, notice amber and red, the hollow ring of held for review */
.dot { flex: none; width: 10px; height: 10px; border-radius: 999px; }
.dot.small { width: 7px; height: 7px; }
.dot.purple { background: var(--purple); }
.dot.amber { background: var(--amber-dot); }
.dot.red { background: var(--red); }
.dot.none { background: var(--border); }
.dot.ring { border: 2px solid var(--purple); }
.dot.hollow { border: 1.5px solid var(--faint); }

/* Tags: status pills in the sans, reasons in caps mono */
.tag { display: inline-flex; align-items: center; gap: 5px; flex: none; padding: 2px 6px; border-radius: 6px; background: var(--chip); color: var(--label); font: 400 10px/12px ${MONO}; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
.tag.status { padding: 3px 7px; border-radius: 999px; color: var(--tag-fg); font: 500 11px/12px ${SANS}; letter-spacing: 0; text-transform: none; }
.tag.supported { background: var(--ok-bg); color: var(--ok-fg); }
.tag.stale { background: var(--amber-bg); color: var(--amber-fg); }
.tag.held { background: none; box-shadow: inset 0 0 0 1.5px var(--purple); color: var(--purple-strong); }
.tag.dashed { background: none; outline: 1px dashed var(--border); outline-offset: -1px; }
.tag.empty { background: var(--held-bg); color: var(--purple); }
.chip-label { display: inline-flex; padding: 3px 8px; border-radius: 999px; background: var(--chip); font: 400 11px/12px ${MONO}; color: var(--ink); }

/* The identity card: the page, or the selected Instance */
.identity { padding: 5px 5px 14px 12px; gap: 4px; }
.identity .head { padding-left: 8px; }
.identity .name { font-size: 18px; line-height: 40px; letter-spacing: -.035em; color: var(--ink); }
.identity .id { padding: 0 8px; font: 400 12px/16px ${MONO}; color: var(--muted); }
.identity .body { padding: 0 8px; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.identity .actions { padding: 6px 8px 0; }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 8px 0; color: var(--muted); font-weight: 400; }
.crumbs button { padding: 2px 8px; border-radius: 999px; background: var(--chip); color: var(--ink); font: 400 11px/16px ${MONO}; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 8px 0; }

/* APPLY TO: the scope's segmented control */
.apply { display: flex; flex-direction: column; gap: 8px; padding: 10px 7px 0 0; }
.apply .meta { padding-left: 8px; font-size: 11px; line-height: 14px; }
.scopes { display: flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 22px; background: var(--chip); }
.scopes button { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 4px 10px; border-radius: 999px; color: var(--muted); text-align: center; }
.scopes button[aria-pressed="true"] { background: var(--ink); color: var(--on-ink); }

/* Notices: the Product layer's, Overrides off, and an Instance's card-level note */
.notice-card { gap: 8px; padding: 16px 16px 16px 20px; }
.notice-card .title { font-size: 14px; line-height: 18px; }
.notice-card ul { list-style: none; margin: 0; padding: 0; }
.notice-card li { display: flex; justify-content: space-between; gap: 8px; padding: 9px 0; border-top: 1px solid var(--divider); font-size: 13px; }
.notice-card li .mono { font-size: 12px; color: var(--muted); }
.command { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; padding: 4px 4px 4px 12px; border-radius: 12px; background: var(--chip); font: 400 12px/16px ${MONO}; color: var(--ink); }
.command .btn { height: 28px; padding: 0 10px; background: var(--card); font: 500 11px/16px ${SANS}; }
.note-card { flex-direction: row; gap: 10px; padding: 16px 16px 16px 20px; }
.note-card .icon { margin-top: 2px; color: var(--muted); }
.note-card .text { display: flex; flex-direction: column; gap: 4px; }
.notice { padding: 10px 14px; border-radius: 14px; background: var(--held-bg); color: var(--held-fg); font: 400 12px/18px ${SANS}; }
.notice code { font-family: ${MONO}; }
.notice .btn { margin-top: 8px; height: 28px; background: var(--card); }
.warn { display: flex; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--amber-bg); color: var(--amber-fg); font: 400 12px/17px ${SANS}; }
.warn .dot { width: 8px; height: 8px; margin-top: 5px; background: var(--amber-dot); }

/* Coverage, with the call site */
.coverage .bar { display: flex; gap: 3px; height: 6px; }
.coverage .bar span { flex: 1; border-radius: 999px; background: var(--border); }
.coverage .bar span.on { background: var(--ink); }
.coverage .site { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 10px; }
.coverage .site .meta { font-size: 11px; }
.coverage .site .mono { margin-left: auto; font-size: 12px; text-align: right; overflow-wrap: normal; }

/* Prop rows */
.row { display: flex; flex-direction: column; gap: 8px; }
.row .line { display: flex; align-items: center; gap: 10px; min-height: 32px; }
.row .name { flex: none; display: flex; align-items: center; gap: 8px; font-size: 14px; line-height: 18px; }
.row .name .mono { font-size: 12px; color: var(--muted); }
.row .value { flex: 1; min-width: 0; text-align: right; font: 400 12px/16px ${MONO}; color: var(--muted); letter-spacing: .02em; }
.row .reset { margin-left: auto; }
.row .value ~ .reset { margin-left: 0; }
.row .current { font: 400 12px/16px ${MONO}; color: var(--ink); }
.row .current .meta { font-size: 11px; margin-right: 6px; }
.row .source { font: 400 11px/14px ${MONO}; color: var(--muted); }
.row .explain { font: 400 12px/17px ${SANS}; color: var(--muted); }
.row .refusal { display: flex; align-items: center; gap: 6px; font-weight: 400; color: var(--muted); }
.row .keeping { align-self: flex-start; font: 400 12px/16px ${SANS}; color: var(--purple); text-decoration: underline; text-underline-offset: 2px; }
.prop { padding: 5px 5px 12px 12px; }
.prop .row .source, .prop .row .current, .prop .row .explain { padding-left: 20px; }
.pills { display: flex; flex-wrap: wrap; gap: 6px 4px; }
.pills button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 14px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--border); font: 500 13px/16px ${SANS}; white-space: pre; }
.pills button[aria-pressed="true"] { background: var(--ink); color: var(--on-ink); box-shadow: none; }
.row.overridden .pills button[aria-pressed="true"] { background: var(--purple); color: var(--on-purple); }
.pills .count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; margin-right: -8px; padding: 0 5px; border-radius: 999px; background: var(--chip); color: var(--ink); font: 400 11px/14px ${MONO}; }
.row .text { width: 100%; min-height: 38px; padding: 9px 14px; resize: none; overflow: hidden; border: 1.5px solid var(--border); border-radius: 14px; background: var(--card); color: var(--ink); font: 400 14px/18px ${SANS}; outline: none; }
.row .text:focus, .row.overridden .text { border-color: var(--ink); }

/* Inspect-only rows: a name lane, the value, the reason */
.inspect { gap: 6px; }
.inspect .row { gap: 2px; }
.inspect .row .line { min-height: 24px; gap: 8px; }
.inspect .row .name { width: 88px; font: 400 12.5px/24px ${MONO}; color: var(--label); }
.inspect .row .name .mono { display: none; }
.inspect .row .value { text-align: left; font-size: 12.5px; line-height: 24px; color: var(--ink); letter-spacing: 0; }
.inspect details summary { display: flex; align-items: center; gap: 6px; padding-top: 6px; color: var(--muted); font-weight: 400; cursor: pointer; list-style: none; }
.inspect details summary::-webkit-details-marker { display: none; }
.inspect details[open] summary .icon { transform: rotate(90deg); }

/* The component list */
.list { list-style: none; margin: 0; padding: 0; }
.group > details > summary { list-style: none; cursor: pointer; }
.group > details > summary::-webkit-details-marker { display: none; }
.group summary {
  display: grid; grid-template-columns: 1fr 32px 92px 16px; grid-template-areas: "name n tag go" "sub n tag go";
  align-items: center; column-gap: 10px; min-height: 44px; padding: 6px 10px 6px 14px; border-radius: 14px;
}
.group summary:hover, .group details[open] > summary { background: var(--chip); }
.group summary:hover .tag.status:not(.supported):not(.stale), .group details[open] > summary .tag.status:not(.supported):not(.stale) { background: var(--card); }
.group summary .cname { grid-area: name; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 18px; }
.group summary .times { grid-area: n; text-align: right; font: 400 12px/16px ${MONO}; }
.group summary .status { grid-area: tag; justify-self: end; }
.group summary .icon { grid-area: go; }
.group details[open] > summary .icon { transform: rotate(90deg); }
.group summary .sub { grid-area: sub; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; color: var(--muted); font-weight: 400; }
.group summary .sub:empty { display: none; }
.group summary .sub span { display: inline-flex; align-items: center; gap: 6px; }
.group summary .sub .stale { color: var(--amber-fg); }
.group .instances { padding: 4px 10px 6px 26px; }
.group .instances li { display: flex; flex-direction: column; justify-content: center; min-height: 32px; }
.group .instances button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: calc(100% + 12px); min-height: 32px; padding: 0 6px; margin: 0 -6px; border-radius: 8px; text-align: left; font: 400 12px/16px ${MONO}; }
.group .instances button:hover, .group .instances button:focus-visible { background: var(--chip); }
.held-values { padding: 0 0 6px; font: 400 11px/16px ${MONO}; color: var(--muted); }
.interaction li { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 8px 14px; font-size: 14px; line-height: 18px; }

/* Held for review */
.held-list { display: flex; flex-direction: column; gap: 2px; }
.held-item { display: flex; flex-direction: column; gap: 8px; padding: 12px 10px 12px 14px; border-radius: 14px; }
.held-item:first-child { background: var(--chip); }
.held-item:first-child .btn { background: var(--card); }
.held-item .target { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: 400 12px/16px ${MONO}; }

/* Scope members */
.members .list > li, .members legend > label { display: flex; align-items: center; gap: 10px; min-height: 40px; border-top: 1px solid var(--divider); font: 400 13px/16px ${SANS}; }
.members label { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; }
.members input[type="checkbox"] { appearance: none; flex: none; width: 18px; height: 18px; margin: 0; border-radius: 5px; box-shadow: inset 0 0 0 1.5px var(--faint); display: grid; place-content: center; cursor: pointer; }
.members input[type="checkbox"]:checked { background: var(--ink); box-shadow: none; }
.members input[type="checkbox"]:checked::after { content: ""; width: 9px; height: 5px; margin-top: -2px; border: solid var(--on-ink); border-width: 0 0 2px 2px; transform: rotate(-45deg); }
.members input:disabled { opacity: .4; cursor: default; }
fieldset.site { border: 0; padding: 0; margin: 0; }
fieldset.site legend { width: 100%; padding: 0; }
fieldset.site .list { padding-left: 28px; }

/* Feature flags */
.flag { padding: 12px 14px; border-radius: 14px; margin: 0 -14px; gap: 8px; }
.flag.overridden { background: var(--chip); }
.flag.overridden .pills button:not([aria-pressed="true"]), .flag.overridden .btn { background: var(--card); }
.flag .line { min-height: 28px; }
.flag .name { font: 500 13px/16px ${MONO}; }
.flag .foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.flag .state { margin-left: auto; font: 400 10px/12px ${MONO}; letter-spacing: .04em; color: var(--muted); white-space: nowrap; padding-bottom: 8px; }
.flag.overridden .state { color: var(--purple); }
.flags .lasts { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--divider); color: var(--muted); font-weight: 400; }
.flags .lasts .icon { margin-top: 1px; }
.flags .clear { align-self: flex-start; }
.flags .off { gap: 8px; padding: 12px 14px; margin: 0 -14px; border-radius: 14px; background: var(--chip); }
.flags .off .command { background: var(--card); }

/* Snapshots */
.snapshots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.snapshots li { display: flex; gap: 14px; padding: 10px; margin: 0 -10px; border-radius: 14px; }
.snapshots li:hover { background: var(--chip); }
.snapshots li:hover .btn { background: var(--card); }
.snapshots .thumb { flex: none; width: 64px; height: 44px; object-fit: cover; border-radius: 8px; box-shadow: 0 0 0 1px var(--border); }
.snapshots .thumb.outdated { opacity: .5; }
.snapshots .info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.snapshots .title { font-size: 13px; }
.snapshots .summary { font: 400 11px/16px ${MONO}; color: var(--muted); }
.snapshots .btns { display: flex; gap: 4px; }
.snapshots .elsewhere { font-weight: 400; color: var(--muted); }

/* Page rings */
.ring { position: fixed; pointer-events: none; z-index: 2147483646; border: 2px solid var(--purple); border-radius: 8px; }
.ring.hover { border-style: dashed; border-color: var(--faint); }
.ring.out { border-style: dashed; }
.ring .label { position: absolute; top: -24px; left: -2px; padding: 2px 8px; border-radius: 999px; background: var(--purple); color: var(--on-purple); font-size: 11px; line-height: 16px; white-space: nowrap; }

/* The dock, and the transient line beside it */
.dock { position: fixed; bottom: 12px; right: 16px; z-index: 2147483647; display: flex; align-items: center; gap: 10px; }
.dock .capsule { display: flex; padding: 4px; border-radius: 999px; background: var(--dock); box-shadow: var(--shadow); }
.dock .inner { display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px; background: var(--card); }
.dock .btn { height: 44px; min-width: 44px; padding: 0 12px; gap: 6px; }
.dock .btn.round { width: 44px; padding: 0; }
.dock .btn[aria-pressed="true"] { background: var(--ink); color: var(--on-ink); }
.dock .n { font: 500 13px/16px ${MONO}; }
.dock .sep { width: 1px; height: 22px; background: var(--divider); }
.toast { display: flex; align-items: center; gap: 8px; max-width: 360px; padding: 9px 14px; border-radius: 10px; background: var(--ink); color: var(--on-ink); box-shadow: var(--shadow); font-weight: 400; }
.toast .dot { width: 8px; height: 8px; }
.toast kbd { font: 500 11px/14px ${MONO}; padding: 1px 5px; border-radius: 4px; background: rgba(127, 127, 127, .3); }

/* The Export dialog, centred on the page */
.dialog { width: 400px; max-width: calc(100vw - 32px); max-height: min(780px, calc(100vh - 32px)); overflow-y: auto; padding: 6px; border: 0; border-radius: 30px; background: var(--shell); box-shadow: var(--dialog-shadow); scrollbar-width: none; }
.dialog::backdrop { background: rgba(17, 17, 17, .25); }
.dialog form { display: flex; flex-direction: column; gap: 6px; }
.dialog .sec { display: flex; flex-direction: column; gap: 14px; padding: 16px 16px 18px 20px; border-radius: 24px; background: var(--card); }
.dialog .sec.soft { background: var(--card-soft); gap: 10px; }
.dialog h2 { margin: 0; font: 500 18px/24px ${SANS}; letter-spacing: -.035em; }
.dialog .field { display: flex; flex-direction: column; gap: 6px; }
.dialog .field input, .dialog .field textarea { width: 100%; padding: 9px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); color: var(--ink); font: 400 14px/18px ${SANS}; outline: none; }
.dialog .field textarea { min-height: 52px; padding: 9px 12px; border-radius: 12px; font-size: 13px; resize: vertical; }
.dialog .field input:focus, .dialog .field textarea:focus { border-color: var(--ink); box-shadow: inset 0 0 0 .5px var(--ink); }
.dialog .field > span { font-weight: 500; }
.dialog .notes { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.dialog .notes legend { padding: 0 0 10px; font-size: 14px; line-height: 18px; }
.dialog .notes .field > span { font: 400 11px/14px ${MONO}; color: var(--muted); }
.dialog .tiles { display: flex; flex-wrap: wrap; gap: 14px; }
.dialog .tile { display: flex; flex-direction: column; gap: 2px; }
.dialog .tile b { font: 500 20px/24px ${SANS}; letter-spacing: -.035em; }
.dialog .actions { display: flex; justify-content: flex-end; gap: 6px; padding: 4px; border-radius: 999px; background: var(--card); }
.dialog .actions .btn { height: 40px; padding: 0 16px; font-size: 13px; }
.dialog .actions .btn.primary { padding: 0 18px 0 14px; }
`;
