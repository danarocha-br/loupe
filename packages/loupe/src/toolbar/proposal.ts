// What the Proposal builder needs from the page (PER-135), gathered by the Toolbar:
// the store's records, what each Instance last showed (its Current value outlives
// its unmounting, as "last seen"), the route each record was set on, each route's
// URL, viewport and theme, previewed flags, and the project's commit.
//
// Nothing here writes to the store or the repo: copying clears nothing.
// Once the Toolbar loads, `__loupe.proposal(options?)` returns the JSON and
// `__loupe.proposalText(options?)` the Copy Proposal text (`start.ts`).

import { parseInstanceId } from "../call-site.js";
import { buildProposalKeyed, type Sighting } from "../proposal/build.js";
import { proposalText } from "../proposal/text.js";
import type { JsonValue, Proposal, ProposalProject } from "../proposal/types.js";
import { debugOf } from "../runtime/debug.js";
import { currentRoute, registry } from "../runtime/registry.js";
import { previewedFlags } from "./flags-store.js";
import { numberChanges } from "./numbers.js";
import { readProjectContext } from "./project-server.js";
import { refreshTracker, startTracking } from "./tracker.js";

// The tracker (what each Instance last showed, the route each record was set on) is
// `tracker.ts`'s: the collapsed pill starts it on the first change, before this module loads.
export { pageTheme, startTracking } from "./tracker.js";

export type ProposalOptions = {
  title?: string;
  designer?: string | null;
  /** Per record (`setOnKey`), the designer's note for its entry (PER-139). */
  notes?: Readonly<Record<string, string>>;
};

const UNKNOWN_PROJECT: ProposalProject = { repo: null, commit: null, dirty: null, playgroundVersion: null, install: null };

/** "Button variant in MemberRowMenu", from the first change. */
export function suggestedTitle(proposal: Proposal): string {
  const change = proposal.routes.flatMap((route) => route.changes)[0];
  if (!change) return "Proposal";
  const props = change.props.map((prop) => (prop.name === "children" ? "text" : prop.name)).join(", ");
  const where = change.scope === "page" ? `on ${proposal.routes.find((route) => route.changes.includes(change))?.route}` : `in ${change.callSites[0]?.enclosing || change.component}`;
  return `${change.component} ${props} ${where}`;
}

/** The Copy Proposal text (ADR 0002). */
export function collectProposalText(options: ProposalOptions = {}): Promise<string> {
  return collectProposal(options).then(proposalText);
}

/** The Proposal for the whole Override store, every route. */
export async function collectProposal(options: ProposalOptions = {}): Promise<Proposal> {
  return (await collectProposalKeyed(options)).proposal;
}

/** The Proposal, and per change id the record it reads: what the export dialog keeps notes against. */
export async function collectProposalKeyed(options: ProposalOptions = {}): Promise<{ proposal: Proposal; keys: Record<string, string> }> {
  const tracker = startTracking();
  refreshTracker(tracker);
  const reg = registry();
  const mounted = new Set(reg.instances.keys());
  const route = currentRoute();
  const sightings: Sighting[] = [...tracker.sightings.values()].map((sighting) => ({
    ...sighting,
    mounted: mounted.has(sighting.id),
  }));
  // Server-rendered Instances leave no trace in the registry: read them from the page now.
  for (const entry of debugOf().scan()) {
    sightings.push({
      id: entry.id,
      anchor: entry.anchor,
      hint: entry.hint,
      component: entry.component,
      keyPath: parseInstanceId(entry.id).key,
      rendered: "server",
      current: entry.props,
      writes: null,
      stateProps: [],
      routes: [route],
      mounted: true,
    });
  }
  // A restarting dev server refuses the project call: the Proposal says "unknown commit". Flags
  // never reject: `previewedFlags` answers a failed read with the previews it last read, or none.
  const [project, flags] = await Promise.all([readProjectContext().catch(() => UNKNOWN_PROJECT), previewedFlags()]);
  const input = {
    title: options.title?.trim() || "Proposal",
    designer: options.designer ?? null,
    createdAt: new Date().toISOString(),
    project,
    records: reg.store.records(),
    sightings,
    setOn: tracker.setOn,
    routes: tracker.routes,
    currentRoute: route,
    flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.value as JsonValue])),
    notes: options.notes ?? {},
    // The numbers the page shows: c2 is the change marked Δ2.
    number: numberChanges,
  };
  const { proposal, keys } = buildProposalKeyed(input);
  return { proposal: options.title?.trim() ? proposal : { ...proposal, title: suggestedTitle(proposal) }, keys };
}
