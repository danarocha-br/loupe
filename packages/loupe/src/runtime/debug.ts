// `window.__loupe`: Stage 1's acceptance surface, before there is a Toolbar.
//
//   __loupe.list(filter?)          every Instance on the page, adapted and server-rendered
//   __loupe.props(id)              Current value, Overrides, rendered props and each value's source
//   __loupe.set(id, prop, value)   an Instance-scope Override
//   __loupe.reset(id, prop?)       back to the Current value
//   __loupe.pick(element)          the Instance that rendered a DOM node
//   __loupe.scan()                 server-rendered Instances, from React's `_debugInfo`
//   __loupe.status                 whether Overrides are on (the React self-check)

import { adaptedName } from "./adapter.js";
import { type Fiber, fiberOfNode, keyPathOf, rootFibers, walkFibers } from "./fiber.js";
import {
  ANCHOR_PROP,
  instanceId,
  type MountedInstance,
  registry,
  SOURCE_PROP,
  type Status,
  withoutLoaderProps,
} from "./registry.js";
import type { Props, Source } from "./store.js";

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
};

export type InstanceProps = {
  id: string;
  /** The props the app passes right now. */
  current: Props;
  overrides: Props;
  /** What the component renders with. */
  rendered: Props;
  sources: Record<string, Source>;
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
  set(id: string, prop: string, value: unknown): InstanceProps;
  reset(id: string, prop?: string): InstanceProps;
  pick(element: Element): string | null;
  scan(): ServerInstance[];
};

const SERVER_REASON =
  "Rendered by a Server Component: Overrides apply only to Instances rendered in the browser.";

export function createDebug(): LoupeDebug {
  const reg = registry();

  const mounted = (id: string): MountedInstance => {
    const instance = reg.instances.get(id);
    if (!instance) {
      const server = scan().find((entry) => entry.id === id);
      throw new Error(server ? `[loupe] ${id}: ${SERVER_REASON}` : `[loupe] No mounted Instance ${id}.`);
    }
    return instance;
  };

  const describe = (instance: MountedInstance): InstanceProps => {
    const current = instance.current();
    const resolved = reg.store.resolve({ id: instance.id, current });
    if (!reg.status.overrides) {
      return { id: instance.id, current, overrides: {}, rendered: current, sources: resolved.sources };
    }
    return {
      id: instance.id,
      current,
      overrides: resolved.overrides,
      rendered: resolved.props,
      sources: resolved.sources,
    };
  };

  const editable = (): void => {
    if (!reg.status.overrides) {
      throw new Error(`[loupe] Overrides are off, everything is inspect-only: ${reg.status.reason}`);
    }
  };

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
          const base = instanceId(anchor, keyPathOf(fiber));
          let id = base;
          for (let n = 2; found.has(id); n++) id = `${base}~${n}`;
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
        overrides: status.overrides ? describe(instance).overrides : {},
        renders: instance.renders,
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
        }));
      return [...client, ...server];
    },

    props(id) {
      return describe(mounted(id));
    },

    set(id, prop, value) {
      const instance = mounted(id);
      editable();
      reg.store.set(instance.id, prop, value);
      return describe(instance);
    },

    reset(id, prop) {
      const instance = mounted(id);
      editable();
      reg.store.reset(instance.id, prop);
      return describe(instance);
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
