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
//   __loupe.records()                      every Override record, with its exclusions, whether
//                                          it is suspended for review, and the mounted
//                                          Instances it reaches (none: "No Instance mounted")
//   __loupe.reapply(target)                a "code changed" record applies again, pinned to the
//                                          code as it is now (target: a record's `target`)
//   __loupe.discard(target)                drops a record, mounted or not, suspended or not
//   __loupe.pick(element)          the Instance that rendered a DOM node
//   __loupe.scan()                 server-rendered Instances, from React's `_debugInfo`
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
import { describeStates, type StateProp, stateScopeRefusal } from "./state.js";
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
  /** Ids of the mounted Instances the record reaches. Empty: "No Instance mounted". */
  reaches: string[];
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
};

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
      reaches: mounted
        .filter((instance) => reaches(record.target, identityOf(instance)) && !record.excluded.includes(instance.id))
        .map((instance) => instance.id),
    }));
  }

  function scan(): ServerInstance[] {
    if (typeof document === "undefined") return [];
    const found = new Map<string, ServerInstance>();
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
            id,
            component: info.name,
            anchor,
            hint: typeof props[SOURCE_PROP] === "string" ? (props[SOURCE_PROP] as string) : null,
            env: typeof info.env === "string" ? info.env : "Server",
            props: withoutLoaderProps(props),
          });
        }
      });
    }
    return [...found.values()];
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
  };
}

export function installDebug(): void {
  if (typeof window === "undefined") return;
  const host = window as typeof window & { __loupe?: LoupeDebug };
  host.__loupe ??= createDebug();
}
