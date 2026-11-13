// The one place that reads React's dev-only internals. None of this is public
// API, and it changed in 19.0, 19.1 and 19.2 (PER-98), so every use goes through
// the self-check: if the internals don't behave, Loupe goes inspect-only.
// Other modules follow the links the `Fiber` type names, read its props and the
// fields of the `DebugInfo` records `serverComponentsOn` hands them, but fiber
// tags, where React keeps those records, and the keys React puts on DOM nodes
// stay here.

import * as React from "react";
import type { Props } from "./store.js";

/** The fields of a React fiber that Loupe reads. */
export type Fiber = {
  tag: number;
  key: string | null;
  type: unknown;
  memoizedProps: Props | null;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
  stateNode: unknown;
  _debugInfo?: readonly DebugInfo[] | null;
};

/** A server-rendered component as React's dev build records it on a fiber. */
export type DebugInfo = {
  name?: unknown;
  env?: unknown;
  key?: unknown;
  props?: unknown;
};

type Internals = { A?: { getOwner?: () => unknown } | null };

const INTERNALS_KEY = "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";

function internals(): Internals | undefined {
  return (React as unknown as Record<string, Internals | undefined>)[INTERNALS_KEY];
}

/**
 * The fiber being rendered right now, or null. Only meaningful when called
 * during a component's render, in a development build of React.
 */
export function currentFiber(): Fiber | null {
  const owner = internals()?.A?.getOwner?.();
  return isFiber(owner) ? owner : null;
}

/**
 * Why React's internals can't be used, or null. Only their presence can be
 * checked up front: `getOwner()` exists only during a render, so each Adapter
 * checks it as it renders.
 */
export function internalsProblem(): string | null {
  return internals() ? null : "React exposes no client internals.";
}

export function isFiber(value: unknown): value is Fiber {
  if (typeof value !== "object" || value === null) return false;
  const fiber = value as Partial<Fiber>;
  return (
    typeof fiber.tag === "number" &&
    "key" in fiber &&
    "return" in fiber &&
    "memoizedProps" in fiber &&
    "type" in fiber
  );
}

/** Base UI keys an element cloned from a `render` prop with its `useId` (`base-ui-_R_…`). */
function isLibraryKey(key: string): boolean {
  return key.startsWith("base-ui-");
}

// Keys the App Router puts on its segment and boundary elements, as seen on
// Next 16.3: `c-page`, `c`, `layout`, `__PAGE__…`, and `layout/c/…` paths.
const ROUTER_KEYS = new Set(["c-page", "c", "layout", "template"]);
const ROUTER_KEY_PREFIXES = ["__PAGE__", "__DEFAULT__", "layout/", "template/"];

function isRouterKey(key: string): boolean {
  return ROUTER_KEYS.has(key) || ROUTER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * The app-authored keys from the root down to `fiber`, joined with `/`. Library
 * keys are skipped, and the walk stops at the first App Router key: everything
 * above it is the router's, the same for every Instance on the page.
 */
export function keyPathOf(fiber: Fiber | null): string {
  return keyPaths()(fiber);
}

/**
 * `keyPathOf` for a walk that asks about many fibers: each fiber's `return`
 * chain is followed once, and its key path remembered for the fibers below.
 */
export function keyPaths(): (fiber: Fiber | null) => string {
  // null until a fiber on the way down adds a key: an app key can be "".
  const known = new Map<Fiber, string | null>();
  return (fiber) => {
    const path: Fiber[] = [];
    let keys: string | null = null;
    for (let node = fiber; node; node = node.return) {
      if (known.has(node)) {
        keys = known.get(node) ?? null;
        break;
      }
      path.push(node);
      if (node.key !== null && isRouterKey(node.key)) break;
    }
    for (let index = path.length - 1; index >= 0; index--) {
      const node = path[index] as Fiber;
      if (node.key !== null && isRouterKey(node.key)) keys = null;
      else if (node.key !== null && !isLibraryKey(node.key)) keys = keys === null ? node.key : `${keys}/${node.key}`;
      known.set(node, keys);
    }
    return keys ?? "";
  };
}

/** The fiber React attached to a DOM node, or null. */
export function fiberOfNode(node: object): Fiber | null {
  for (const key of Object.keys(node)) {
    if (key.startsWith("__reactFiber$")) {
      const fiber = (node as Record<string, unknown>)[key];
      return isFiber(fiber) ? fiber : null;
    }
  }
  return null;
}

/** The current HostRoot fibers of every React root in this document. */
export function rootFibers(doc: Document): Fiber[] {
  const roots = new Set<Fiber>();
  const candidates: object[] = [doc, doc.documentElement, doc.body].filter(
    (node): node is HTMLElement => node !== null,
  );
  for (const node of candidates) {
    for (const key of Object.keys(node)) {
      if (!key.startsWith("__reactContainer$")) continue;
      const container = (node as Record<string, unknown>)[key];
      if (!isFiber(container)) continue;
      // The container holds the HostRoot fiber created with the root; the
      // FiberRoot it points at knows which of the two copies is current.
      const current = (container.stateNode as { current?: unknown } | null)?.current;
      roots.add(isFiber(current) ? current : container);
    }
  }
  return [...roots];
}

// React's fiber tag for a DOM element.
const HOST_COMPONENT = 5;
// React's fiber tags for a component the app wrote: function, class, forwardRef, memo, simple memo.
const COMPOSITE_TAGS: ReadonlySet<number> = new Set([0, 1, 11, 14, 15]);

/** Whether a fiber is a component someone wrote, rather than a DOM element, text or React's own. */
export function isComposite(fiber: Fiber): boolean {
  return COMPOSITE_TAGS.has(fiber.tag);
}

/**
 * The Server Components React's dev build recorded on a fiber, outermost first.
 * React records each on the first fiber its output produced. Empty in production.
 */
export function serverComponentsOn(fiber: Fiber): readonly DebugInfo[] {
  return fiber._debugInfo ?? [];
}

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

/** Calls `visit` for every fiber under `root`, depth first, without recursion. */
export function walkFibers(root: Fiber, visit: (fiber: Fiber) => void): void {
  const stack: Fiber[] = [root];
  while (stack.length > 0) {
    const fiber = stack.pop() as Fiber;
    visit(fiber);
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
}
