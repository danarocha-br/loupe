// The Instance registry: every mounted adapted Instance, and the Override store,
// which holds the self-check result and the view. One per page, in the page's slot
// (`slot.ts`), so a Fast Refresh that evaluates this module again finds the same
// Instances and Overrides.

import type { Fiber } from "./fiber.js";
import { internalsProblem } from "./fiber.js";
import { ANCHOR_ATTRIBUTE, parseHint, SOURCE_ATTRIBUTE, sharesBase, uniqueId } from "../call-site.js";
import { WRITES_ATTRIBUTE } from "../writes.js";
import type { PropMeta } from "../meta/types.js";
import type { CallSiteWrites } from "../writes.js";
import type { Split } from "./authored.js";
import { type PerPageOptions, perPage } from "./slot.js";
import {
  createOverrideStore,
  type InstanceIdentity,
  type OverrideStore,
  type Props,
  inScope,
  type View,
} from "./store.js";

export type MountedInstance = {
  /** Instance id (call-site.ts): the anchor, the app-authored key path when there is one, and `~n` for a duplicate. */
  id: string;
  /** The call-site id the loader wrote (`data-ds-anchor`). */
  anchor: string;
  /** `path:line:col n/total`, display only (`data-ds-source`), as of the latest commit. */
  readonly hint: string | null;
  component: string;
  keyPath: string;
  /**
   * The props the Instance receives right now, without the loader's attributes,
   * split into the app's own (the Current value) and what a library injected.
   */
  live(): Split;
  /** What the call site writes, from the loader's record; null when there is none. */
  writes(): CallSiteWrites | null;
  /** The component's State props (`X` with `onXChange`), from its metadata. */
  stateProps: readonly string[];
  /** Every prop the component declares, from `generate`'s metadata; null for an Adapter made without it. */
  meta: Readonly<Record<string, PropMeta>> | null;
  /** Per held State prop, the last value the component asked for through `onXChange`. */
  attempts: Map<string, unknown>;
  /** Rerender this Instance. */
  notify(): void;
  /** The fiber of the latest commit, to map a picked DOM node back. */
  readonly fiber: Fiber | null;
  /** How many times it has committed. */
  readonly renders: number;
  /**
   * The pathname it mounted on. At unmount, `location` may already be the next
   * page's: a client navigation changes it before the old page's cleanups run.
   */
  readonly route: string;
};

/** A MountedInstance with every field writable: only `register` and `committed` use it. */
type Writable = { -readonly [K in keyof MountedInstance]: MountedInstance[K] };

/** An Instance as it last rendered before it unmounted: what the Toolbar shows for a record it holds. */
export type LastSeen = {
  component: string;
  anchor: string;
  hint: string | null;
  /** The pathname it mounted on. */
  route: string;
  /** Its Current value (the app's own props) at its last commit. */
  current: Props;
};

export type Registry = {
  store: OverrideStore;
  instances: Map<string, MountedInstance>;
  /** Unmounted Instances an Instance-scope record still names, by id; pruned as records go. */
  departed: Map<string, LastSeen>;
  /** Called after an Instance mounts, unmounts or commits, an Override changes, or the status drops. */
  listeners: Set<() => void>;
  /**
   * Prop metadata from `meta/` for Instances with no Adapter, by call-site file and
   * imported name (PER-180). Filled by the Toolbar; empty until it loads any.
   */
  instanceMeta: Map<string, Readonly<Record<string, PropMeta>>>;
};

/** The page's registry, made on first use. */
export function registry(): Registry {
  return perPage("registry", createRegistry);
}

function createRegistry(): Registry {
  const problem = internalsProblem();
  const value: Registry = {
    store: createOverrideStore(problem === null ? {} : { status: { overrides: false, reason: problem } }),
    instances: new Map(),
    departed: new Map(),
    listeners: new Set(),
    instanceMeta: new Map(),
  };
  // Rerenders the Instances a store change can touch, and forgets departed ones no record names.
  value.store.subscribe((target) => {
    for (const instance of value.instances.values()) {
      if (inScope(target, identityOf(instance))) instance.notify();
    }
    const named = recordedIds(value.store);
    for (const id of value.departed.keys()) if (!named.has(id)) value.departed.delete(id);
    emitChange();
  });
  watchRoute();
  if (problem !== null) warnInspectOnly(problem);
  return value;
}

/**
 * Subscribes to the registry's changes: what the Toolbar redraws on. Listeners
 * are called synchronously, often from a commit, so they must only schedule work.
 */
