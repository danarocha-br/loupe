// The Override store: plain records, no React. Every scope rule lives here so it
// can be tested without rendering anything. Stage 1 has one scope, the Instance;
// group and page scopes (PER-122) add records of their own and extend `Source`.
//
// A record is keyed by Instance id, not by a mounted component, so it outlives an
// unmount or a remount (Fast Refresh, `router.refresh()`). Whether a record whose
// Instance is gone is shown, kept or suspended is the registry's business.

export type Props = Record<string, unknown>;

/** Where a resolved value came from: the app's own props, or an Override scope. */
export type Source = "app" | "instance";

export type Resolved = {
  /** What the component renders with: the Current value with Overrides on top. */
  props: Props;
  /** The source of every key in `props`. */
  sources: Record<string, Source>;
  /** The Overrides alone. */
  overrides: Props;
};

export type OverrideRecord = {
  scope: "instance";
  /** The Instance id. */
  target: string;
  values: Props;
};

export type StoreListener = (changedInstanceIds: readonly string[]) => void;

export type OverrideStore = {
  /** Overrides one prop on one Instance. `undefined` is a real Override: the prop is unset. */
  set(instanceId: string, prop: string, value: unknown): void;
  /** Drops one prop's Override, or every Override on the Instance; back to the Current value. */
  reset(instanceId: string, prop?: string): void;
  /** Props plus the source of each value, for an Instance whose app passes `current`. */
  resolve(instance: { id: string; current: Props }): Resolved;
  /** Whether anything overrides this Instance. */
  has(instanceId: string): boolean;
  records(): OverrideRecord[];
  subscribe(listener: StoreListener): () => void;
};

export function createOverrideStore(): OverrideStore {
  const instance = new Map<string, Map<string, unknown>>();
  const listeners = new Set<StoreListener>();

  const emit = (ids: string[]) => {
    for (const listener of listeners) listener(ids);
  };

  return {
    set(instanceId, prop, value) {
      let values = instance.get(instanceId);
      if (!values) {
        values = new Map();
        instance.set(instanceId, values);
      }
      if (values.has(prop) && Object.is(values.get(prop), value)) return;
      values.set(prop, value);
      emit([instanceId]);
    },

    reset(instanceId, prop) {
      const values = instance.get(instanceId);
      if (!values) return;
      if (prop === undefined) {
        instance.delete(instanceId);
      } else {
        if (!values.delete(prop)) return;
        if (values.size === 0) instance.delete(instanceId);
      }
      emit([instanceId]);
    },

    resolve({ id, current }) {
      const props: Props = { ...current };
      const sources: Record<string, Source> = {};
      for (const key of Object.keys(current)) sources[key] = "app";
      const overrides: Props = {};
      for (const [key, value] of instance.get(id) ?? []) {
        props[key] = value;
        overrides[key] = value;
        sources[key] = "instance";
      }
      return { props, sources, overrides };
    },

    has(instanceId) {
      return instance.has(instanceId);
    },

    records() {
      return [...instance].map(([target, values]) => ({
        scope: "instance" as const,
        target,
        values: Object.fromEntries(values),
      }));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
