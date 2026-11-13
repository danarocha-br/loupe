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

import { type Authorship, splitAuthored } from "./authored.js";
import { type Discovery, discover, type FoundInstance } from "./discovery.js";
import { identityOf, type LastSeen, type MountedInstance, registry } from "./registry.js";
import { type Inspection, inspect } from "./inspect.js";
import { loadedMeta } from "./instance-meta.js";
import { textScopeRefusal } from "./label-text.js";
import { describeStates, type StateProp, stateScopeRefusal } from "./state.js";
import { writesOf } from "./authored.js";
import {
  assertOverridesOn,
  type OverrideRecord,
  namesInstance,
  type Props,
  type Scope,
  type ScopeTarget,
  type Source,
  type Status,
  targetAt,
} from "./store.js";

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

const SERVER_REASON =
  "Rendered by a Server Component: Overrides apply only to Instances rendered in the browser.";

/** Why an anchored client Instance found by the fiber walk can't be overridden (PER-100 §1). */
export const UNADAPTED_REASON = "No Adapter renders this Instance, so Overrides can't reach it.";

export function createDebug(): LoupeDebug {
  const reg = registry();

  /** The Instances on the page as it is now. */
  const page = (): Discovery =>
    discover(typeof document === "undefined" ? undefined : document, reg.instances.values());

  /** An Instance no Adapter registered, or undefined. */
  const foundInstance = (id: string): FoundInstance | undefined => {
    const instance = page().find(id);
    return instance && instance.kind !== "adapted" ? instance : undefined;
  };

  const requireMounted = (id: string): MountedInstance => {
    const instance = reg.instances.get(id);
    if (!instance) {
      const found = foundInstance(id);
      throw new Error(
        found?.kind === "server"
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
    const resolved = reg.store.resolve({ ...identityOf(instance), current });
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
    const target = targetAt(identityOf(instance), scope);
    if (!target) throw new Error(`[loupe] ${instance.id}: no call site was anchored here, so it has no group.`);
    return target;
  };

  /** Checked before any other refusal, so with Overrides off that is what a write says. */
  const assertEditable = (): void => assertOverridesOn(reg.store.status);

  function records(): RecordRow[] {
    const mounted = [...reg.instances.values()];
    return reg.store.records().map((record) => ({
      ...record,
      mounted: mounted
        .filter((instance) => namesInstance(record, identityOf(instance)))
        .map((instance) => instance.id),
    }));
  }

  function scan(): ServerInstance[] {
    return page()
      .instances.filter((instance): instance is FoundInstance => instance.kind === "server")
      .map(({ id, component, anchor, hint, env, props }) => ({ id, component, anchor, hint, env, props }));
  }

  function inspectInstance(id: string): Inspection {
    const instance = reg.instances.get(id);
    const status = reg.store.status;
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
    const found = foundInstance(id);
    if (!found) throw new Error(`[loupe] No Instance ${id} on this page.`);
    if (found.kind === "unadapted") {
      const { current, injected, authorship } = splitAuthored(found.props, writesOf(found.raw));
      return inspect({
        id,
        component: found.component,
        anchor: found.anchor,
        hint: found.hint,
        rendered: "client",
        adapted: false,
        current,
        injected,
        authorship,
        writes: writesOf(found.raw),
        meta: loadedMeta(found.anchor),
        stateProps: [],
        overridesOn: status.overrides,
        ...(status.overrides ? {} : { overridesOffReason: status.reason }),
      });
    }
    return inspect({
      id,
      component: found.component,
      anchor: found.anchor,
      hint: found.hint,
      rendered: "server",
      current: found.props,
      injected: {},
      authorship: "server",
      writes: writesOf(found.raw),
      meta: loadedMeta(found.anchor),
      stateProps: [],
      overridesOn: status.overrides,
    });
  }

  return {
    get status() {
      return reg.store.status;
    },

    list(filter) {
      const matches = (row: { id: string; component: string }) =>
        filter === undefined || row.component === filter || row.id.includes(filter);
      const status = reg.store.status;
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
      const others: InstanceRow[] = page()
        .instances.filter((instance): instance is FoundInstance => instance.kind !== "adapted" && matches(instance))
        .map((instance) => ({
          id: instance.id,
          component: instance.component,
          anchor: instance.anchor,
          hint: instance.hint,
          rendered: instance.kind === "server" ? "server" : "client",
          adapted: false,
          editable: false,
          reason: instance.kind === "server" ? SERVER_REASON : UNADAPTED_REASON,
          overrides: {},
          renders: 0,
          stateProps: [],
        }));
      return [...client, ...others];
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
      return page().at(element);
    },

    scan,

    inspect: inspectInstance,

    nodes(id) {
      return page().nodes(id);
    },

    ancestors(id) {
      return page().ancestors(id);
    },
  };
}

export function installDebug(): void {
  if (typeof window === "undefined") return;
  const host = window as typeof window & { __loupe?: LoupeDebug };
  host.__loupe ??= createDebug();
}
