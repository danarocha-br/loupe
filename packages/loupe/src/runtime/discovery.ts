// Which Instances are on the page, of what kind, with which DOM nodes and
// ancestors. Adapted Instances are the ones an Adapter registered; the rest are
// found by walking React's fibers: anchored client components with no Adapter,
// and components a Server Component rendered, from React's record of them.

import { ANCHOR_ATTRIBUTE, instanceId, parseCallSiteId, SOURCE_ATTRIBUTE, uniqueId } from "../call-site.js";
import { adaptedName } from "./adapter.js";
import {
  type Fiber,
  fiberOfNode,
  hostNodesOf,
  isComposite,
  keyPathOf,
  keyPaths,
  rootFibers,
  serverComponentsOn,
  walkFibers,
} from "./fiber.js";
import { withoutLoaderProps } from "./registry.js";
import type { Props } from "./store.js";

/** An Instance an Adapter registered, with the fiber of its latest render. */
export type AdaptedInstance = { readonly id: string; readonly fiber: Fiber | null };

/** An Instance no Adapter registered, as the fiber walk found it. Inspect only. */
export type FoundInstance = {
  /** "unadapted": rendered in the browser with no Adapter; "server": rendered by a Server Component. */
  kind: "unadapted" | "server";
  id: string;
  component: string;
  /** The Anchor of its call site. */
  anchor: string;
  /** `path:line:col n/total`, display only. */
  hint: string | null;
  /** The Server Component's environment; "Client" for an unadapted one. */
  env: string;
  /** Its props, without the loader's. */
  props: Props;
  /** Its props as written, the loader's included. */
  raw: Props;
};

export type DiscoveredInstance = { kind: "adapted"; id: string } | FoundInstance;

export type Discovery = {
  /**
   * Every Instance on the page: the adapted ones in the order given, then the
   * unadapted ones, then the server-rendered ones, each in tree order.
   */
  readonly instances: readonly DiscoveredInstance[];
  /** The Instance with this id, adapted ones first. */
  find(id: string): DiscoveredInstance | undefined;
  /** The Instance that rendered a DOM node: the nearest one up the tree, of any kind. */
  at(element: Element): string | null;
  /** The DOM nodes an Instance renders, to highlight it. */
  nodes(id: string): Element[];
  /** The adapted Instances around an adapted one, nearest first. Empty for any other. */
  ancestors(id: string): string[];
};

/**
 * The Instances on `doc`, given the ones Adapters registered. The fibers are
 * walked once, and only when an answer needs them: an adapted Instance's nodes
 * and ancestors don't. Each call looks at the page as it is then.
 */
export function discover(doc: Document | undefined, adapted: Iterable<AdaptedInstance>): Discovery {
  const registered = [...adapted];
  const byId = new Map(registered.map((instance) => [instance.id, instance]));
  let walk: PageWalk | null = null;
  const walked = (): PageWalk => (walk ??= walkPage(doc));

  return {
    get instances() {
      const { found } = walked();
      return [
        ...registered.map((instance): DiscoveredInstance => ({ kind: "adapted", id: instance.id })),
        ...found.filter((entry) => entry.kind === "unadapted"),
        ...found.filter((entry) => entry.kind === "server"),
      ];
    },

    find(id) {
      if (byId.has(id)) return { kind: "adapted", id };
      return walked().byId.get(id)?.instance;
    },

    at(element) {
      const { found, byId: located } = walked();
      // A fiber several Server Components rendered carries each: the innermost, listed last, wins.
      const byFiber = idsByFiber(found.map((entry) => ({ id: entry.id, fiber: (located.get(entry.id) as Located).fiber })));
      // The nearest Instance up the tree: adapted, client with no Adapter, or server-rendered.
      for (let fiber: Fiber | null = fiberOfNode(element); fiber; fiber = fiber.return) {
        const id = byFiber.get(fiber);
        if (id !== undefined) return id;
        if (adaptedName(fiber.type) === null) continue;
        for (const instance of registered) {
          if (instance.fiber === fiber || instance.fiber === fiber.alternate) return instance.id;
        }
      }
      // A server-rendered Instance whose fiber isn't on the path: the nearest anchor in the DOM.
      const anchored = element.closest(`[${ANCHOR_ATTRIBUTE}]`);
      const anchor = anchored?.getAttribute(ANCHOR_ATTRIBUTE);
      if (!anchored || !anchor) return null;
      const keyPath = keyPathOf(fiberOfNode(anchored));
      return (
        found.find(
          (entry) => entry.kind === "server" && entry.anchor === anchor && entry.id.startsWith(instanceId(anchor, keyPath)),
        )?.id ?? null
      );
    },

    nodes(id) {
      const instance = byId.get(id);
      if (instance) {
        // The recorded fiber may be the stale one of React's two copies.
        const nodes = hostNodesOf(instance.fiber).filter((node) => node.isConnected);
        return nodes.length > 0 ? nodes : hostNodesOf(instance.fiber?.alternate ?? null).filter((node) => node.isConnected);
      }
      const entry = walked().byId.get(id);
      return entry ? hostNodesOf(entry.fiber) : [];
    },

    ancestors(id) {
      const instance = byId.get(id);
      if (!instance) return [];
      const byFiber = idsByFiber(registered);
      const around: string[] = [];
      for (let fiber = instance.fiber?.return ?? null; fiber; fiber = fiber.return) {
        const owner = byFiber.get(fiber);
        if (owner && owner !== id) around.push(owner);
      }
      return around;
    },
  };
}

