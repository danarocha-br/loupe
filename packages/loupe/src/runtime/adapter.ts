// `createAdapter(name, Original)`: the dev-only wrapper the loader swaps in at a
// call site. It renders Original with the app's props, plus any Overrides, and
// registers the Instance it renders. Everything else passes straight through:
// `ref` (a plain prop in React 19), `children`, context, and the element's key.

import {
  createElement,
  type ElementType,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { hintTotal } from "../call-site.js";
import type { PropMeta } from "../meta/types.js";
import { splitAuthored, writesOf } from "./authored.js";
import { currentFiber, keyPathOf } from "./fiber.js";
import {
  ANCHOR_PROP,
  disableOverrides,
  emitChange,
  identityOf,
  instanceId,
  type MountedInstance,
  register,
  registry,
  SOURCE_PROP,
  UNANCHORED,
  unregister,
  withoutLoaderProps,
} from "./registry.js";
import { createHoldTracker, formatValue, holdStateHandlers, trackHeldStates } from "./state.js";
import type { Props } from "./store.js";

export type AdapterOptions = {
  /**
   * Every prop the component declares, as `generate` read it (PER-117): which are
   * Editable props, and why the others are inspect-only. The Toolbar's Coverage reads it.
   */
  props?: Readonly<Record<string, PropMeta>>;
  /** State props (`X` with `onXChange`). Defaults to the props `props` flags `state`. */
  state?: readonly string[];
};

const ADAPTER = Symbol.for("loupe.adapter");

// React's own fields on memo, forwardRef and lazy objects, and a function's
// built-ins. Copying `$$typeof` from a memo would turn the Adapter into one.
const NOT_HOISTED = new Set([
  "$$typeof",
  "type",
  "compare",
  "render",
  "_payload",
  "_init",
  "displayName",
  "name",
  "length",
  "prototype",
  "arguments",
  "caller",
  "propTypes",
  "defaultProps",
  "contextTypes",
]);

/** The component name an Adapter was created for, or null for anything else. */
export function adaptedName(type: unknown): string | null {
  if (typeof type !== "function") return null;
  const name = (type as unknown as Record<symbol, unknown>)[ADAPTER];
  return typeof name === "string" ? name : null;
}

export function createAdapter<C extends ElementType>(name: string, Original: C, options: AdapterOptions = {}): C {
  const meta = options.props ?? null;
  const stateProps = Object.freeze([
    ...(options.state ??
      Object.keys(meta ?? {})
        .filter((prop) => meta?.[prop]?.state === true)
        .sort()),
  ]);

  function Adapter(props: Props) {
    const latest = useRef(props);
    const [, force] = useReducer((n: number) => n + 1, 0);
    const mounted = useRef<{ baseId: string; instance: MountedInstance } | null>(null);
    const [holds] = useState(createHoldTracker);

    const onClient = typeof window !== "undefined";
    const reg = onClient ? registry() : null;
    const fiber = onClient ? currentFiber() : null;
    // The self-check (PER-98): React must name this component as the one rendering.
    const identified = fiber !== null && adaptedName(fiber.type) === name;
    if (reg?.status.overrides && !identified) {
      const reason =
        fiber === null
          ? "React reported no fiber while an Adapter rendered."
          : "React reported a different fiber than the Adapter rendering.";
      // Not during render: it rerenders every other Instance.
      queueMicrotask(() => disableOverrides(reason));
    }

    const anchor =
      typeof props[ANCHOR_PROP] === "string" ? (props[ANCHOR_PROP] as string) : `${UNANCHORED} › ${name}`;
    const keyPath = identified ? keyPathOf(fiber) : "";
    const baseId = instanceId(anchor, keyPath);
    // Overrides apply only once this Instance holds its id, so a duplicate never
    // borrows another's for a render.
    const registered = mounted.current?.baseId === baseId ? mounted.current.instance : null;

    const resolved =
      reg?.status.overrides && identified && registered
        ? reg.store.resolve({ ...identityOf(registered), current: props })
        : null;
    const overrides = resolved?.overrides ?? {};

    // Says once per attempt that an Override holds a State prop the app wants to
    // change. Nothing is blocked; reset hands control back.
    const reportHeldStates = (instance: MountedInstance, held: Props): void => {
      if (stateProps.length === 0) return;
      for (const attempt of trackHeldStates(holds, stateProps, instance.live().current, held)) {
        console.info(
          `[loupe] ${instance.id}: your Override holds ${attempt.prop} at ${formatValue(attempt.held)}; the app tried to set ${formatValue(attempt.tried)}. Reset it to hand control back.`,
        );
      }
    };

    // Committed renders only: a discarded render must not reach `live()` or `pick()`.
    useLayoutEffect(() => {
      latest.current = props;
      const instance = mounted.current?.instance;
      if (instance) {
        instance.fiber = fiber;
        instance.hint = hintOf(props);
        instance.renders++;
        observeCallSite(instance);
        reportHeldStates(instance, overrides);
        // The Toolbar's Current values are live.
        emitChange();
      }
    });

    // A new id (the anchor changed under Fast Refresh) is a new registration.
    useLayoutEffect(() => {
      const instance = register(baseId, {
        anchor,
        hint: hintOf(latest.current),
        component: name,
        keyPath,
        live: () => splitAuthored(withoutLoaderProps(latest.current), writesOf(latest.current)),
        writes: () => writesOf(latest.current),
        stateProps,
        meta,
        attempts: holds.attempts,
        notify: force,
        fiber,
        renders: 1,
      });
      mounted.current = { baseId, instance };
      observeCallSite(instance);
      // Before paint: an Override kept across a remount shows on the first frame.
      // A group or page Override set before this mount reaches it the same way.
      if (registry().store.applies(identityOf(instance))) force();
      return () => {
        unregister(instance);
        mounted.current = null;
      };
    }, [baseId]);

    const rendered = resolved
      ? holdStateHandlers(resolved.props, overrides, stateProps, holds.attempts, force)
      : props;
    return createElement(Original as ElementType, rendered);
  }

  for (const key of Object.getOwnPropertyNames(Original)) {
    if (NOT_HOISTED.has(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(Original, key);
    if (descriptor) Object.defineProperty(Adapter, key, descriptor);
  }
  Adapter.displayName = `Loupe(${name})`;
  Object.defineProperty(Adapter, ADAPTER, { value: name });
  return Adapter as unknown as C;
}

/** The hop guard. Runs before paint, so a suspended Override is never shown. */
function observeCallSite(instance: MountedInstance): void {
  registry().store.observe({ id: instance.id, anchor: instance.anchor, total: hintTotal(instance.hint) });
}

function hintOf(props: Props): string | null {
  return typeof props[SOURCE_PROP] === "string" ? (props[SOURCE_PROP] as string) : null;
}
