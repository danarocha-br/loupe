// What the Proposal builder needs from the page (PER-135), gathered by the Toolbar:
// the store's records, what each Instance last showed (its Current value outlives
// its unmounting, as "last seen"), the route each record was set on, each route's
// URL, viewport and theme, previewed flags, and the project's commit.
//
// Nothing here writes to the store or the repo: copying clears nothing.
// Once the Toolbar loads, `__loupe.proposal(options?)` returns the JSON and
// `__loupe.proposalText(options?)` the Copy Proposal text (`start.ts`).

import { parseInstanceId } from "../call-site.js";
import { buildProposalKeyed, type RouteContext, type Sighting, setOnKey } from "../proposal/build.js";
import { proposalText } from "../proposal/text.js";
import type { JsonValue, Proposal, ProposalProject } from "../proposal/types.js";
import { debugOf } from "../runtime/debug.js";
import { currentRoute, type MountedInstance, onMountChange, registry } from "../runtime/registry.js";
import { type PerPageOptions, perPage } from "../runtime/slot.js";
import { pageWidth } from "./dock.js";
import { previewedFlags } from "./flags-store.js";
import { numberChanges } from "./numbers.js";
import { readProjectContext } from "./project-server.js";

export type ProposalOptions = {
  title?: string;
  designer?: string | null;
  /** Per record (`setOnKey`), the designer's note for its entry (PER-139). */
  notes?: Readonly<Record<string, string>>;
};

type Tracker = {
  sightings: Map<string, Sighting>;
  /** `setOnKey(target)` → the route it was first set on. */
  setOn: Record<string, string>;
  routes: Record<string, RouteContext>;
  stop: () => void;
};

const REFRESH_MS = 100;

/** The events `registry.ts` fires on a client navigation (`pushState`, `replaceState`) and on back or forward. */
const ROUTE_EVENTS = ["loupe:history", "popstate"] as const;

const ON_RESET: PerPageOptions<Tracker> = { stop: (tracker) => tracker.stop() };

/**
 * Starts remembering what the page shows, once per page. The tracker is kept in the
 * page's slot across a Fast Refresh, and `resetLoupe()` stops it.
 */
export function startTracking(): Tracker {
  return perPage("tracker", makeTracker, ON_RESET);
}

function makeTracker(): Tracker {
  const reg = registry();
  const tracker: Tracker = { sightings: new Map(), setOn: {}, routes: {}, stop: () => {} };
  let timer: ReturnType<typeof setTimeout> | null = null;
  // What a Proposal needs of an Instance is where it was seen and how it last
  // looked, so the tracker hears of Instances mounting and unmounting, and of the
  // route changing, not of every commit: a mounted Instance is read again when a
  // Proposal is collected. Mount listeners run inside a commit: the Instances wait
  // here, and are read at most every REFRESH_MS.
  const pending = new Set<MountedInstance>();
  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      const instances = [...pending];
      pending.clear();
      for (const instance of instances) see(tracker, instance, reg.instances.get(instance.id) === instance);
      if (typeof window !== "undefined") tracker.routes[currentRoute()] = routeContext();
    }, REFRESH_MS);
  };
  const unsubscribe = reg.store.subscribe((target) => {
    if (target.scope === "page") return;
    const key = setOnKey(target);
    const exists = reg.store.records().some((record) => setOnKey(record.target) === key);
    // A record set again after it was dropped belongs to the route it is set on now.
    if (!exists) delete tracker.setOn[key];
    else if (!(key in tracker.setOn)) tracker.setOn[key] = currentRoute();
  });
  const unwatch = onMountChange((instance, mounted) => {
    // At unmount the Instance is read now: its last Current value is what it showed.
    if (mounted) pending.add(instance);
    else {
      pending.delete(instance);
      see(tracker, instance, false);
    }
    schedule();
  });
  // An Instance that outlives a navigation (a layout's) is seen on the next route too.
  const navigated = () => setTimeout(() => refresh(tracker), 0);
  if (typeof window !== "undefined") for (const type of ROUTE_EVENTS) window.addEventListener(type, navigated);
  tracker.stop = () => {
    unsubscribe();
    unwatch();
    if (typeof window !== "undefined") for (const type of ROUTE_EVENTS) window.removeEventListener(type, navigated);
    if (timer !== null) clearTimeout(timer);
  };
  refresh(tracker);
  return tracker;
}

/** Records every mounted Instance as it is now, and the current route's context. */
function refresh(tracker: Tracker): void {
  for (const instance of registry().instances.values()) see(tracker, instance, true);
  if (typeof window !== "undefined") tracker.routes[currentRoute()] = routeContext();
}

/**
 * Records an Instance as it is now. A mounted one is seen on the current route;
 * one unmounting isn't, as `location` may already be the next page's.
 */
function see(tracker: Tracker, instance: MountedInstance, mounted: boolean): void {
  const previous = tracker.sightings.get(instance.id);
  const routes = previous?.routes ?? [instance.route];
  tracker.sightings.set(instance.id, {
    id: instance.id,
    anchor: instance.anchor,
    hint: instance.hint,
    component: instance.component,
    keyPath: instance.keyPath,
    rendered: "client",
    current: instance.live().current,
    writes: instance.writes(),
    stateProps: instance.stateProps,
    routes: mounted ? withRoute(routes, currentRoute()) : routes,
    mounted,
  });
}

function withRoute(routes: readonly string[], route: string): string[] {
  return [...routes.filter((entry) => entry !== route), route];
}

/** Light or dark, from the class or attribute a theme switcher sets, else the color scheme in effect. */
export function pageTheme(root: Element = document.documentElement): "light" | "dark" | null {
  const classes = root.classList;
  if (classes.contains("dark")) return "dark";
  if (classes.contains("light")) return "light";
  const attribute = root.getAttribute("data-theme") ?? root.getAttribute("data-mode");
  if (attribute === "dark" || attribute === "light") return attribute;
  const scheme = getComputedStyle(root).colorScheme;
  if (scheme === "dark" || scheme === "light") return scheme;
  if (typeof matchMedia === "function") return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return null;
}

function routeContext(): RouteContext {
  // A hidden tab can report 0×0: no viewport rather than a wrong one.
  const viewport: [number, number] | null =
    pageWidth() > 0 && window.innerHeight > 0 ? [pageWidth(), window.innerHeight] : null;
  return {
    url: location.href,
    viewport,
    dpr: window.devicePixelRatio,
    theme: pageTheme(),
    capturedAt: new Date().toISOString(),
  };
}

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
  refresh(tracker);
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