/** A found Instance and the fiber that carries it. */
type Located = { instance: FoundInstance; fiber: Fiber };
/** What one walk of the page found: the Instances in tree order, and each by id with its fiber. */
type PageWalk = { found: FoundInstance[]; byId: Map<string, Located> };

/** Each Instance's id by its fiber and by the other of React's two copies of it; a later Instance wins a shared fiber. */
function idsByFiber(instances: readonly AdaptedInstance[]): Map<Fiber, string> {
  const byFiber = new Map<Fiber, string>();
  for (const { id, fiber } of instances) {
    if (!fiber) continue;
    byFiber.set(fiber, id);
    if (fiber.alternate) byFiber.set(fiber.alternate, id);
  }
  return byFiber;
}

const anchorOf = (props: unknown): string | null => {
  const anchor = typeof props === "object" && props !== null ? (props as Props)[ANCHOR_ATTRIBUTE] : undefined;
  return typeof anchor === "string" ? anchor : null;
};

const hintOf = (props: Props): string | null =>
  typeof props[SOURCE_ATTRIBUTE] === "string" ? (props[SOURCE_ATTRIBUTE] as string) : null;

/** The Anchors a fiber carries: in its own props, and in the Server Components that rendered it. */
function anchorsOn(fiber: Fiber): string[] {
  const found: string[] = [];
  const own = anchorOf(fiber.memoizedProps);
  if (own !== null) found.push(own);
  for (const record of serverComponentsOn(fiber)) {
    const anchor = anchorOf(record.props);
    if (anchor !== null) found.push(anchor);
  }
  return found;
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

const NO_ANCHORS: ReadonlySet<string> = new Set();

/**
 * Walks every React root on `doc` once: server-rendered Instances from React's
 * record of them, and anchored client components with no Adapter.
 */
function walkPage(doc: Document | undefined): PageWalk {
  const found: FoundInstance[] = [];
  const byId = new Map<string, Located>();
  if (doc === undefined) return { found, byId };

  // The anchors on a fiber and on every fiber up its `return` chain, built once
  // per fiber and shared down the tree until a fiber adds an anchor of its own.
  const anchorsFrom = new Map<Fiber, ReadonlySet<string>>();
  const keyPathOfFiber = keyPaths();
  const anchorsAtOrAbove = (fiber: Fiber | null): ReadonlySet<string> => {
    const path: Fiber[] = [];
    let node = fiber;
    while (node && !anchorsFrom.has(node)) {
      path.push(node);
      node = node.return;
    }
    let anchors = node ? (anchorsFrom.get(node) as ReadonlySet<string>) : NO_ANCHORS;
    for (let index = path.length - 1; index >= 0; index--) {
      const step = path[index] as Fiber;
      const own = anchorsOn(step).filter((anchor) => !anchors.has(anchor));
      if (own.length > 0) anchors = new Set([...anchors, ...own]);
      anchorsFrom.set(step, anchors);
    }
    return anchors;
  };

  /**
   * The anchor of a client Instance with no Adapter, or null. A component that
   * forwards its props (to a Slot, or an Adapter to its original) hands the anchor
   * down: only the outermost fiber carrying it is the Instance, however many
   * components between carry anchors of their own (a design-system Tooltip.Trigger
   * is a call site too, and the call site's props reach the `render` element past
   * it). Known limit: a component that renders itself from one call site repeats
   * that anchor, so only its outermost level from there is listed.
   */
  const unadaptedAnchor = (fiber: Fiber): string | null => {
    if (!isComposite(fiber) || adaptedName(fiber.type) !== null) return null;
    const anchor = anchorOf(fiber.memoizedProps);
    if (anchor === null) return null;
    // A Server Component's output: listed as server-rendered.
    if (serverComponentsOn(fiber).some((record) => anchorOf(record.props) === anchor)) return null;
    if (anchorsAtOrAbove(fiber.return).has(anchor)) return null;
    return anchor;
  };

  const add = (instance: FoundInstance, fiber: Fiber): void => {
    found.push(instance);
    byId.set(instance.id, { instance, fiber });
  };

  const seen = new Set<object>();
  for (const root of rootFibers(doc)) {
    walkFibers(root, (fiber) => {
      for (const record of serverComponentsOn(fiber)) {
        if (seen.has(record)) continue;
        seen.add(record);
        const props = (typeof record.props === "object" && record.props !== null ? record.props : {}) as Props;
        const anchor = props[ANCHOR_ATTRIBUTE];
        // Page and layout components are not call sites the loader anchored.
        if (typeof record.name !== "string" || typeof anchor !== "string") continue;
        add(
          {
            kind: "server",
            id: uniqueId(instanceId(anchor, keyPathOfFiber(fiber)), byId),
            component: record.name,
            anchor,
            hint: hintOf(props),
            env: typeof record.env === "string" ? record.env : "Server",
            props: withoutLoaderProps(props),
            raw: props,
          },
          fiber,
        );
      }
      const anchor = unadaptedAnchor(fiber);
      if (anchor === null) return;
      const raw = fiber.memoizedProps as Props;
      add(
        {
          kind: "unadapted",
          id: uniqueId(instanceId(anchor, keyPathOfFiber(fiber)), byId),
          component: componentOf(anchor, fiber.type),
          anchor,
          hint: hintOf(raw),
          env: "Client",
          props: withoutLoaderProps(raw),
          raw,
        },
        fiber,
      );
    });
  }
  return { found, byId };
}