export function onRegistryChange(listener: () => void): () => void {
  const { listeners } = registry();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChange(): void {
  for (const listener of registry().listeners) listener();
}

/** The page's route, as a page-scope Override keys it: the pathname. */
export function currentRoute(): string {
  return typeof location === "undefined" ? "" : location.pathname;
}

/** What the store matches an Instance's records on, on the current route. */
export function identityOf(
  instance: Pick<MountedInstance, "id" | "anchor" | "component" | "hint">,
): InstanceIdentity {
  return {
    id: instance.id,
    anchor: instance.anchor,
    component: instance.component,
    route: currentRoute(),
    total: parseHint(instance.hint)?.total ?? null,
  };
}

const WRAPPED = Symbol.for("loupe.historyWrapped");
const HISTORY_EVENT = "loupe:history";

/** Route watching outlives `resetLoupe()`, like the `history` wrap: it reads the registry of the moment. */
const ROUTE_ON_RESET: PerPageOptions<true> = { restart: (watching) => watching };

/**
 * Rerenders the Instances on the page after the pathname changes, while a page
 * Override is set: Instances that outlive a navigation (a layout's) come into its
 * Reach or fall out of it. Once per page, in the page's slot.
 */
function watchRoute(): void {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  perPage("routeWatch", startWatchingRoute, ROUTE_ON_RESET);
}

/**
 * Next's client navigations go through `history.pushState` and `replaceState`,
 * which fire no event, so both are wrapped to fire one. Next calls them from an
 * insertion effect, where React forbids scheduling updates, so the check waits
 * for a microtask. The check reads the registry of the moment, so a
 * `resetLoupe()` leaves no listener behind on an old one.
 */
function startWatchingRoute(): true {
  let last = currentRoute();
  const check = () => {
    const route = currentRoute();
    if (route === last) return;
    last = route;
    const value = registry();
    if (!value.store.records().some((record) => record.target.scope === "page")) return;
    for (const instance of value.instances.values()) instance.notify();
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method] as History["pushState"] & { [WRAPPED]?: true };
    if (original[WRAPPED]) continue;
    const wrapped = function (this: History, ...args: Parameters<History["pushState"]>) {
      original.apply(this, args);
      queueMicrotask(() => window.dispatchEvent(new Event(HISTORY_EVENT)));
    };
    Object.defineProperty(wrapped, WRAPPED, { value: true });
    history[method] = wrapped;
  }
  window.addEventListener(HISTORY_EVENT, check);
  window.addEventListener("popstate", check);
  return true;
}

/**
 * Switches every Instance between its Overrides and the app's own props (State-prop
 * Overrides kept, so an open dialog stays open). Rerenders are scheduled, not
 * flushed: wrap the call in `flushSync` to commit them at once.
 */
export function setView(view: View): void {
  const value = registry();
  if (!value.store.setView(view)) return;
  for (const instance of value.instances.values()) instance.notify();
}

/** Drops to inspect-only for the rest of the page's life. Fails closed. */
export function disableOverrides(reason: string): void {
  const value = registry();
  if (!value.store.disable(reason)) return;
  warnInspectOnly(reason);
  for (const instance of value.instances.values()) instance.notify();
  emitChange();
}

function warnInspectOnly(reason: string): void {
  console.warn(
    `[loupe] This React build isn't supported: Instances can't be identified reliably. Overrides are off and everything is inspect-only. (${reason})`,
  );
}

/** Ids an Instance-scope record holds. */
function recordedIds(store: OverrideStore): Set<string> {
  const ids = new Set<string>();
  for (const record of store.records()) if (record.target.scope === "instance") ids.add(record.target.id);
  return ids;
}

/**
 * Registers a mounted Instance under `baseId`, or `baseId~2`, `~3`… when another
 * mounted Instance already holds it (the same call site, rendered twice with no
 * key to tell them apart), and runs the hop guard. Returns the Instance, with the
 * id it got. `~n` is mount order, so a record naming any id of a duplicated base
 * is suspended.
 */
export function register(baseId: string, entry: Omit<MountedInstance, "id" | "renders" | "route">): MountedInstance {
  const { instances, departed, store } = registry();
  const id = uniqueId(baseId, instances);
  const instance: MountedInstance = { ...entry, id, renders: 1, route: currentRoute() };
  instances.set(id, instance);
  departed.delete(id);
  // Also when this one took the free base id while a `~n` is still mounted.
  const duplicated = [...instances.keys()].some((other) => other !== id && sharesBase(other, baseId));
  if (duplicated) store.suspendAmbiguous((named) => sharesBase(named, baseId));
  emitChange();
  observe(instance);
  return instance;
}

/**
 * What a committed render writes to a mounted Instance: the fiber and hint it
 * rendered with, and one more render. Then the hop guard runs, and the Toolbar
 * redraws, since its Current values are live.
 */
export function committed(instance: MountedInstance, fiber: Fiber | null, hint: string | null): void {
  const writable = instance as Writable;
  writable.fiber = fiber;
  writable.hint = hint;
  writable.renders++;
  observe(instance);
  emitChange();
}

/** The hop guard. Runs before paint, so a suspended Override is never shown. */
function observe(instance: MountedInstance): void {
  registry().store.observe({ id: instance.id, anchor: instance.anchor, total: parseHint(instance.hint)?.total ?? null });
}

export function unregister(instance: MountedInstance): void {
  const { instances, departed, store } = registry();
  if (instances.get(instance.id) !== instance) return;
  instances.delete(instance.id);
  // Kept only while a record holds it: the Toolbar lists nothing else that isn't mounted.
  if (recordedIds(store).has(instance.id)) {
    departed.set(instance.id, {
      component: instance.component,
      anchor: instance.anchor,
      hint: instance.hint,
      route: instance.route,
      current: instance.live().current,
    });
  }
  emitChange();
}

/** The app's props without the attributes the loader added to the call site. */
export function withoutLoaderProps(props: Props): Props {
  if (!(ANCHOR_ATTRIBUTE in props) && !(SOURCE_ATTRIBUTE in props) && !(WRITES_ATTRIBUTE in props)) return props;
  const { [ANCHOR_ATTRIBUTE]: _anchor, [SOURCE_ATTRIBUTE]: _source, [WRITES_ATTRIBUTE]: _writes, ...rest } = props;
  return rest;
}
