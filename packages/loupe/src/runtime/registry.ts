// The Instance registry: every mounted adapted Instance, the Override store, and
// the self-check result. One per page, kept on `globalThis` so that a Fast
// Refresh that re-evaluates this module finds the same Instances and Overrides.

import type { Fiber } from "./fiber.js";
import { internalsProblem } from "./fiber.js";
import { createOverrideStore, type OverrideStore, type Props } from "./store.js";

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
  /** The props the app passes right now, without the loader's attributes. */
  current(): Props;
  /** Rerender this Instance. */
  notify(): void;
  /** The fiber of the latest render, to map a picked DOM node back. */
  fiber: Fiber | null;
  renders: number;
};

/** Overrides are disabled and everything is inspect-only while this is set. */
export type Status = { overrides: true } | { overrides: false; reason: string };

export type Registry = {
  store: OverrideStore;
  instances: Map<string, MountedInstance>;
  status: Status;
};

const GLOBAL_KEY = "__loupeRegistry";

export function registry(): Registry {
  const host = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Registry };
  let value = host[GLOBAL_KEY];
  if (!value) {
    const problem = internalsProblem();
    value = {
      store: createOverrideStore(),
      instances: new Map(),
      status: problem === null ? { overrides: true } : { overrides: false, reason: problem },
    };
    const created = value;
    created.store.subscribe((ids) => {
      for (const id of ids) created.instances.get(id)?.notify();
    });
    if (problem !== null) warnInspectOnly(problem);
    host[GLOBAL_KEY] = value;
  }
  return value;
}

/** Drops to inspect-only for the rest of the page's life. Fails closed. */
export function disableOverrides(reason: string): void {
  const value = registry();
  if (!value.status.overrides) return;
  value.status = { overrides: false, reason };
  warnInspectOnly(reason);
  for (const instance of value.instances.values()) instance.notify();
}

function warnInspectOnly(reason: string): void {
  console.warn(
    `[loupe] This React build isn't supported: Instances can't be identified reliably. Overrides are off and everything is inspect-only. (${reason})`,
  );
}

export function instanceId(anchor: string, keyPath: string): string {
  return keyPath === "" ? anchor : `${anchor}#${keyPath}`;
}

/**
 * Registers a mounted Instance under `baseId`, or `baseId~2`, `~3`… when another
 * mounted Instance already holds it (the same call site, rendered twice with no
 * key to tell them apart). Returns the id it got.
 */
export function register(baseId: string, entry: Omit<MountedInstance, "id">): MountedInstance {
  const { instances } = registry();
  const id = uniqueId(baseId, instances);
  const instance: MountedInstance = { ...entry, id };
  instances.set(id, instance);
  return instance;
}

/** `base`, or `base~2`, `~3`… when `taken` already holds it. */
export function uniqueId(base: string, taken: { has(id: string): boolean }): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}~${n}`;
  return id;
}

export function unregister(instance: MountedInstance): void {
  const { instances } = registry();
  if (instances.get(instance.id) === instance) instances.delete(instance.id);
}

/** The app's props without the attributes the loader added to the call site. */
export function withoutLoaderProps(props: Props): Props {
  if (!(ANCHOR_PROP in props) && !(SOURCE_PROP in props)) return props;
  const { [ANCHOR_PROP]: _anchor, [SOURCE_PROP]: _source, ...rest } = props;
  return rest;
}
