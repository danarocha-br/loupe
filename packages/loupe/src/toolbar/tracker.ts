// What the Proposal reads from the page as it goes (PER-135): what each Instance last
// showed (its Current value outlives its unmounting, as "last seen"), the route each
// record was set on, and each route's URL, viewport and theme. Split from
// `proposal.ts` (2026-11-23) so the collapsed pill can start it on the first change,
// in the same task as that change, without loading the open panel: an Instance edited
// through `__loupe` and gone before the panel's module loads is still known.
//
// It reads the runtime only, and keys records as the Proposal's `setOnKey` does
// (`changeKey`, `scope:keyOf(target)`).

import type { RouteContext, Sighting } from "../proposal/build.js";
import { currentRoute, type MountedInstance, onMountChange, registry } from "../runtime/registry.js";
import { type PerPageOptions, perPage } from "../runtime/slot.js";
import { pageWidth } from "./dock.js";
import { changeKey } from "./numbers.js";

export type Tracker = {
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
  // Proposal is collected (`refreshTracker`). Mount listeners run inside a commit:
  // the Instances wait here, and are read at most every REFRESH_MS.
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
    const key = changeKey(target);
    const exists = reg.store.records().some((record) => changeKey(record.target) === key);
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
  const navigated = () => setTimeout(() => refreshTracker(tracker), 0);
  if (typeof window !== "undefined") for (const type of ROUTE_EVENTS) window.addEventListener(type, navigated);
  tracker.stop = () => {
    unsubscribe();
    unwatch();
    if (typeof window !== "undefined") for (const type of ROUTE_EVENTS) window.removeEventListener(type, navigated);
    if (timer !== null) clearTimeout(timer);
  };
  refreshTracker(tracker);
  return tracker;
}

/** Records every mounted Instance as it is now, and the current route's context. */
export function refreshTracker(tracker: Tracker): void {
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
