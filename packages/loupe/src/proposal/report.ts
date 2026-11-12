// The exported report (PER-99 §7, PER-139): one self-contained HTML file an
// engineer who wasn't in the session can act on. It carries the Proposal JSON in a
// `<script type="application/json">` block, which a button downloads on its own,
// and its screenshots as the JSON's own data URLs. Pure: a string from a Proposal.
//
// The images are drawn by a small inline script from the embedded JSON, so the
// file holds each image once rather than once in the JSON and again in the markup.
// Without scripts the text still reads in full.

import { plural } from "../toolbar/format.js";
import { ordinal } from "./build.js";
import type {
  JsonValue,
  Proposal,
  ProposalCallSite,
  ProposalChange,
  ProposalProp,
  ProposalRoute,
  ProposalScreenshot,
  WrittenAs,
} from "./types.js";

export const REPORT_DATA_ID = "loupe-proposal";

/** Above this, the export dialog warns that the file may be too big to attach. It never blocks. */
export const REPORT_WARN_BYTES = 25 * 1024 * 1024;

export type ReportOptions = {
  /** The report's own file name; the changes file downloads under the same stem as `.json`. */
  fileName?: string;
};

/** `proposal-<title-slug>-<YYYYMMDD-HHmm>.html`, in local time. */
export function reportFileName(title: string, date: Date): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `proposal-${slug ? `${slug}-` : ""}${stamp}.html`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** JSON that can sit in a script block: no `<` can close it or open a comment. Still valid JSON. */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

const code = (text: string) => `<code>${escapeHtml(text)}</code>`;

/** "2026-11-12 10:31 UTC" from an ISO time; the text as given when it isn't one. */
function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeHtml(iso);
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function value(raw: JsonValue | undefined, text: boolean): string {
  if (raw === undefined) return "not set";
  if (text && typeof raw === "string") return `'${raw}'`;
  return JSON.stringify(raw);
}

function lastSegment(anchor: string): string {
  return anchor.split(" › ").at(-1) ?? anchor;
}

function howWritten(writtenAs: Exclude<WrittenAs, "varies">, expression: string | undefined): string {
  switch (writtenAs) {
    case "literal":
      return "fixed in source: a one-line edit";
    case "expression":
      return expression ? `computed by app logic: ${code(expression)}` : "computed by app logic";
    case "spread":
      return "passed through a spread of props: where it comes from can't be told";
    case "unset":
      return "not written at the call site: the edit adds it";
    case "unknown":
      return "unknown: Loupe has no record of how the call site writes it";
  }
}

function capitalize(html: string): string {
  return html.charAt(0).toUpperCase() + html.slice(1);
}

function writtenCell(prop: ProposalProp): string {
  if (prop.writtenAs !== "varies") return capitalize(howWritten(prop.writtenAs, prop.expression));
  const sites = (prop.perCallSite ?? []).map((site) => `${escapeHtml(lastSegment(site.anchor))} ${howWritten(site.writtenAs, site.expression)}`);
  return `Differs per call site: ${sites.join("; ")}`;
}

function propRow(prop: ProposalProp): string {
  const text = prop.name === "children";
  const current = prop.currentCounts
    ? Object.entries(prop.currentCounts)
        .map(([shown, count]) => `${shown} ×${count}`)
        .join(", ")
    : value(prop.current, text);
  const proposed = prop.proposedUnset ? "Not set (remove it)" : value(prop.proposed, text);
  const name = text ? "Text" : code(prop.name);
  return `<tr><th scope="row">${name}</th><td>${escapeHtml(current)}</td><td>${escapeHtml(proposed)}</td><td>${writtenCell(prop)}</td></tr>`;
}

/** "1st of 2 <Button> in MemberRowMenu", the path, the anchor and the line hint. */
function siteHtml(site: ProposalCallSite): string {
  const count = site.total === null ? ordinal(site.nth) : `${ordinal(site.nth)} of ${site.total}`;
  const where = site.enclosing ? ` in ${code(site.enclosing)}` : "";
  const hint = site.lineHint ? ` · line ${escapeHtml(site.lineHint)} at export, a hint` : "";
  return (
    `<strong>${count} ${code(`<${site.component}>`)}${where}</strong>` +
    `<div class="muted">${code(site.path)}${hint}</div>` +
    `<div class="muted">Anchor: ${code(site.anchor)}</div>`
  );
}

