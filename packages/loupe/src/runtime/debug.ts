// `window.__loupe`: Stage 1's acceptance surface, before there is a Toolbar.
//
//   __loupe.list(filter?)          every Instance on the page: adapted, anchored in the browser
//                                  with no Adapter (inspect-only), and server-rendered
//   __loupe.props(id)              Current value (the app's own props), what a library injected,
//                                  Overrides, rendered props, each value's source, and State props
//   __loupe.set(id, prop, value, scope?)   an Override; scope is "instance" (default),
//                                          "group" (the Instance's call site) or "page"
//                                          (its component on this route). A State prop is
//                                          Instance scope only. Label text
//                                          (`children`) is never page scope.
//   __loupe.reset(id, prop?, scope?)       undoes that scope's Override only
//   __loupe.exclude(id, scope)             keeps a group or page Override off one Instance
//   __loupe.include(id, scope)             undoes `exclude`
//   __loupe.records()                      every Override record: exclusions, suspension, and
//                                          the mounted Instances it names (none: "No Instance mounted")
//   __loupe.reapply(target)                a "code changed" record applies again (target: a record's `target`)
//   __loupe.discard(target)                drops a record, mounted or not
//   __loupe.lastSeen(id)                   an unmounted Instance as it last rendered, or null
//   __loupe.pick(element)          the Instance that rendered a DOM node
//   __loupe.scan()                 server-rendered Instances, from React's `_debugInfo`
//   __loupe.inspect(id)            the inspector's rows: every prop, Editable or inspect-only
//                                  with a reason, Coverage, and what a library injected
//   __loupe.nodes(id)              the DOM nodes an Instance renders, to highlight it
//   __loupe.ancestors(id)          the adapted Instances around it, nearest first
//   __loupe.status                 whether Overrides are on (the React self-check)

import { parseCallSiteId } from "../call-site.js";
import { adaptedName } from "./adapter.js";
import { type Authorship, splitAuthored } from "./authored.js";
import { type Fiber, fiberOfNode, keyPathOf, rootFibers, walkFibers } from "./fiber.js";
import {
  ANCHOR_PROP,
  identityOf,
  instanceId,
  type LastSeen,
  type MountedInstance,
  registry,
  SOURCE_PROP,
  scopeTarget,
  type Status,
  uniqueId,
  withoutLoaderProps,
} from "./registry.js";
import { type Inspection, inspect } from "./inspect.js";
import { loadedMeta } from "./instance-meta.js";
import { textScopeRefusal } from "./label-text.js";
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
  /** "client" for one rendered in the browser, adapted or not; "server" for one rendered by a Server Component. */
  rendered: "client" | "server";
  /** Whether an Adapter registered it. Only an adapted Instance takes Overrides. */
  adapted: boolean;
  editable: boolean;
  /** Why the Instance can't be overridden, when it can't. */
  reason?: string;
  overrides: Props;
  /** How many times an adapted Instance has rendered; 0 for any other. */
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
  /** An Instance that unmounted, as it last rendered: null while it is mounted or was never seen. */
  lastSeen(id: string): LastSeen | null;
  pick(element: Element): string | null;
  scan(): ServerInstance[];
  inspect(id: string): Inspection;
  nodes(id: string): Element[];
  ancestors(id: string): string[];
};

// React's fiber tag for a DOM element.
const HOST_COMPONENT = 5;
// React's fiber tags for a component the app wrote: function, class, forwardRef, memo, simple memo.
const COMPOSITE_TAGS: ReadonlySet<number> = new Set([0, 1, 11, 14, 15]);

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

/** Why an anchored client Instance found by the fiber walk can't be overridden (PER-100 §1). */
export const UNADAPTED_REASON = "No Adapter renders this Instance, so Overrides can't reach it.";

const anchorOf = (props: unknown): string | null => {
  const anchor = typeof props === "object" && props !== null ? (props as Props)[ANCHOR_PROP] : undefined;
  return typeof anchor === "string" ? anchor : null;
};

/** The call-site ids a fiber carries: in its own props, and in the server components that rendered it. */
function anchorsOn(fiber: Fiber): string[] {
  const found: string[] = [];
  const own = anchorOf(fiber.memoizedProps);
  if (own !== null) found.push(own);
  for (const info of fiber._debugInfo ?? []) {
    const anchor = anchorOf(info.props);
    if (anchor !== null) found.push(anchor);
  }
  return found;
}

/**
 * The anchor of a client Instance with no Adapter, or null. A component that
 * forwards its props (to a Slot, or an Adapter to its original) hands the anchor
 * down: only the outermost fiber carrying it is the Instance, however many
 * components between carry anchors of their own (a design-system Tooltip.Trigger
 * is a call site too, and the call site's props reach the `render` element past
 * it). Known limit: a component that renders itself from one call site repeats
 * that anchor, so only its outermost level from there is listed.
 */
function unadaptedAnchor(fiber: Fiber): string | null {
  if (!COMPOSITE_TAGS.has(fiber.tag) || adaptedName(fiber.type) !== null) return null;
  const anchor = anchorOf(fiber.memoizedProps);
  if (anchor === null) return null;
  // A Server Component's output: listed by the server scan.
  if ((fiber._debugInfo ?? []).some((info) => anchorOf(info.props) === anchor)) return null;
  for (let above = fiber.return; above; above = above.return) {
    if (anchorsOn(above).includes(anchor)) return null;
  }
  return anchor;
}

/** The name the call site imports, from the anchor; the type's own name as a fallback. */
function componentOf(anchor: string, type: unknown): string {
  const named = parseCallSiteId(anchor)?.component;
  if (named) return named;
  const value = type as { displayName?: unknown; name?: unknown; render?: { name?: unknown }; type?: { name?: unknown } } | null;
  for (const name of [value?.displayName, value?.name, value?.render?.name, value?.type?.name]) {
    if (typeof name === "string" && name !== "") return name;
  }
  return "Anonymous";
}

