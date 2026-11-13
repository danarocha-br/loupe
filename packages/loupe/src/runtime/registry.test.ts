// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { callSiteId, instanceId } from "../call-site.js";
import { type MountedInstance, type Registry, registry } from "./registry.js";

const GLOBAL_KEY = "__loupeRegistry";
const ANCHOR = callSiteId({ path: "app/page.tsx", enclosing: "Page", component: "Button", ordinal: 1 });
const ID = instanceId(ANCHOR, "");

afterEach(() => {
  delete (globalThis as { [GLOBAL_KEY]?: unknown })[GLOBAL_KEY];
});

/** A registry as a version before Override resolution kept it: status and view beside a store with no `render`. */
function keepOldRegistry(status: Registry["store"]["status"], view: "proposed" | "before") {
  const notify = vi.fn();
  const instance = { id: ID, anchor: ANCHOR, component: "Button", hint: null, notify } as unknown as MountedInstance;
  const old = {
    store: { records: () => [], subscribe: () => () => {} },
    instances: new Map([[ID, instance]]),
    departed: new Map(),
    listeners: new Set(),
    instanceMeta: new Map(),
    status,
    view,
  };
  (globalThis as { [GLOBAL_KEY]?: unknown })[GLOBAL_KEY] = old;
  return { old, notify };
}

describe("the registry across a Fast Refresh", () => {
  it("moves an older registry's status and view into a new store, and keeps its Instances", () => {
    const { old } = keepOldRegistry({ overrides: false, reason: "React reported no fiber." }, "before");
    const value = registry();
    expect(value).toBe(old);
    expect(value.instances.has(ID)).toBe(true);
    expect(value.store.status).toEqual({ overrides: false, reason: "React reported no fiber." });
    expect(value.store.view).toBe("before");
    expect("status" in value).toBe(false);
    expect("view" in value).toBe(false);
  });

  it("rerenders a kept Instance when an Override in the new store reaches it", () => {
    const { notify } = keepOldRegistry({ overrides: true }, "proposed");
    const value = registry();
    value.store.set({ scope: "group", anchor: ANCHOR }, "variant", "destructive");
    expect(notify).toHaveBeenCalledOnce();
  });
});
