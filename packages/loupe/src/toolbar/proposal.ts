// What the Proposal builder needs from the page (PER-135), gathered by the Toolbar:
// the store's records, what each Instance last showed (its Current value outlives
// its unmounting, as "last seen"), the route each record was set on, each route's
// URL, viewport and theme, previewed flags, and the project's commit.
//
// Nothing here writes to the store or the repo: exporting clears nothing.
// Once the Toolbar loads, `__loupe.proposal(options?)` returns the JSON and
// `__loupe.proposalMarkdown(options?)` the Copy as Markdown text. Snapshots that
// aren't Outdated ride along (PER-138); `{ capture: true }` takes one first.

import { buildProposalKeyed, type RouteContext, type Sighting, setOnKey } from "../proposal/build.js";
import { proposalMarkdown } from "../proposal/markdown.js";
import type { JsonValue, Proposal, ProposalProject } from "../proposal/types.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { currentRoute, onRegistryChange, registry } from "../runtime/registry.js";
import { previewedFlags } from "./flags.js";
import { readProjectContext } from "./project-server.js";
import { captureScreen, exportableSnapshots, exposeSnapshots } from "./snapshots.js";

export type ProposalOptions = {
  title?: string;
  designer?: string | null;
  /**
   * Take a Snapshot of the screen in view first, as an export does (PER-99 §3).
   * It replaces the previous export's Snapshot of this route. A failed capture
   * leaves the Proposal without it rather than failing.
   */
  capture?: boolean;
  /** Per record (`setOnKey`), the designer's note for its entry (PER-139). */
  notes?: Readonly<Record<string, string>>;
};

type Tracker = {
  /** The registry it watches: a new one (only ever in tests) starts a new tracker. */
  registry: object;
  sightings: Map<string, Sighting>;
  /** `setOnKey(target)` → the route it was first set on. */
  setOn: Record<string, string>;
  routes: Record<string, RouteContext>;
  stop: () => void;
};

const GLOBAL_KEY = "__loupeProposalTracker";
const REFRESH_MS = 100;

/** Starts remembering what the page shows, once per page; kept on `globalThis` across a Fast Refresh. */
export function startTracking(): Tracker {
  const host = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Tracker };
  const reg = registry();
  const existing = host[GLOBAL_KEY];
  if (existing?.registry === reg) return existing;
  existing?.stop();
  const tracker: Tracker = { registry: reg, sightings: new Map(), setOn: {}, routes: {}, stop: () => {} };
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Registry listeners run inside a commit: read after it, and at most every
  // REFRESH_MS, so a page that rerenders often doesn't pay for a walk each commit.
  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      refresh(tracker);
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
  const unwatch = onRegistryChange(schedule);
  tracker.stop = () => {
    unsubscribe();
    unwatch();
    if (timer !== null) clearTimeout(timer);
  };
  refresh(tracker);
  host[GLOBAL_KEY] = tracker;
  return tracker;
}

/** Records every mounted Instance as it is now, and the current route's context. */
function refresh(tracker: Tracker): void {
  const route = currentRoute();
  for (const instance of registry().instances.values()) {
    const previous = tracker.sightings.get(instance.id);
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
      routes: withRoute(previous?.routes ?? [], route),
      mounted: true,
    });
  }
  if (typeof window !== "undefined") tracker.routes[route] = routeContext();
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
    window.innerWidth > 0 && window.innerHeight > 0 ? [window.innerWidth, window.innerHeight] : null;
  return {
    url: location.href,
    viewport,
    dpr: window.devicePixelRatio,
    theme: pageTheme(),
    capturedAt: new Date().toISOString(),
  };
}

const UNKNOWN_PROJECT: ProposalProject = { repo: null, commit: null, dirty: null, playgroundVersion: null };

function debugOf(): LoupeDebug {
  return (window as typeof window & { __loupe?: LoupeDebug }).__loupe ?? createDebug();
}

/** "Button variant in MemberRowMenu", from the first change. */
export function suggestedTitle(proposal: Proposal): string {
  const change = proposal.routes.flatMap((route) => route.changes)[0];
  if (!change) return "Proposal";
  const props = change.props.map((prop) => (prop.name === "children" ? "text" : prop.name)).join(", ");
  const where = change.scope === "page" ? `on ${proposal.routes.find((route) => route.changes.includes(change))?.route}` : `in ${change.callSites[0]?.enclosing || change.component}`;
  return `${change.component} ${props} ${where}`;
}

/** The Proposal for the whole Override store, every route. */
export async function collectProposal(options: ProposalOptions = {}): Promise<Proposal> {
  return (await collectProposalKeyed(options)).proposal;
}

/** The Proposal, and per change id the record it reads: what the export dialog keeps notes against. */
export async function collectProposalKeyed(options: ProposalOptions = {}): Promise<{ proposal: Proposal; keys: Record<string, string> }> {
  if (options.capture) {
    await captureScreen({ auto: true }).catch((error: unknown) => {
      console.warn("[loupe] The export's Snapshot failed; exporting without it.", error);
    });
  }
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
      keyPath: entry.id.startsWith(`${entry.anchor}#`) ? entry.id.slice(entry.anchor.length + 1) : "",
      rendered: "server",
      current: entry.props,
      writes: null,
      stateProps: [],
      routes: [route],
      mounted: true,
    });
  }
  const [project, flags] = await Promise.all([
    readProjectContext().catch(() => UNKNOWN_PROJECT),
    previewedFlags().catch(() => []),
  ]);
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
    snapshots: exportableSnapshots(),
    notes: options.notes ?? {},
  };
  const { proposal, keys } = buildProposalKeyed(input);
  return { proposal: options.title?.trim() ? proposal : { ...proposal, title: suggestedTitle(proposal) }, keys };
}

/**
 * Copies the Markdown summary. The clipboard gets a promise, so the write is
 * claimed during the click even though building the Proposal awaits the server.
 */
export async function copyProposalMarkdown(options: ProposalOptions = {}): Promise<string> {
  const text = collectProposal(options).then(proposalMarkdown);
  try {
    if (typeof navigator.clipboard === "undefined") {
      throw new Error("The clipboard is only available on a secure origin, localhost or HTTPS.");
    }
    if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": text.then((markdown) => new Blob([markdown], { type: "text/plain" })) }),
      ]);
    } else {
      await navigator.clipboard.writeText(await text);
    }
  } catch (error) {
    // A browser that refuses the clipboard still leaves the summary somewhere to copy from.
    const markdown = await text;
    console.info(`[loupe] Proposal as Markdown:\n\n${markdown}`);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason} The Markdown is in the console.`);
  }
  return text;
}

/** Adds `proposal` and `proposalMarkdown` to `window.__loupe`, the acceptance surface. */
export function exposeProposal(): void {
  if (typeof window === "undefined") return;
  const debug = debugOf() as LoupeDebug & {
    proposal?: (options?: ProposalOptions) => Promise<Proposal>;
    proposalMarkdown?: (options?: ProposalOptions) => Promise<string>;
  };
  debug.proposal ??= collectProposal;
  debug.proposalMarkdown ??= (options) => collectProposal(options).then(proposalMarkdown);
}

// From the moment the Toolbar loads, not from the first export: a record set on
// another route, or an Instance that has since unmounted, is only known if seen.
if (typeof window !== "undefined") {
  startTracking();
  exposeProposal();
  exposeSnapshots();
}
