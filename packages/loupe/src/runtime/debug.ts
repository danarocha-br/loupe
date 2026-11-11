// `window.__loupe`: Stage 1's acceptance surface, before there is a Toolbar.
//
//   __loupe.list(filter?)          every Instance on the page, adapted and server-rendered
//   __loupe.props(id)              Current value (the app's own props), what a library injected,
//                                  Overrides, rendered props, each value's source, and State props
//   __loupe.set(id, prop, value, scope?)   an Override; scope is "instance" (default),
//                                          "group" (the Instance's call site) or "page"
//                                          (its component on this route). A State prop is
//                                          Instance scope only.
//   __loupe.reset(id, prop?, scope?)       undoes that scope's Override only
//   __loupe.exclude(id, scope)             keeps a group or page Override off one Instance
//   __loupe.include(id, scope)             undoes `exclude`
//   __loupe.records()                      every Override record: exclusions, suspension, and
//                                          the mounted Instances it names (none: "No Instance mounted")
//   __loupe.reapply(target)                a "code changed" record applies again (target: a record's `target`)
//   __loupe.discard(target)                drops a record, mounted or not
//   __loupe.pick(element)          the Instance that rendered a DOM node
//   __loupe.scan()                 server-rendered Instances, from React's `_debugInfo`
//   __loupe.inspect(id)            the inspector's rows: every prop, Editable or inspect-only
//                                  with a reason, Coverage, and what a library injected
//   __loupe.nodes(id)              the DOM nodes an Instance renders, to highlight it
//   __loupe.ancestors(id)          the adapted Instances around it, nearest first
//   __loupe.status                 whether Overrides are on (the React self-check)

import { adaptedName } from "./adapter.js";
import type { Authorship } from "./authored.js";
import { type Fiber, fiberOfNode, keyPathOf, rootFibers, walkFibers } from "./fiber.js";
import {
  ANCHOR_PROP,
  currentRoute,
  identityOf,
  instanceId,
  type MountedInstance,
  registry,
  SOURCE_PROP,
  type Status,
  UNANCHORED,
  uniqueId,
  withoutLoaderProps,
} from "./registry.js";
import { type Inspection, inspect } from "./inspect.js";
import { describeStates, type StateProp, stateScopeRefusal } from "./state.js";
import { writesOf } from "./authored.js";
import { type OverrideRecord, type Props, reaches, type Scope, type ScopeTarget, type Source } from "./store.js";

export type InstanceRow = {
  id: string;
  component: string;
  /** Call-site id. */
  anchor: string;
  /** `path:line:col n/total`, display only. */
  hint: string | null;
  /** "client" for an adapted Instance, "server" for one rendered by a Server Component. */
  rendered: "client" | "server";
  editable: boolean;
  /** Why the Instance can't be overridden, when it can't. */
  reason?: string;
  overrides: Props;
  /** How many times an adapted Instance has rendered; 0 for a server-rendered one. */
  renders: number;
  /** State props (`X` with `onXChange`): Instance scope only. Empty for a server-rendered one. */
  stateProps: readonly string[];
};

export type InstanceProps = {
  id: string;
  /** The props the call site writes, live: the Current value. Only these reach Coverage or a Proposal. */
  current: Props;
  /** What a library set on the Instance (handlers, ARIA, ids, `data-slot`), live, never editable. */
  injected: Props;
  /** Whether the two could be told apart; when not, every live prop is in `current`. */
  authorship: Authorship;
  overrides: Props;
  /** What the component renders with: the app's and the library's props, with Overrides on top. */
  rendered: Props;
  /** The source of every key in `current` and `overrides`. */
  sources: Record<string, Source>;
  /** Each State prop: whether the app controls it, and whether an Override holds it against the app. */
  states: Record<string, StateProp>;
};

export type RecordRow = OverrideRecord & {
  /** Mounted Instances the record names, suspended or not. Empty: "No Instance mounted". */
  mounted: string[];
};

export type ServerInstance = {
  id: string;
  component: string;
  anchor: string;
  hint: string | null;
  env: string;
  props: Props;
};

export type LoupeDebug = {
  readonly status: Status;
  list(filter?: string): InstanceRow[];
  props(id: string): InstanceProps;
  set(id: string, prop: string, value: unknown, scope?: Scope): InstanceProps;
  reset(id: string, prop?: string, scope?: Scope): InstanceProps;
  exclude(id: string, scope: "group" | "page"): InstanceProps;
  include(id: string, scope: "group" | "page"): InstanceProps;
  records(): RecordRow[];
  reapply(target: ScopeTarget): RecordRow[];
  discard(target: ScopeTarget): RecordRow[];
  pick(element: Element): string | null;
  scan(): ServerInstance[];
  inspect(id: string): Inspection;
  nodes(id: string): Element[];
  ancestors(id: string): string[];
};

// React's fiber tag for a DOM element.
const HOST_COMPONENT = 5;