function scopeText(change: ProposalChange): string {
  switch (change.scope) {
    case "instance":
      return "One Instance";
    case "call-site":
      return "Every Instance at this call site";
    case "page":
      return `Every ${escapeHtml(`<${change.component}>`)} on the page: ${plural(change.callSites.length, "call site")}`;
  }
}

/** ": user_1, user_2", or nothing when no Instance has a key path to tell it apart. */
function keyList(keys: readonly string[]): string {
  if (keys.every((key) => key === "")) return "";
  return `: ${keys.map((key) => code(key || "(no key)")).join(", ")}`;
}

function instancesHtml(change: ProposalChange): string {
  const covered = change.instances.filter((instance) => instance.included);
  const left = change.instances.filter((instance) => !instance.included);
  const lines: string[] = [];
  if (covered.length > 0) lines.push(`<li>Covers ${covered.length}${keyList(covered.map((instance) => instance.keyPath))}</li>`);
  if (left.length > 0) lines.push(`<li>Left out ${left.length}${keyList(left.map((instance) => instance.keyPath || instance.id))}</li>`);
  if (change.serverRendered.length > 0) {
    lines.push(
      `<li>Not previewed (server-rendered) ${change.serverRendered.length}${keyList(change.serverRendered.map((entry) => entry.keyPath || entry.anchor))}</li>`,
    );
  }
  return lines.length === 0 ? "" : `<ul class="instances">${lines.join("")}</ul>`;
}

function pairHtml(shot: ProposalScreenshot): string {
  const side = (label: "Before" | "After") =>
    `<figure><figcaption>${label}</figcaption><img data-shot="${escapeHtml(shot.id)}" data-side="${label.toLowerCase()}" alt="${escapeHtml(`${label}: ${shot.caption}`)}"></figure>`;
  return `<div class="pair" id="${escapeHtml(shot.id)}"><p class="caption">${escapeHtml(shot.id)} · ${escapeHtml(shot.caption)}</p><div class="sides">${side("Before")}${side("After")}</div></div>`;
}

function changeHtml(change: ProposalChange, route: ProposalRoute): string {
  const shots = change.screenshots
    .map((id) => route.screenshots.find((shot) => shot.id === id))
    .filter((shot): shot is ProposalScreenshot => shot !== undefined);
  const facts: string[] = [];
  if (change.needsCondition) facts.push(`<p class="condition"><strong>Needs a condition:</strong> ${escapeHtml(change.needsCondition)}</p>`);
  if (!change.onScreenAtExport) facts.push('<p class="muted">Not on screen at export: Current values are as last seen.</p>');
  if (change.overriddenBy.length > 0) {
    facts.push(`<p>Overridden by ${change.overriddenBy.map((id) => `<a href="#${escapeHtml(id)}">${escapeHtml(id)}</a>`).join(", ")} on some Instances: that narrower change wins there.</p>`);
  }
  if (change.alsoRendersOn.length > 0) facts.push(`<p class="muted">Also renders on ${change.alsoRendersOn.map(code).join(", ")}.</p>`);
  const where =
    change.callSites.length === 1
      ? `<div class="where">${siteHtml(change.callSites[0] as ProposalCallSite)}</div>`
      : `<ol class="where">${change.callSites.map((site) => `<li>${siteHtml(site)}</li>`).join("")}</ol>`;
  return `<article class="change" id="${escapeHtml(change.id)}" data-change="${escapeHtml(change.id)}">
<h4>${escapeHtml(change.id)} · ${code(`<${change.component}>`)} <span class="scope">${scopeText(change)}</span></h4>
${where}
<table><thead><tr><th>Prop</th><th>Current</th><th>Proposed</th><th>How the call site writes it</th></tr></thead>
<tbody>${change.props.map(propRow).join("")}</tbody></table>
${facts.join("\n")}
${instancesHtml(change)}
${change.note ? `<blockquote class="note"><strong>Note:</strong> ${escapeHtml(change.note)}</blockquote>` : ""}
<div class="shots">${shots.length > 0 ? shots.map(pairHtml).join("") : '<p class="muted">No screenshot: not captured on this route.</p>'}</div>
</article>`;
}

function routeHeading(route: ProposalRoute): string {
  return `<h3>${code(route.route)}</h3>${route.url ? `<p class="muted">${escapeHtml(route.url)}</p>` : ""}`;
}

function changesSection(proposal: Proposal): string {
  const routes = proposal.routes.filter((route) => route.changes.length > 0);
  const body =
    routes.length === 0
      ? '<p class="muted">No changes proposed.</p>'
      : routes.map((route) => `<div class="route">${routeHeading(route)}${route.changes.map((change) => changeHtml(change, route)).join("\n")}</div>`).join("\n");
  return `<section id="changes"><h2>Proposed changes</h2>${body}</section>`;
}

