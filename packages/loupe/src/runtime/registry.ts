// The Instance registry: every mounted adapted Instance, the Override store, and
// the self-check result. One per page, kept on `globalThis` so that a Fast
// Refresh that re-evaluates this module finds the same Instances and Overrides.

import type { Fiber } from "./fiber.js";
import { internalsProblem } from "./fiber.js";
import { hintTotal } from "../call-site.js";
import { WRITES_ATTRIBUTE } from "../writes.js";
import type { PropMeta } from "../meta/types.js";
import type { CallSiteWrites } from "../writes.js";
import type { Split } from "./authored.js";
import {
  createOverrideStore,
  type InstanceIdentity,
  type OverrideStore,
  type Props,
  reaches,
  type Scope,
  type ScopeTarget,
} from "./store.js";

export const ANCHOR_PROP = "data-ds-anchor";
export const SOURCE_PROP = "data-ds-source";

/** Anchor for an Adapter rendered where the loader added none. */
export const UNANCHORED = "<unanchored>";

export type MountedInstance = {
  /** Instance id: the call-site anchor, then `#` and the app-authored key path when there is one. */
  id: string;
  /** The call-site id the loader wrote (`data-ds-anchor`). */
  anchor: string;
  /** `path:line:col n/total`, display only (`data-ds-source`). */
  hint: string | null;
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
  /** The fiber of the latest render, to map a picked DOM node back. */
  fiber: Fiber | null;
  renders: number;
};

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

/** Overrides are disabled and everything is inspect-only while this is set. */
export type Status = { overrides: true } | { overrides: false; reason: string };

export type Registry = {
  store: OverrideStore;
  instances: Map<string, MountedInstance>;
  /** Unmounted Instances an Instance-scope record still names, by id; pruned as records go. */
  departed: Map<string, LastSeen>;
  status: Status;
  /** Called after an Instance mounts, unmounts or commits, an Override changes, or the status drops. */
  listeners: Set<() => void>;
  /**
   * `before` renders every Instance as the app has it, keeping only State-prop
   * Overrides, for a Snapshot's "before" image (PER-138). The store is untouched.
   */
  view: View;
};

export type View = "proposed" | "before";

const GLOBAL_KEY = "__loupeRegistry";

export function registry(): Registry {
  const host = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Registry };
  let value = host[GLOBAL_KEY];
  // One made by an earlier version of this module, kept across a Fast Refresh.
  if (value && !value.listeners) value.listeners = new Set();
  if (value && !value.departed) value.departed = new Map();
  if (value && !value.view) value.view = "proposed";
  if (!value) {
    const problem = internalsProblem();
    value = {
      store: createOverrideStore(),
      instances: new Map(),
      departed: new Map(),
      status: problem === null ? { overrides: true } : { overrides: false, reason: problem },
      listeners: new Set(),
      view: "proposed",
    };
    const created = value;
    created.store.subscribe((target) => {
      for (const instance of created.instances.values()) {
        if (reaches(target, identityOf(instance))) instance.notify();
      }
      const named = recordedIds(created.store);
      for (const id of created.departed.keys()) if (!named.has(id)) created.departed.delete(id);
      emitChange();
    });
    watchRoute(() => {
      // A page Override is per route: Instances that outlive a navigation (a layout's)
      // stop or start matching one.
      if (!created.store.records().some((record) => record.target.scope === "page")) return;
      for (const instance of created.instances.values()) instance.notify();
    });
    if (problem !== null) warnInspectOnly(problem);
    host[GLOBAL_KEY] = value;
  }
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
  // Read off the global, not `registry()`, so a change while it is being created is a no-op.
  const value = (globalThis as typeof globalThis & { [GLOBAL_KEY]?: Registry })[GLOBAL_KEY];
  for (const listener of value?.listeners ?? []) listener();
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
    total: hintTotal(instance.hint),
  };
}

