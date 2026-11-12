// Functional only (PER-130): the structure of the 2e sketch, with no visual pass yet
// (that is PER-140). Lives in the Toolbar's shadow root, so the app's CSS can't reach it.

export const HOST_ATTRIBUTE = "data-loupe-toolbar";

export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel {
  position: fixed; top: 16px; right: 16px; z-index: 2147483647;
  width: 360px; height: min(760px, calc(100vh - 32px));
  display: flex; flex-direction: column;
  background: #e8eaeb; color: #111; border: 1px solid #d5d9da; border-radius: 12px;
  font: 13px/1.4 system-ui, sans-serif;
}
.header, .footer { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
.header { border-bottom: 1px solid #d5d9da; }
.header .title { font-weight: 600; margin-right: auto; }
.footer { border-top: 1px solid #d5d9da; justify-content: space-between; }
.middle { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 8px; }
.card { background: #fff; border-radius: 8px; padding: 8px 10px; }
.card.stretch { flex: 1 0 auto; }
.card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
.banner { background: #fff4d6; border-radius: 8px; padding: 8px 10px; }
button { font: inherit; cursor: pointer; }
button[aria-pressed="true"] { background: #111; color: #fff; }
.mono { font-family: ui-monospace, monospace; font-size: 11px; }
.tag { font-family: ui-monospace, monospace; font-size: 10px; text-transform: uppercase; background: #f1f3f3; border-radius: 4px; padding: 1px 4px; }
.tag.supported { background: #d9f5df; }
.tag.stale { background: #fff4d6; }
.row { padding: 3px 0; }
.row .line { display: flex; gap: 8px; align-items: baseline; }
.row .name { flex: none; min-width: 96px; }
.row .value { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.row.overridden .name { color: #a343f5; font-weight: 600; }
.row.overridden .reset { margin-left: auto; }
.row .current { color: #666; padding-left: 4px; }
.pills { display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 0; }
.row.overridden .pills button[aria-pressed="true"] { background: #a343f5; }
.row .text { width: 100%; font: inherit; resize: none; overflow: hidden; }
.notice { background: #f3e8fe; border-radius: 6px; padding: 4px 6px; margin-top: 2px; }
.list { list-style: none; margin: 0; padding: 0; }
.list button { all: unset; cursor: pointer; display: block; width: 100%; padding: 3px 4px; border-radius: 4px; }
.list button:hover, .list button:focus-visible { background: #f1f3f3; }
.muted { color: #666; }
details summary { cursor: pointer; }
.ring { position: fixed; pointer-events: none; z-index: 2147483646; border: 2px solid #a343f5; border-radius: 3px; }
.ring.hover { border-style: dashed; border-color: #6b7280; }
.ring.out { border-style: dashed; }
.scopes { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 0; }
.row .source { padding-left: 4px; font-size: 11px; }
.row .keeping { all: unset; cursor: pointer; font-size: 11px; color: #a343f5; text-decoration: underline; }
.pills .count { opacity: .6; }
fieldset.site { border: 0; padding: 0; margin: 4px 0; }
.ring .label { position: absolute; top: -18px; left: -2px; background: #a343f5; color: #fff; font: 11px/16px ui-monospace, monospace; padding: 0 4px; border-radius: 3px; white-space: nowrap; }
.snapshots { list-style: none; margin: 0; padding: 0; }
.snapshots .thumb { flex: none; border-radius: 3px; }
.snapshots .thumb.outdated { opacity: .5; }
.dock { position: fixed; bottom: 16px; right: 16px; z-index: 2147483647; font: 13px system-ui, sans-serif; }
`;
