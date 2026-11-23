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
import { currentRoute, onRegistryChange, registry } from "../runtime/registry.js";
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
  // Registry listeners run inside a commit: read after it, and at most every
  // REFRESH_MS, so a page that rerenders often doesn't pay for a walk each commit.
  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      refreshTracker(tracker);
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
  const unwatch = onRegistryChange(schedule);
  tracker.stop = () => {
    unsubscribe();
    unwatch();
    if (timer !== null) clearTimeout(timer);
  };
  refreshTracker(tracker);
  return tracker;
}

/** Records every mounted Instance as it is now, and the current route's context. */
export function refreshTracker(tracker: Tracker): void {
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
    pageWidth() > 0 && window.innerHeight > 0 ? [pageWidth(), window.innerHeight] : null;
  return {
    url: location.href,
    viewport,
    dpr: window.devicePixelRatio,
    theme: pageTheme(),
    capturedAt: new Date().toISOString(),
  };
}
