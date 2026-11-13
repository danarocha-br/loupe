// Override resolution: the one authority on what applies to an Instance now.
// Plain records, no React, no globals, so every rule is testable without rendering.
//
// It holds the Override records, whether Overrides are on at all (the React
// self-check), and the view (the page as proposed, or the "before" view a Snapshot
// captures). It answers two questions: what an Instance renders with (`resolve`,
// `render`), and which Instances a record reaches (`reachOf`).
//
// One record per scope target: an Instance, a call-site group (one call site, on
// any route) or a page (one component on one route). Per prop the narrowest scope
// wins: Instance > group > page. A group or page record has its own exclusions,
// by Instance id; an excluded Instance falls through to the next scope. Records
// are keyed by ids, not mounted components, so they outlive a remount and reach
// Instances that mount later.
//
// A record pins the total of each call site it names. A changed total, or an id
// that more than one mounted Instance holds, suspends it: never rebound to a guess.

import { isUnanchored } from "../call-site.js";

export type Props = Record<string, unknown>;

/** Overrides are disabled and everything is inspect-only while `overrides` is false. */
export type Status = { overrides: true } | { overrides: false; reason: string };

/**
 * `before` renders every Instance as the app has it, keeping only State-prop
 * Overrides, for a Snapshot's "before" image (PER-138). The records are untouched.
 */
export type View = "proposed" | "before";

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
  /** Uses of this component in its enclosing component, as rendered now. Null when unanchored. */
  total?: number | null;
};

/** A call site as one Instance just rendered it: what the hop guard checks records against. */
export type CallSiteSeen = { id: string; anchor: string; total: number | null };

/** Why a record stopped applying until it is reapplied or discarded. */
export type Suspension =
  /** "Code changed here, review": the call site's total moved from `was` to `now`. */
  | { reason: "code-changed"; anchor: string; was: number; now: number }
  /** "Matches N Instances, review": these ids each name more than one mounted Instance. Discard only. */
  | { reason: "ambiguous"; ids: string[] };

/** What the store needs to resolve an Instance. */
export type InstanceKey = InstanceIdentity & {
  /** The props the app passes right now. */
  current: Props;
};

/** What the Adapter needs to render an Instance: its State props stay held in the "before" view. */
export type RenderKey = InstanceKey & { stateProps: readonly string[] };

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
  suspended: Suspension | null;
};

/** Called with the target a change was made to; `reaches` says which Instances it affects. */
export type StoreListener = (changed: ScopeTarget) => void;

export type OverrideStore = {
  /** Whether Overrides are on. Every write throws while they are off. */
  readonly status: Status;
  /** Drops to inspect-only for good. False when Overrides were already off. */
  disable(reason: string): boolean;
  readonly view: View;
  /** Switches the view `render` uses. False when it was already that view. */
  setView(view: View): boolean;
  /**
   * Overrides one prop for a scope target. `undefined` is a real Override: the prop
   * is unset. Throws on a suspended record.
   */
  set(target: ScopeTarget, prop: string, value: unknown): void;
  /**
   * Drops one prop's Override from this scope target only. With no prop, drops the
   * whole record, exclusions included.
   */
  reset(target: ScopeTarget, prop?: string): void;
  /** Keeps a group or page record from reaching one Instance. Throws on a suspended record. */
  exclude(target: ScopeTarget, instanceId: string): void;
  /** Undoes `exclude`. */
  include(target: ScopeTarget, instanceId: string): void;
  /**
   * Props plus the scope each value came from, in the proposed view. With Overrides
   * off, the Current value alone, every value from the app.
   */
  resolve(instance: InstanceKey): Resolved;
  /** What the Adapter renders with: `resolve`, or in the "before" view only its State-prop Overrides. */
  render(instance: RenderKey): Resolved;
  /** Whether any Override reaches this Instance. False while Overrides are off. */
  applies(instance: InstanceIdentity): boolean;
  /** Instance records first, then group, then page. */
  records(): OverrideRecord[];
  /** Suspends every record pinned to another total at this call site. */
  observe(site: CallSiteSeen): void;
  /** Suspends every record naming an id that `ambiguous` matches. */
  suspendAmbiguous(ambiguous: (id: string) => boolean): void;
  /** Pins a "code changed" record to its call sites' current totals and applies it again. */
  reapply(target: ScopeTarget): void;
  subscribe(listener: StoreListener): () => void;
};