/** The record an Override on this Instance at `scope` goes into; null for a group with no call site. */
export function scopeTarget(
  instance: Pick<MountedInstance, "id" | "anchor" | "component">,
  scope: Scope,
): ScopeTarget | null {
  switch (scope) {
    case "instance":
      return { scope, id: instance.id };
    case "group":
      return instance.anchor.startsWith(UNANCHORED) ? null : { scope, anchor: instance.anchor };
    case "page":
      return { scope, route: currentRoute(), component: instance.component };
  }
}

const WRAPPED = Symbol.for("loupe.historyWrapped");
const HISTORY_EVENT = "loupe:history";

/**
 * Calls `onChange` after the pathname changes. Next's client navigations go through
 * `history.pushState`/`replaceState`, which fire no event, so both are wrapped once
 * per page to fire one. Next calls them from an insertion effect, where React
 * forbids scheduling updates, so the check waits for a microtask.
 */
function watchRoute(onChange: () => void): void {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  let last = currentRoute();
  const check = () => {
    const route = currentRoute();
    if (route === last) return;
    last = route;
    onChange();
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
}

/**
 * Switches every Instance between its Overrides and the app's own props (State-prop
 * Overrides kept, so an open dialog stays open). Rerenders are scheduled, not
 * flushed: wrap the call in `flushSync` to commit them at once.
 */
export function setView(view: View): void {
  const value = registry();
  if (value.view === view) return;
  value.view = view;
  for (const instance of value.instances.values()) instance.notify();
}

/** Drops to inspect-only for the rest of the page's life. Fails closed. */
export function disableOverrides(reason: string): void {
  const value = registry();
  if (!value.status.overrides) return;
  value.status = { overrides: false, reason };
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
 * The route each Instance mounted on. Read at unmount, `location` may already
 * be the next page's: a client navigation changes it before the old page's cleanups run.
 */
const mountedOn = new WeakMap<MountedInstance, string>();

export function instanceId(anchor: string, keyPath: string): string {
  return keyPath === "" ? anchor : `${anchor}#${keyPath}`;
}

/**
 * Registers a mounted Instance under `baseId`, or `baseId~2`, `~3`… when another
 * mounted Instance already holds it (the same call site, rendered twice with no
 * key to tell them apart). Returns the id it got.
 * `~n` is mount order, so a record naming any id of a duplicated base is suspended.
 */
export function register(baseId: string, entry: Omit<MountedInstance, "id">): MountedInstance {
  const { instances, departed, store } = registry();
  const id = uniqueId(baseId, instances);
  const instance: MountedInstance = { ...entry, id };
  instances.set(id, instance);
  mountedOn.set(instance, currentRoute());
  departed.delete(id);
  // Also when this one took the free base id while a `~n` is still mounted.
  const duplicated = [...instances.keys()].some((other) => other !== id && sharesBase(other, baseId));
  if (duplicated) store.suspendAmbiguous((named) => sharesBase(named, baseId));
  emitChange();
  return instance;
}

/** Whether `id` is `base` or one of its mount-order duplicates, `base~n`. */
export function sharesBase(id: string, base: string): boolean {
  return id === base || (id.startsWith(`${base}~`) && /^\d+$/.test(id.slice(base.length + 1)));
}

/** `base`, or `base~2`, `~3`… when `taken` already holds it. */
export function uniqueId(base: string, taken: { has(id: string): boolean }): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}~${n}`;
  return id;
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
      route: mountedOn.get(instance) ?? currentRoute(),
      current: instance.live().current,
    });
  }
  emitChange();
}

/** The app's props without the attributes the loader added to the call site. */
export function withoutLoaderProps(props: Props): Props {
  if (!(ANCHOR_PROP in props) && !(SOURCE_PROP in props) && !(WRITES_ATTRIBUTE in props)) return props;
  const { [ANCHOR_PROP]: _anchor, [SOURCE_PROP]: _source, [WRITES_ATTRIBUTE]: _writes, ...rest } = props;
  return rest;
}
