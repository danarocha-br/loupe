// The Override store: plain records, no React, so every scope rule is testable
// without rendering.
//
// One record per scope target: an Instance, a call-site group (one call site, on
// any route) or a page (one component on one route). Per prop the narrowest scope
// wins: Instance > group > page. A group or page record has its own exclusions,
// by Instance id; an excluded Instance falls through to the next scope. Records
// are keyed by ids, not mounted components, so they outlive a remount and reach
// Instances that mount later.

export type Props = Record<string, unknown>;

/** Where a resolved value came from: the app's own props, or an Override scope. */
export type Source = "app" | "instance" | "group" | "page";

export type Scope = Exclude<Source, "app">;

/** What one Override record applies to. */
export type ScopeTarget =
  | { scope: "instance"; id: string }
  /** The call-site id (`data-ds-anchor`). */
  | { scope: "group"; anchor: string }
  /** `route` is the page's pathname. */
  | { scope: "page"; route: string; component: string };

/** Which records can reach an Instance. */
export type InstanceIdentity = {
  id: string;
  anchor: string;
  component: string;
  /** The pathname of the page the Instance renders on. */
  route: string;
};

/** What the store needs to resolve an Instance. */
export type InstanceKey = InstanceIdentity & {
  /** The props the app passes right now. */
  current: Props;
};

export type Resolved = {
  /** What the component renders with: the Current value with Overrides on top. */
  props: Props;
  /** The source of every key in `props`. */
  sources: Record<string, Source>;
  /** The Overrides alone, each from the scope that won. */
  overrides: Props;
};

export type OverrideRecord = {
  target: ScopeTarget;
  values: Props;
  /** Instance ids this record skips. Always empty for an Instance record. */
  excluded: string[];
};

/** Called with the target a change was made to; `reaches` says which Instances it affects. */
export type StoreListener = (changed: ScopeTarget) => void;

export type OverrideStore = {
  /** Overrides one prop for a scope target. `undefined` is a real Override: the prop is unset. */
  set(target: ScopeTarget, prop: string, value: unknown): void;
  /**
   * Drops one prop's Override from this scope target only. With no prop, drops the
   * whole record, exclusions included.
   */
  reset(target: ScopeTarget, prop?: string): void;
  /** Keeps a group or page record from reaching one Instance. */
  exclude(target: ScopeTarget, instanceId: string): void;
  /** Undoes `exclude`. */
  include(target: ScopeTarget, instanceId: string): void;
  /** Props plus the scope each value came from. */
  resolve(instance: InstanceKey): Resolved;
  /** Whether any Override reaches this Instance. */
  applies(instance: InstanceIdentity): boolean;
  /** Instance records first, then group, then page. */
  records(): OverrideRecord[];
  subscribe(listener: StoreListener): () => void;
};

/** Narrowest first, the order `records()` lists them in (`targetsOf` keeps the same order). */
const PRECEDENCE: readonly Scope[] = ["instance", "group", "page"];

/** Whether a record for `target` reaches this Instance, exclusions aside. */
export function reaches(target: ScopeTarget, instance: InstanceIdentity): boolean {
  switch (target.scope) {
    case "instance":
      return target.id === instance.id;
    case "group":
      return target.anchor === instance.anchor;
    case "page":
      return target.route === instance.route && target.component === instance.component;
  }
}

/** The record's key within its scope. */
function keyOf(target: ScopeTarget): string {
  switch (target.scope) {
    case "instance":
      return target.id;
    case "group":
      return target.anchor;
    case "page":
      return JSON.stringify([target.route, target.component]);
  }
}

/** The three targets that can reach an Instance, narrowest first. */
function targetsOf(instance: InstanceIdentity): ScopeTarget[] {
  return [
    { scope: "instance", id: instance.id },
    { scope: "group", anchor: instance.anchor },
    { scope: "page", route: instance.route, component: instance.component },
  ];
}

type Entry = { target: ScopeTarget; values: Map<string, unknown>; excluded: Set<string> };

export function createOverrideStore(): OverrideStore {
  const scopes: Record<Scope, Map<string, Entry>> = {
    instance: new Map(),
    group: new Map(),
    page: new Map(),
  };
  const listeners = new Set<StoreListener>();

  const emit = (changed: ScopeTarget) => {
    for (const listener of listeners) listener(changed);
  };

  const find = (target: ScopeTarget): Entry | undefined => scopes[target.scope].get(keyOf(target));

  const findOrCreate = (target: ScopeTarget): Entry => {
    let entry = find(target);
    if (!entry) {
      entry = { target: { ...target }, values: new Map(), excluded: new Set() };
      scopes[target.scope].set(keyOf(target), entry);
    }
    return entry;
  };

  const dropIfEmpty = (entry: Entry) => {
    if (entry.values.size === 0 && entry.excluded.size === 0) {
      scopes[entry.target.scope].delete(keyOf(entry.target));
    }
  };

  /** The records that reach this Instance, narrowest first. */
  const reaching = (instance: InstanceIdentity): Entry[] =>
    targetsOf(instance)
      .map(find)
      .filter((entry): entry is Entry => entry !== undefined && !entry.excluded.has(instance.id));

  const requireExcludable = (target: ScopeTarget) => {
    if (target.scope === "instance") {
      throw new Error("[loupe] Only a group or page Override can exclude an Instance.");
    }
  };

  return {
    set(target, prop, value) {
      const entry = findOrCreate(target);
      if (entry.values.has(prop) && Object.is(entry.values.get(prop), value)) return;
      entry.values.set(prop, value);
      emit(target);
    },

    reset(target, prop) {
      const entry = find(target);
      if (!entry) return;
      if (prop === undefined) {
        scopes[target.scope].delete(keyOf(target));
      } else {
        if (!entry.values.delete(prop)) return;
        dropIfEmpty(entry);
      }
      emit(target);
    },

    exclude(target, instanceId) {
      requireExcludable(target);
      const entry = findOrCreate(target);
      if (entry.excluded.has(instanceId)) return;
      entry.excluded.add(instanceId);
      emit({ scope: "instance", id: instanceId });
    },

    include(target, instanceId) {
      requireExcludable(target);
      const entry = find(target);
      if (!entry?.excluded.delete(instanceId)) return;
      dropIfEmpty(entry);
      emit({ scope: "instance", id: instanceId });
    },

    resolve(instance) {
      const props: Props = { ...instance.current };
      const sources: Record<string, Source> = {};
      for (const key of Object.keys(instance.current)) sources[key] = "app";
      const overrides: Props = {};
      // Widest first, so a narrower scope overwrites it.
      for (const entry of reaching(instance).reverse()) {
        for (const [key, value] of entry.values) {
          props[key] = value;
          overrides[key] = value;
          sources[key] = entry.target.scope;
        }
      }
      return { props, sources, overrides };
    },

    applies(instance) {
      return reaching(instance).some((entry) => entry.values.size > 0);
    },

    records() {
      return PRECEDENCE.flatMap((scope) =>
        [...scopes[scope].values()].map((entry) => ({
          target: { ...entry.target },
          values: Object.fromEntries(entry.values),
          excluded: [...entry.excluded],
        })),
      );
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