/** Narrowest first, the order `records()` lists them in (`targetsOf` keeps the same order). */
export const PRECEDENCE: readonly Scope[] = ["instance", "group", "page"];

/** The error every write throws while Overrides are off. */
export function assertOverridesOn(status: Status): void {
  if (!status.overrides) {
    throw new Error(`[loupe] Overrides are off, everything is inspect-only: ${status.reason}`);
  }
}

/**
 * The record an Override on this Instance at `scope` goes into; null for a group
 * with no call site. Throws on an unknown scope.
 */
export function targetAt(
  instance: Pick<InstanceIdentity, "id" | "anchor" | "component" | "route">,
  scope: Scope,
): ScopeTarget | null {
  switch (scope) {
    case "instance":
      return { scope, id: instance.id };
    case "group":
      return isUnanchored(instance.anchor) ? null : { scope, anchor: instance.anchor };
    case "page":
      return { scope, route: instance.route, component: instance.component };
    default:
      throw new Error(`[loupe] Unknown scope ${JSON.stringify(scope)}: use "instance", "group" or "page".`);
  }
}

/** What Reach is judged on: a record's target, who it leaves out, and whether it is suspended. */
export type ReachRecord = Pick<OverrideRecord, "target" | "excluded" | "suspended">;

/**
 * How a record stands towards one Instance: in its Reach ("applies"), left out of
 * it, or held back because the record is suspended. Null when the Instance is
 * outside the record's scope. Left out wins over suspended.
 *
 * Judged on the record alone. `resolve` also checks, at render, that the call sites
 * the record pinned still have their totals (a changed one suspends the record in
 * the same commit), and applies nothing while Overrides are off.
 */
export type Reach = "applies" | "left-out" | "suspended";

export function reachOf(record: ReachRecord, instance: InstanceIdentity): Reach | null {
  if (!inScope(record.target, instance)) return null;
  if (record.excluded.includes(instance.id)) return "left-out";
  return record.suspended ? "suspended" : "applies";
}

/** Whether the record names this Instance: in its scope and not left out, suspended or not. */
export function namesInstance(record: ReachRecord, instance: InstanceIdentity): boolean {
  const reach = reachOf(record, instance);
  return reach === "applies" || reach === "suspended";
}

/** The records whose scope holds this Instance, narrowest first, each with how it stands towards it. */
export function recordsFor<R extends ReachRecord>(
  records: readonly R[],
  instance: InstanceIdentity,
): { record: R; reach: Reach }[] {
  return records
    .flatMap((record) => {
      const reach = reachOf(record, instance);
      return reach === null ? [] : [{ record, reach }];
    })
    .sort((a, b) => PRECEDENCE.indexOf(a.record.target.scope) - PRECEDENCE.indexOf(b.record.target.scope));
}

