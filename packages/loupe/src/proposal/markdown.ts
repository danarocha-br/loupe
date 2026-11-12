// Copy as Markdown (PER-99 §9): a short summary of a Proposal to paste into a
// ticket. One line per change, one per State shown and per held record; no
// images and no JSON. The exported HTML (PER-139) is the full report.

import { formatCurrent } from "../toolbar/format.js";
import { ordinal } from "./build.js";
import type { Proposal, ProposalCallSite, ProposalChange, ProposalProp, ProposalRoute } from "./types.js";

export const REPORT_LINE = "Full report with screenshots: attach the exported HTML.";

function fileOf(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/** "1st of 4 `<Button>` in `MemberRowMenu` (member-row-menu.tsx)". */
export function locationInWords(site: ProposalCallSite): string {
  const count = site.total === null ? ordinal(site.nth) : `${ordinal(site.nth)} of ${site.total}`;
  const where = site.enclosing ? ` in \`${site.enclosing}\`` : "";
  return `${count} \`<${site.component}>\`${where} (${fileOf(site.path)})`;
}

function changeLocation(change: ProposalChange): string {
  if (change.scope === "page") {
    const sites = change.callSites.length;
    return `Every \`<${change.component}>\` on the page (${sites} call site${sites === 1 ? "" : "s"}: ${change.callSites
      .map(locationInWords)
      .join("; ")})`;
  }
  const [site] = change.callSites;
  const where = site ? locationInWords(site) : `\`<${change.component}>\``;
  if (change.scope === "call-site") return `${where}, every Instance`;
  const instance = change.instances[0];
  return instance?.keyPath ? `${where}, Instance ${instance.keyPath}` : where;
}

function value(raw: unknown, text: boolean): string {
  if (text && typeof raw === "string") return `'${raw}'`;
  return formatCurrent(raw);
}

function propLine(prop: ProposalProp): string {
  const text = prop.name === "children";
  const name = text ? "Text" : `\`${prop.name}\``;
  const current = prop.currentCounts
    ? Object.entries(prop.currentCounts)
        .map(([shown, count]) => `${shown} ×${count}`)
        .join(", ")
    : "current" in prop
      ? value(prop.current, text)
      : "not set";
  const proposed = prop.proposedUnset ? "unset" : value(prop.proposed, text);
  const how =
    prop.writtenAs === "expression"
      ? prop.expression
        ? ` (written as an expression: \`${prop.expression}\`)`
        : " (written as an expression)"
      : prop.writtenAs === "spread"
        ? " (the call site spreads props)"
        : prop.writtenAs === "varies"
          ? " (written differently per call site)"
          : "";
  return `${name}: ${current} → ${proposed}${how}`;
}

function changeLine(change: ProposalChange): string {
  const parts = [`${changeLocation(change)}: ${change.props.map(propLine).join("; ")}`];
  if (change.needsCondition) parts.push(`**${change.needsCondition}**`);
  if (!change.onScreenAtExport) parts.push("not on screen at export");
  if (change.overriddenBy.length > 0) parts.push(`overridden by ${change.overriddenBy.join(", ")}`);
  return `- ${change.id}. ${parts.join(" · ")}`;
}

function routeLines(route: ProposalRoute, heading: boolean): string[] {
  const lines: string[] = [];
  if (heading) lines.push("", `### ${route.route}`, ...(route.url ? [route.url] : []));
  for (const change of route.changes) lines.push(changeLine(change));
  for (const state of route.statesShown) {
    const instance = state.keyPath ? `, Instance ${state.keyPath}` : "";
    const how = state.controlled ? `the app controls it via \`${state.appControlsVia}\`` : "the component owns this state";
    lines.push(
      `- State shown: \`${state.prop}\` held at ${formatCurrent(state.forced)} on \`<${state.component}>\`${instance} (${how}). Context, not a change.`,
    );
  }
  return lines;
}

export function proposalMarkdown(proposal: Proposal): string {
  const { project } = proposal;
  const commit = project.commit ? project.commit.slice(0, 7) : "unknown commit";
  const tree = project.dirty ? " (uncommitted changes)" : "";
  const lines = [`## ${proposal.title}`, ""];
  const single = proposal.routes.length === 1 ? proposal.routes[0] : undefined;
  if (single?.url) lines.push(single.url);
  lines.push(`${project.repo ?? "repo"}@${commit}${tree}${proposal.designer ? ` · by ${proposal.designer}` : ""}`);

  const changes = proposal.routes.reduce((sum, route) => sum + route.changes.length, 0);
  if (changes === 0 && proposal.routes.every((route) => route.statesShown.length === 0)) {
    lines.push("", "No changes proposed.");
  } else {
    if (single) lines.push("");
    for (const route of proposal.routes) lines.push(...routeLines(route, single === undefined));
  }

  if (proposal.heldForReview.length > 0) lines.push("");
  for (const held of proposal.heldForReview) {
    const props = held.props.map((prop) => `\`${prop.name}\``).join(", ");
    lines.push(`- Held for review, do not apply: \`<${held.component}>\` at ${held.anchor} (${props}). ${held.detail}.`);
  }
  lines.push("", REPORT_LINE);
  return `${lines.join("\n")}\n`;
}