export function createDebug(): LoupeDebug {
  const reg = registry();

  const requireMounted = (id: string): MountedInstance => {
    const instance = reg.instances.get(id);
    if (!instance) {
      const found = scanFibers().find((scanned) => scanned.entry.id === id);
      throw new Error(
        found?.rendered === "server"
          ? `[loupe] ${id}: ${SERVER_REASON}`
          : found
            ? `[loupe] ${id} has no Adapter, so it is inspect-only.`
            : `[loupe] No mounted Instance ${id}.`,
      );
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
    if (!["instance", "group", "page"].includes(scope)) {
      throw new Error(`[loupe] Unknown scope ${JSON.stringify(scope)}: use "instance", "group" or "page".`);
    }
    const target = scopeTarget(instance, scope);
    if (!target) throw new Error(`[loupe] ${instance.id}: no call site was anchored here, so it has no group.`);
    return target;
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

  /** A client one's `env` is "Client"; its fiber is the Instance's own. */
  type Scanned = { entry: ServerInstance; fiber: Fiber; raw: Props; rendered: "client" | "server" };

  /**
   * Instances no Adapter registered, with the fiber that carries each and its props
   * as written: server-rendered ones from React's `_debugInfo`, and anchored client
   * components with no Adapter.
   */
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
            rendered: "server",
          });
        }
        const anchor = unadaptedAnchor(fiber);
        if (anchor === null) return;
        const raw = fiber.memoizedProps as Props;
        const id = uniqueId(instanceId(anchor, keyPathOf(fiber)), found);
        found.set(id, {
          entry: {
            id,
            component: componentOf(anchor, fiber.type),
            anchor,
            hint: typeof raw[SOURCE_PROP] === "string" ? (raw[SOURCE_PROP] as string) : null,
            env: "Client",
            props: withoutLoaderProps(raw),
          },
          fiber,
          raw,
          rendered: "client",
        });
      });
    }
    return [...found.values()];
  }

  function scan(): ServerInstance[] {
    return scanFibers()
      .filter((scanned) => scanned.rendered === "server")
      .map((scanned) => scanned.entry);
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
    if (server.rendered === "client") {
      const { current, injected, authorship } = splitAuthored(server.entry.props, writesOf(server.raw));
      return inspect({
        id,
        component: server.entry.component,
        anchor: server.entry.anchor,
        hint: server.entry.hint,
        rendered: "client",
        adapted: false,
        current,
        injected,
        authorship,
        writes: writesOf(server.raw),
        meta: loadedMeta(server.entry.anchor),
        stateProps: [],
        overridesOn: status.overrides,
        ...(status.overrides ? {} : { overridesOffReason: status.reason }),
      });
    }
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
      meta: loadedMeta(server.entry.anchor),
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
        adapted: true,
        editable: status.overrides,
        ...(status.overrides ? {} : { reason: status.reason }),
        overrides: describe(instance).overrides,
        renders: instance.renders,
        stateProps: instance.stateProps,
      }));
      const scanned = scanFibers().map((found) => ({ ...found.entry, rendered: found.rendered }));
      const others = (rendered: "client" | "server"): InstanceRow[] =>
        scanned
          .filter((entry) => entry.rendered === rendered && matches(entry))
          .map((entry) => ({
            id: entry.id,
            component: entry.component,
            anchor: entry.anchor,
            hint: entry.hint,
            rendered,
            adapted: false,
            editable: false,
            reason: rendered === "server" ? SERVER_REASON : UNADAPTED_REASON,
            overrides: {},
            renders: 0,
            stateProps: [],
          }));
      return [...client, ...others("client"), ...others("server")];
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
      // A page-wide text would rename every Instance of the component at once (PER-113).
      const textRefusal = textScopeRefusal(scope, prop);
      if (textRefusal) throw new Error(`[loupe] ${prop} is label text: ${textRefusal}`);
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

    lastSeen(id) {
      const seen = reg.departed.get(id);
      // Shallow: a Current value can hold functions and elements, which can't be cloned.
      return seen && !reg.instances.has(id) ? { ...seen, current: { ...seen.current } } : null;
    },

    pick(element) {
      const scanned = scanFibers();
      // A fiber several server components rendered carries each: the innermost, listed last, wins.
      const found = new Map<Fiber, string>();
      for (const entry of scanned) {
        found.set(entry.fiber, entry.entry.id);
        if (entry.fiber.alternate) found.set(entry.fiber.alternate, entry.entry.id);
      }
      // The nearest Instance up the tree: adapted, client with no Adapter, or server-rendered.
      for (let fiber: Fiber | null = fiberOfNode(element); fiber; fiber = fiber.return) {
        const id = found.get(fiber);
        if (id !== undefined) return id;
        if (adaptedName(fiber.type) === null) continue;
        for (const instance of reg.instances.values()) {
          if (instance.fiber === fiber || instance.fiber === fiber.alternate) return instance.id;
        }
      }
      // A server-rendered Instance whose fiber isn't on the path: the nearest anchor in the DOM.
      const anchored = element.closest(`[${ANCHOR_PROP}]`);
      const anchor = anchored?.getAttribute(ANCHOR_PROP);
      if (!anchored || !anchor) return null;
      const keyPath = keyPathOf(fiberOfNode(anchored));
      return (
        scanned.find(
          (found) =>
            found.rendered === "server" &&
            found.entry.anchor === anchor &&
            found.entry.id.startsWith(instanceId(anchor, keyPath)),
        )?.entry.id ?? null
      );
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
