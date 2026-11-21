// Copy Proposal (ADR 0002): the one text a designer hands to a coding agent, or to an
// engineer. The rules first, then one line per change under what the agent does with
// it (Apply, Ask first, Context, Don't apply), then the Proposal's JSON, which
// `loupe locate` reads back. Pure: a string from a Proposal.

import { formatCurrent, plural } from "../toolbar/format.js";
import type { Proposal, ProposalCallSite, ProposalChange, ProposalHeld, ProposalProp, ProposalRoute, ProposalStateShown } from "./types.js";
import { ACTION_WORDS, propInWords, reachInWords, siteCount } from "./words.js";

export const INTRO = "A Loupe Proposal: changes a designer tried on the running app. Apply exactly these, nothing else.";

export const SECTIONS = {
  apply: ACTION_WORDS.apply,
  askFirst: ACTION_WORDS["ask-first"],
  context: `${ACTION_WORDS.context}, change no code`,
  held: `${ACTION_WORDS.held}, held for review`,
  json: "Proposal JSON",
} as const;

function fileOf(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/** "1st of 4 `<Button>` in `MemberRowMenu` (member-row-menu.tsx)". */
export function locationInWords(site: ProposalCallSite): string {
  const where = site.enclosing ? ` in \`${site.enclosing}\`` : "";
  return `${siteCount(site)} \`<${site.component}>\`${where} (${fileOf(site.path)})`;
}

function changeLocation(change: ProposalChange): string {
  if (change.scope === "page") {
    return `Every \`<${change.component}>\` on the page (${plural(change.callSites.length, "call site")}: ${change.callSites
      .map(locationInWords)
      .join("; ")})`;
  }
  const [site] = change.callSites;
  const where = site ? locationInWords(site) : `\`<${change.component}>\``;
  return `${where}, ${reachInWords(change, change.instances[0]?.keyPath)}`;
}

function value(raw: unknown, text: boolean): string {
  if (text && typeof raw === "string") return `'${raw}'`;
  return formatCurrent(raw);
}

/** "`variant`: "ghost" → "outline"". How it is written goes in the reasons to ask first. */
function propLine(prop: ProposalProp): string {
  const text = prop.name === "children";
  const name = propInWords(prop.name);
  const current = prop.currentCounts
    ? Object.entries(prop.currentCounts)
        .map(([shown, count]) => `${shown} ×${count}`)
        .join(", ")
    : "current" in prop
      ? value(prop.current, text)
      : "not set";
  const proposed = prop.proposedUnset ? "unset" : value(prop.proposed, text);
  const added = prop.writtenAs === "unset" && !prop.proposedUnset ? " (not written at the call site yet: add it)" : "";
  return `${name}: ${current} → ${proposed}${added}`;
}

function changeLine(change: ProposalChange, route: string | null): string {
  const parts = [`${changeLocation(change)}: ${change.props.map(propLine).join("; ")}`];
  if (route) parts.push(`set on \`${route}\``);
  if (change.alsoRendersOn.length > 0) parts.push(`also renders on ${change.alsoRendersOn.map((other) => `\`${other}\``).join(", ")}`);
  if (!change.onScreenAtExport) parts.push("not on screen when copied");
  if (change.overriddenBy.length > 0) parts.push(`overridden by ${change.overriddenBy.join(", ")} where both reach`);
  if (change.action === "ask-first") parts.push(`Ask because: ${change.askFirst.join("; ")}`);
  if (change.note) parts.push(`Note: ${JSON.stringify(change.note)}`);
  return `- ${change.id}. ${parts.join(" · ")}`;
}

function stateLine(state: ProposalStateShown, route: string | null): string {
  const instance = state.keyPath ? `, Instance ${state.keyPath}` : "";
  const how = state.controlled ? `the app controls it via \`${state.appControlsVia}\`` : "the component owns this state";
  const where = route ? ` on \`${route}\`` : "";
  return `- State shown: \`${state.prop}\` held at ${formatCurrent(state.forced)} on \`<${state.component}>\`${instance}${where} (${how}).`;
}

function heldLine(held: ProposalHeld): string {
  const props = held.props
    .map((prop) => `\`${prop.name}\` → ${prop.proposedUnset ? "unset" : formatCurrent(prop.proposed)}`)
    .join(", ");
  return `- \`<${held.component}>\` at ${held.anchor} (${props}). ${held.detail}.`;
}

/** A fence longer than any run of backticks inside, so a note can't close it. */
function fenceFor(body: string): string {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((match) => match[0].length));
  return "`".repeat(Math.max(3, longest + 1));
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : ["", `## ${title}`, ...lines];
}

/** The Copy Proposal text: what the designer pastes into their agent. */
export function proposalText(proposal: Proposal): string {
  const { project } = proposal;
  const commit = project.commit ? project.commit.slice(0, 7) : "unknown commit";
  const tree = project.dirty ? " (uncommitted changes)" : "";
  const lines = [`# ${proposal.title}`, `${project.repo ?? "repo"}@${commit}${tree}${proposal.designer ? ` · by ${proposal.designer}` : ""}`];

  const several = proposal.routes.length > 1;
  const [only] = proposal.routes;
  if (!several && only?.url) lines.push(only.url);
  if (several) lines.push(`Pages: ${proposal.routes.map((route) => (route.url ? `\`${route.route}\` ${route.url}` : `\`${route.route}\``)).join(", ")}`);

  lines.push("", INTRO, "", "Rules", ...proposal.howToApply.split("\n").map((rule) => `- ${rule}`));

  const where = (route: ProposalRoute) => (several ? route.route : null);
  const changes = proposal.routes.flatMap((route) => route.changes.map((change) => ({ change, route })));
  const apply = changes.filter(({ change }) => change.action === "apply").map(({ change, route }) => changeLine(change, where(route)));
  const askFirst = changes.filter(({ change }) => change.action === "ask-first").map(({ change, route }) => changeLine(change, where(route)));
  const context = proposal.routes.flatMap((route) => route.statesShown.map((state) => stateLine(state, where(route))));
  const flags = Object.entries(only?.flags ?? {});
  if (flags.length > 0) context.push(`- ${flags.length === 1 ? "Flag preview" : "Flag previews"}: ${flags.map(([key, flag]) => `\`${key}\` = ${formatCurrent(flag)}`).join(", ")}.`);
  const held = proposal.heldForReview.map(heldLine);

  if (changes.length === 0 && context.length === 0 && held.length === 0) lines.push("", "No changes proposed.");
  lines.push(...section(SECTIONS.apply, apply), ...section(SECTIONS.askFirst, askFirst));
  lines.push(...section(SECTIONS.context, context), ...section(SECTIONS.held, held));

  const json = JSON.stringify(proposal, null, 2);
  const fence = fenceFor(json);
  lines.push("", `## ${SECTIONS.json}`, `${fence}json`, json, fence);
  return `${lines.join("\n")}\n`;
}