function statesSection(proposal: Proposal): string {
  const items = proposal.routes.flatMap((route) =>
    route.statesShown.map((state) => {
      const instance = state.keyPath ? `, Instance ${code(state.keyPath)}` : "";
      const how = state.controlled ? `the app controls it via ${code(state.appControlsVia)}` : "the component owns this state";
      const screen = state.onScreenAtExport ? "" : " Not on screen at export.";
      return `<li>${code(state.prop)} held at ${code(JSON.stringify(state.forced))} on ${code(`<${state.component}>`)}${instance} on ${code(route.route)}: ${how}. Context for the screenshots, not a change.${screen}<div class="muted">Anchor: ${code(state.anchor)}</div></li>`;
    }),
  );
  const body = items.length === 0 ? '<p class="muted">None.</p>' : `<ul>${items.join("")}</ul>`;
  return `<section id="states"><h2>States shown</h2><p class="muted">States held open or set to take the screenshots. Don't change the app's code for these.</p>${body}</section>`;
}

function heldSection(proposal: Proposal): string {
  if (proposal.heldForReview.length === 0) {
    return '<section id="held"><h2>Held for review, do not apply</h2><p class="muted">None.</p></section>';
  }
  const items = proposal.heldForReview.map((held) => {
    const props = held.props
      .map((prop) => `${code(prop.name)} → ${prop.proposedUnset ? "not set" : code(JSON.stringify(prop.proposed))}`)
      .join(", ");
    return `<li><strong>Do not apply.</strong> ${code(`<${held.component}>`)} on ${code(held.route)}: ${escapeHtml(held.detail)}.<div>Was proposing: ${props}</div><div class="muted">Anchor: ${code(held.anchor)}</div></li>`;
  });
  return `<section id="held"><h2>Held for review, do not apply</h2><p class="muted">Loupe couldn't place these on the code as it is now. The designer needs to review them first.</p><ul>${items.join("")}</ul></section>`;
}

function contextHtml(route: ProposalRoute): string {
  const parts: string[] = [];
  if (route.url) parts.push(`<li>URL: ${code(route.url)}</li>`);
  if (route.viewport) {
    const [width, height] = route.viewport;
    parts.push(`<li>Viewport: ${width}×${height} CSS px${route.dpr ? ` at ${route.dpr}x` : ""}${route.theme ? `, ${route.theme} theme` : ""}</li>`);
  } else if (route.theme) {
    parts.push(`<li>${route.theme} theme</li>`);
  }
  const flags = Object.entries(route.flags);
  parts.push(
    flags.length === 0
      ? "<li>Flags previewed: none</li>"
      : `<li>Flags previewed: ${flags.map(([key, flag]) => code(`${key} = ${JSON.stringify(flag)}`)).join(", ")}</li>`,
  );
  if (route.statesShown.length > 0) {
    const states = route.statesShown.map(
      (state) => `${code(`${state.prop} = ${JSON.stringify(state.forced)}`)} on ${code(`<${state.component}>`)}${state.keyPath ? ` (${escapeHtml(state.keyPath)})` : ""}`,
    );
    parts.push(`<li>States held: ${states.join(", ")}</li>`);
  }
  if (route.capturedAt) parts.push(`<li>Page last read at ${when(route.capturedAt)}; each screen's caption gives its own viewport</li>`);
  return `<ul class="context">${parts.join("")}</ul>`;
}

function screensSection(proposal: Proposal): string {
  const body = proposal.routes
    .map((route) => {
      const viewports = route.screenshots.filter((shot) => shot.kind === "viewport");
      const shots = viewports.length > 0 ? viewports.map(pairHtml).join("") : '<p class="muted">No screen captured on this route.</p>';
      return `<div class="route" data-route="${escapeHtml(route.route)}">${routeHeading(route)}${contextHtml(route)}${shots}</div>`;
    })
    .join("\n");
  return `<section id="screens"><h2>Screens</h2><p class="muted">Each screen as the designer saw it: before is the app as it is, after has the proposed changes.</p>${body}</section>`;
}