/** Whether `target` is at a scope that holds this Instance, left-out Instances and suspension aside. */
export function inScope(target: ScopeTarget, instance: InstanceIdentity): boolean {
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
export function keyOf(target: ScopeTarget): string {
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

type Entry = {
  target: ScopeTarget;
  values: Map<string, unknown>;
  excluded: Set<string>;
  /** Call-site anchor → the total it had when this record first named it. */
  pins: Map<string, number>;
  suspended: Suspension | null;
};

const describeTarget = (target: ScopeTarget): string =>
  target.scope === "page" ? `page ${target.component} on ${target.route}` : `${target.scope} ${keyOf(target)}`;

/**
 * The "before" view (PER-138): the app's own props, with only the State-prop
 * Overrides on top. A forced state is context, not a change, so the "before" image
 * shows the same dialog open.
 */
function statesOnly(resolved: Resolved, current: Props, stateProps: readonly string[]): Resolved {
  const props: Props = { ...current };
  const sources: Record<string, Source> = {};
  for (const key of Object.keys(current)) sources[key] = "app";
  const overrides: Props = {};
  for (const prop of stateProps) {
    if (!(prop in resolved.overrides)) continue;
    props[prop] = resolved.overrides[prop];
    overrides[prop] = resolved.overrides[prop];
    sources[prop] = resolved.sources[prop] ?? "instance";
  }
  return { props, sources, overrides };
}

/** The Current value alone: what renders while Overrides are off. */
function appOnly(current: Props): Resolved {
  return {
    props: current,
    overrides: {},
    sources: Object.fromEntries(Object.keys(current).map((key) => [key, "app" as const])),
  };
}

export type StoreOptions = {
  /** Off from the start when the React self-check failed before anything rendered. */
  status?: Status;
};

export function createOverrideStore(options: StoreOptions = {}): OverrideStore {
  let status: Status = options.status ?? { overrides: true };
  let view: View = "proposed";
  const scopes: Record<Scope, Map<string, Entry>> = {
    instance: new Map(),
    group: new Map(),
    page: new Map(),
  };
  const listeners = new Set<StoreListener>();
  /** The latest total seen per call-site anchor, and the anchor of every id seen. */
  const totals = new Map<string, number>();
  const anchors = new Map<string, string>();

  const emit = (changed: ScopeTarget) => {
    for (const listener of listeners) listener(changed);
  };

  const find = (target: ScopeTarget): Entry | undefined => scopes[target.scope].get(keyOf(target));

  const findOrCreate = (target: ScopeTarget): Entry => {
    let entry = find(target);
    if (!entry) {
      entry = { target: { ...target }, values: new Map(), excluded: new Set(), pins: new Map(), suspended: null };
      scopes[target.scope].set(keyOf(target), entry);
    }
    return entry;
  };

  /** The call sites a record depends on: its own, and those of the Instances it excludes. */
  const namedAnchors = (entry: Entry): Set<string> => {
    const named = new Set<string>();
    const targetAnchor =
      entry.target.scope === "group"
        ? entry.target.anchor
        : entry.target.scope === "instance"
          ? anchors.get(entry.target.id)
          : undefined;
    if (targetAnchor !== undefined) named.add(targetAnchor);
    for (const id of entry.excluded) {
      const anchor = anchors.get(id);
      if (anchor !== undefined) named.add(anchor);
    }
    return named;
  };

  /** Pins each newly named call site at its latest total, and drops pins nothing names any more. */
  const repin = (entry: Entry) => {
    const named = namedAnchors(entry);
    for (const anchor of entry.pins.keys()) if (!named.has(anchor)) entry.pins.delete(anchor);
    for (const anchor of named) {
      const total = totals.get(anchor);
      if (!entry.pins.has(anchor) && total !== undefined) entry.pins.set(anchor, total);
    }
  };

  /** The record to add to, refusing a suspended one. */
  const findOrCreateActive = (target: ScopeTarget): Entry => {
    assertOverridesOn(status);
    const entry = findOrCreate(target);
    if (entry.suspended) {
      throw new Error(
        `[loupe] The ${describeTarget(target)} Override is suspended for review: reapply or discard it first.`,
      );
    }
    return entry;
  };

  const allEntries = (): Entry[] => PRECEDENCE.flatMap((scope) => [...scopes[scope].values()]);

  const appliesNow = (entry: Entry, instance: InstanceIdentity): boolean => {
    if (entry.suspended) return false;
    const pinned = entry.pins.get(instance.anchor);
    return pinned === undefined || instance.total == null || pinned === instance.total;
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
      .filter(
        (entry): entry is Entry => entry !== undefined && !entry.excluded.has(instance.id) && appliesNow(entry, instance),
      );

  const requireExcludable = (target: ScopeTarget) => {
    if (target.scope === "instance") {
      throw new Error("[loupe] Only a group or page Override can exclude an Instance.");
    }
  };

  const resolve = (instance: InstanceKey): Resolved => {
    if (!status.overrides) return appOnly(instance.current);
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
  };

  return {
    get status() {
      return status;
    },

    disable(reason) {
      if (!status.overrides) return false;
      status = { overrides: false, reason };
      return true;
    },

    get view() {
      return view;
    },

    setView(next) {
      if (view === next) return false;
      view = next;
      return true;
    },

    set(target, prop, value) {
      const entry = findOrCreateActive(target);
      repin(entry);
      if (entry.values.has(prop) && Object.is(entry.values.get(prop), value)) return;
      entry.values.set(prop, value);
      emit(target);
    },

    reset(target, prop) {
      assertOverridesOn(status);
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
      assertOverridesOn(status);
      requireExcludable(target);
      const entry = findOrCreateActive(target);
      if (entry.excluded.has(instanceId)) return;
      entry.excluded.add(instanceId);
      repin(entry);
      emit({ scope: "instance", id: instanceId });
    },

    include(target, instanceId) {
      assertOverridesOn(status);
      requireExcludable(target);
      const entry = find(target);
      if (!entry?.excluded.delete(instanceId)) return;
      repin(entry);
      dropIfEmpty(entry);
      emit({ scope: "instance", id: instanceId });
    },

    resolve,

    render(instance) {
      const resolved = resolve(instance);
      return view === "before" ? statesOnly(resolved, instance.current, instance.stateProps) : resolved;
    },

    applies(instance) {
      return status.overrides && reaching(instance).some((entry) => entry.values.size > 0);
    },

    records() {
      return PRECEDENCE.flatMap((scope) =>
        [...scopes[scope].values()].map((entry) => ({
          target: { ...entry.target },
          values: Object.fromEntries(entry.values),
          excluded: [...entry.excluded],
          suspended: entry.suspended ? structuredClone(entry.suspended) : null,
        })),
      );
    },

    observe(site) {
      anchors.set(site.id, site.anchor);
      if (site.total === null) return;
      totals.set(site.anchor, site.total);
      for (const entry of allEntries()) {
        if (entry.suspended) continue;
        // A record set before this call site was seen is pinned now.
        if (!entry.pins.has(site.anchor) && namedAnchors(entry).has(site.anchor)) {
          entry.pins.set(site.anchor, site.total);
        }
        const was = entry.pins.get(site.anchor);
        if (was === undefined || was === site.total) continue;
        entry.suspended = { reason: "code-changed", anchor: site.anchor, was, now: site.total };
        emit(entry.target);
      }
    },

    suspendAmbiguous(ambiguous) {
      for (const entry of allEntries()) {
        // Ambiguity outranks a code change: Reapply must not put it back on a guess.
        if (entry.suspended?.reason === "ambiguous") continue;
        const named = entry.target.scope === "instance" ? [entry.target.id] : [...entry.excluded];
        const ids = named.filter(ambiguous).sort();
        if (ids.length === 0) continue;
        entry.suspended = { reason: "ambiguous", ids };
        emit(entry.target);
      }
    },

    reapply(target) {
      assertOverridesOn(status);
      const entry = find(target);
      if (!entry?.suspended) return;
      if (entry.suspended.reason === "ambiguous") {
        throw new Error(
          `[loupe] The ${describeTarget(target)} Override matches more than one Instance: discard it and set it again on the one you mean.`,
        );
      }
      entry.pins.clear();
      repin(entry);
      entry.suspended = null;
      emit(target);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