/** The outermost DOM elements a fiber renders, through portals too (a dialog's popup is in one). */
export function hostNodesOf(fiber: Fiber | null): Element[] {
  const found: Element[] = [];
  const stack: Fiber[] = fiber?.child ? [fiber.child] : [];
  while (stack.length > 0) {
    const node = stack.pop() as Fiber;
    if (node.sibling) stack.push(node.sibling);
    if (node.tag === HOST_COMPONENT && node.stateNode instanceof Element) found.push(node.stateNode);
    else if (node.child) stack.push(node.child);
  }
  // Depth-first with a stack visits siblings in reverse.
  return found.reverse();
}

const SERVER_REASON =
  "Rendered by a Server Component: Overrides apply only to Instances rendered in the browser.";

export function createDebug(): LoupeDebug {
  const reg = registry();

  const requireMounted = (id: string): MountedInstance => {
    const instance = reg.instances.get(id);
    if (!instance) {
      const server = scan().find((entry) => entry.id === id);
      throw new Error(server ? `[loupe] ${id}: ${SERVER_REASON}` : `[loupe] No mounted Instance ${id}.`);
    }
    return instance;
  };

  const describe = (instance: MountedInstance): InstanceProps => {
    const { current, injected, authorship } = instance.live();
    // Resolved over the app's props alone, so injected props get no source and
    // never reach Coverage.
    const resolved = reg.status.overrides
      ? reg.store.resolve({ ...identityOf(instance), current })
      : {
          props: current,
          overrides: {},
          sources: Object.fromEntries(Object.keys(current).map((key) => [key, "app" as const])),
        };
    return {
      id: instance.id,
      current,
      injected,
      authorship,
      overrides: resolved.overrides,
      rendered: { ...injected, ...resolved.props },
      sources: resolved.sources,
      states: describeStates(instance.stateProps, current, resolved.overrides, instance.attempts),
    };
  };

  /** The record an Override on this Instance at this scope goes into. */
  const targetOf = (instance: MountedInstance, scope: Scope): ScopeTarget => {
    switch (scope) {
      case "instance":
        return { scope, id: instance.id };
      case "group":
        if (instance.anchor.startsWith(UNANCHORED)) {
          throw new Error(`[loupe] ${instance.id}: no call site was anchored here, so it has no group.`);
        }
        return { scope, anchor: instance.anchor };
      case "page":
        return { scope, route: currentRoute(), component: instance.component };
      default:
        throw new Error(`[loupe] Unknown scope ${JSON.stringify(scope)}: use "instance", "group" or "page".`);
    }
  };

  const assertEditable = (): void => {
    if (!reg.status.overrides) {
      throw new Error(`[loupe] Overrides are off, everything is inspect-only: ${reg.status.reason}`);
    }
  };

  function records(): RecordRow[] {
    const mounted = [...reg.instances.values()];
    return reg.store.records().map((record) => ({
      ...record,
      mounted: mounted
        .filter((instance) => reaches(record.target, identityOf(instance)) && !record.excluded.includes(instance.id))
        .map((instance) => instance.id),
    }));
  }

  type Scanned = { entry: ServerInstance; fiber: Fiber; raw: Props };

  /** Server-rendered Instances with the fiber that carries each and its props as written. */
  function scanFibers(): Scanned[] {
    if (typeof document === "undefined") return [];
    const found = new Map<string, Scanned>();
    const seen = new Set<object>();
    for (const root of rootFibers(document)) {
      walkFibers(root, (fiber) => {
        for (const info of fiber._debugInfo ?? []) {
          if (seen.has(info)) continue;
          seen.add(info);
          const props = (typeof info.props === "object" && info.props !== null ? info.props : {}) as Props;
          const anchor = props[ANCHOR_PROP];
          // Page and layout components are not call sites the loader anchored.
          if (typeof info.name !== "string" || typeof anchor !== "string") continue;
          const id = uniqueId(instanceId(anchor, keyPathOf(fiber)), found);
          found.set(id, {
            entry: {
              id,
              component: info.name,
              anchor,
              hint: typeof props[SOURCE_PROP] === "string" ? (props[SOURCE_PROP] as string) : null,
              env: typeof info.env === "string" ? info.env : "Server",
              props: withoutLoaderProps(props),
            },
            fiber,
            raw: props,
          });
        }
      });
    }
    return [...found.values()];
  }

  function scan(): ServerInstance[] {
    return scanFibers().map((scanned) => scanned.entry);
  }

  function inspectInstance(id: string): Inspection {
    const instance = reg.instances.get(id);
    const status = reg.status;
    if (instance) {
      const { current, injected, authorship } = instance.live();
      return inspect({
        id,
        component: instance.component,
        anchor: instance.anchor,
        hint: instance.hint,
        rendered: "client",
        current,
        injected,
        authorship,
        writes: instance.writes(),
        meta: instance.meta,
        stateProps: instance.stateProps,
        overridesOn: status.overrides,
        ...(status.overrides ? { sources: describe(instance).sources } : { overridesOffReason: status.reason }),
      });
    }
    const server = scanFibers().find((scanned) => scanned.entry.id === id);
    if (!server) throw new Error(`[loupe] No Instance ${id} on this page.`);
    return inspect({
      id,
      component: server.entry.component,
      anchor: server.entry.anchor,
      hint: server.entry.hint,
      rendered: "server",
      current: server.entry.props,
      injected: {},
      authorship: "server",
      writes: writesOf(server.raw),
      meta: null,
      stateProps: [],
      overridesOn: status.overrides,
    });
  }

  return {
    get status() {
      return reg.status;
    },

    list(filter) {
      const matches = (row: { id: string; component: string }) =>
        filter === undefined || row.component === filter || row.id.includes(filter);
      const status = reg.status;
      const client: InstanceRow[] = [...reg.instances.values()].filter(matches).map((instance) => ({
        id: instance.id,
        component: instance.component,
        anchor: instance.anchor,
        hint: instance.hint,
        rendered: "client",
        editable: status.overrides,
        ...(status.overrides ? {} : { reason: status.reason }),
        overrides: describe(instance).overrides,
        renders: instance.renders,
        stateProps: instance.stateProps,
      }));
      const server: InstanceRow[] = scan()
        .filter(matches)
        .map((entry) => ({
          id: entry.id,
          component: entry.component,
          anchor: entry.anchor,
          hint: entry.hint,
          rendered: "server",
          editable: false,
          reason: SERVER_REASON,
          overrides: {},
          renders: 0,
          stateProps: [],
        }));
      return [...client, ...server];
    },

    props(id) {
      return describe(requireMounted(id));
    },

    set(id, prop, value, scope = "instance") {
      const instance = requireMounted(id);
      assertEditable();
      // A group `open` would open every dialog at that call site at once (PER-96).
      const refusal = stateScopeRefusal(scope, instance.stateProps, prop);
      if (refusal) throw new Error(`[loupe] ${prop} is a State prop: ${refusal}`);
      reg.store.set(targetOf(instance, scope), prop, value);
      return describe(instance);
    },

    reset(id, prop, scope = "instance") {
      const instance = requireMounted(id);
      assertEditable();
      reg.store.reset(targetOf(instance, scope), prop);
      return describe(instance);
    },

    exclude(id, scope) {
      const instance = requireMounted(id);
      assertEditable();
      reg.store.exclude(targetOf(instance, scope), instance.id);
      return describe(instance);
    },

    include(id, scope) {
      const instance = requireMounted(id);
      assertEditable();
      reg.store.include(targetOf(instance, scope), instance.id);
      return describe(instance);
    },

    records,

    reapply(target) {
      assertEditable();
      reg.store.reapply(target);
      return records();
    },

    discard(target) {
      assertEditable();
      reg.store.reset(target);
      return records();
    },

    pick(element) {
      for (let fiber: Fiber | null = fiberOfNode(element); fiber; fiber = fiber.return) {
        if (adaptedName(fiber.type) === null) continue;
        for (const instance of reg.instances.values()) {
          if (instance.fiber === fiber || instance.fiber === fiber.alternate) return instance.id;
        }
      }
      // Not adapted: the nearest server-rendered Instance whose anchor is in the DOM.
      const anchored = element.closest(`[${ANCHOR_PROP}]`);
      const anchor = anchored?.getAttribute(ANCHOR_PROP);
      if (!anchored || !anchor) return null;
      const keyPath = keyPathOf(fiberOfNode(anchored));
      return scan().find((entry) => entry.anchor === anchor && entry.id.startsWith(instanceId(anchor, keyPath)))?.id ?? null;
    },

    scan,

    inspect: inspectInstance,

    nodes(id) {
      const instance = reg.instances.get(id);
      if (instance) {
        // The recorded fiber may be the stale one of React's two copies.
        const nodes = hostNodesOf(instance.fiber).filter((node) => node.isConnected);
        return nodes.length > 0 ? nodes : hostNodesOf(instance.fiber?.alternate ?? null).filter((node) => node.isConnected);
      }
      const server = scanFibers().find((scanned) => scanned.entry.id === id);
      return server ? hostNodesOf(server.fiber) : [];
    },

    ancestors(id) {
      const instance = reg.instances.get(id);
      if (!instance) return [];
      const byFiber = new Map<Fiber, string>();
      for (const other of reg.instances.values()) {
        if (!other.fiber) continue;
        byFiber.set(other.fiber, other.id);
        if (other.fiber.alternate) byFiber.set(other.fiber.alternate, other.id);
      }
      const found: string[] = [];
      for (let fiber = instance.fiber?.return ?? null; fiber; fiber = fiber.return) {
        const owner = byFiber.get(fiber);
        if (owner && owner !== id) found.push(owner);
      }
      return found;
    },
  };
}

export function installDebug(): void {
  if (typeof window === "undefined") return;
  const host = window as typeof window & { __loupe?: LoupeDebug };
  host.__loupe ??= createDebug();
}