function headerHtml(proposal: Proposal, jsonName: string): string {
  const { project } = proposal;
  const changes = proposal.routes.reduce((sum, route) => sum + route.changes.length, 0);
  const states = proposal.routes.reduce((sum, route) => sum + route.statesShown.length, 0);
  const commit = project.commit ? project.commit.slice(0, 7) : "unknown commit";
  const dirty = project.dirty
    ? '<p class="warning">The working tree had uncommitted changes at export: totals and line hints may describe code that was never committed.</p>'
    : "";
  const by = proposal.designer ? ` by ${escapeHtml(proposal.designer)}` : "";
  return `<header>
<p class="muted">Loupe Proposal</p>
<h1>${escapeHtml(proposal.title)}</h1>
<p>${when(proposal.createdAt)}${by} · ${code(`${project.repo ?? "repo"}@${commit}`)} · Loupe ${escapeHtml(project.playgroundVersion ?? "unknown")} · format ${proposal.formatVersion}</p>
${dirty}
<p>${plural(changes, "change")} · ${plural(states, "State shown", "States shown")} · ${proposal.heldForReview.length} held for review</p>
<p><button type="button" data-download-json="${escapeHtml(jsonName)}">Download the changes file (${escapeHtml(jsonName)})</button></p>
<noscript><p class="warning">Screenshots and the download need JavaScript. The changes file is in this page's source, in the script block with id ${REPORT_DATA_ID}.</p></noscript>
</header>`;
}

const CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #f6f7f7; color: #111; font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 32px 16px 64px; }
header, section { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
h1 { margin: 0 0 8px; font-size: 26px; }
h2 { margin: 0 0 12px; font-size: 19px; }
h3 { margin: 16px 0 4px; font-size: 16px; }
h4 { margin: 0 0 8px; font-size: 15px; }
code { font: 13px ui-monospace, monospace; background: #f1f3f3; border-radius: 4px; padding: 0 4px; overflow-wrap: anywhere; }
.muted { color: #555; }
.warning { background: #fff4d6; border-radius: 8px; padding: 8px 12px; }
.change { border-top: 1px solid #e3e6e7; padding: 16px 0; }
.scope { font-weight: normal; color: #555; margin-left: 8px; }
.where { margin: 0 0 12px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #e3e6e7; }
thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #555; }
.condition { background: #f3e8fe; border-radius: 8px; padding: 8px 12px; }
.note { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #a343f5; background: #faf6fe; white-space: pre-wrap; }
.pair { margin: 12px 0; }
.caption { margin: 0 0 6px; color: #555; font-size: 13px; }
.sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
figure { margin: 0; }
figcaption { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #555; }
img { display: block; max-width: 100%; border: 1px solid #e3e6e7; border-radius: 6px; }
button { font: inherit; cursor: pointer; padding: 6px 12px; border-radius: 6px; border: 1px solid #c9cecf; background: #fff; }
`;

/** Draws the images from the embedded JSON and downloads the JSON alone. Runs once, inline. */
const SCRIPT = `(function () {
  var block = document.getElementById(${JSON.stringify(REPORT_DATA_ID)});
  var proposal = JSON.parse(block.textContent);
  var shots = {};
  proposal.routes.forEach(function (route) {
    route.screenshots.forEach(function (shot) { shots[shot.id] = shot; });
  });
  document.querySelectorAll("img[data-shot]").forEach(function (img) {
    var shot = shots[img.getAttribute("data-shot")];
    if (shot) img.setAttribute("src", img.getAttribute("data-side") === "before" ? shot.before : shot.after);
  });
  document.querySelectorAll("[data-download-json]").forEach(function (button) {
    button.addEventListener("click", function () {
      // The block escapes "<" to stay a script block; the file itself is plain JSON.
      var json = JSON.stringify(proposal, null, 2) + "\\n";
      var url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      var link = document.createElement("a");
      link.href = url;
      link.download = button.getAttribute("data-download-json");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });
  });
})();`;

export function proposalReport(proposal: Proposal, options: ReportOptions = {}): string {
  const fileName = options.fileName ?? reportFileName(proposal.title, new Date(proposal.createdAt));
  const jsonName = fileName.replace(/\.html?$/i, "") + ".json";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(proposal.title)} · Loupe Proposal</title>
<style>${CSS}</style>
</head>
<body>
<main>
${headerHtml(proposal, jsonName)}
${changesSection(proposal)}
${statesSection(proposal)}
${heldSection(proposal)}
${screensSection(proposal)}
<section id="apply"><h2>How to apply</h2><p>${escapeHtml(proposal.howToApply)}</p></section>
</main>
<script type="application/json" id="${REPORT_DATA_ID}">${scriptSafeJson(proposal)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
