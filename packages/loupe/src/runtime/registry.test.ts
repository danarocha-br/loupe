// @vitest-environment jsdom
// The registry is the page's (PER-218). A Fast Refresh that evaluates this module
// again finds it, and after a `resetLoupe()` nothing of the old one listens.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callSiteId, instanceId } from "../call-site.js";
import { committed, type MountedInstance, register, registry } from "./registry.js";
import { resetLoupe } from "./slot.js";

const ANCHOR = callSiteId({ path: "app/page.tsx", enclosing: "Page", component: "Button", ordinal: 1 });
const ID = instanceId(ANCHOR, "");
const ON_THIS_PAGE = { scope: "page", route: "/", component: "Button" } as const;

beforeEach(() => {
  resetLoupe();
  history.replaceState(null, "", "/");
});

/** Puts a stand-in for a mounted Instance in the registry, and returns the spy for its rerenders. */
function addInstance() {
  const notify = vi.fn();
  const instance = { id: ID, anchor: ANCHOR, component: "Button", hint: null, notify } as unknown as MountedInstance;
  registry().instances.set(ID, instance);
  return notify;
}

const navigated = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the registry", () => {
  it("is the same one after a Fast Refresh evaluates its module again", async () => {
    const value = registry();
    vi.resetModules();
    const again = await import("./registry.js");
    expect(again.registry()).toBe(value);
  });

  it("is a new, empty one after resetLoupe(), as after a reload", () => {
    const value = registry();
    value.store.set({ scope: "instance", id: ID }, "variant", "destructive");
    resetLoupe();
    expect(registry()).not.toBe(value);
    expect(registry().store.records()).toEqual([]);
  });
});

describe("watching the route", () => {
  it("rerenders the Instances a page Override reaches after a navigation", async () => {
    const notify = addInstance();
    registry().store.set(ON_THIS_PAGE, "variant", "destructive");
    notify.mockClear();
    history.pushState(null, "", "/billing");
    await navigated();
    expect(notify).toHaveBeenCalledOnce();
  });

  it("reads the registry of the moment, so a reset leaves nothing listening on the old one", async () => {
    const old = addInstance();
    registry().store.set(ON_THIS_PAGE, "variant", "destructive");
    resetLoupe();
    const notify = addInstance();
    registry().store.set(ON_THIS_PAGE, "variant", "destructive");
    old.mockClear();
    notify.mockClear();
    history.pushState(null, "", "/billing");
    await navigated();
    expect(notify).toHaveBeenCalledOnce();
    expect(old).not.toHaveBeenCalled();
  });

  it("does nothing while no page Override is set", async () => {
    const notify = addInstance();
    registry().store.set({ scope: "instance", id: ID }, "variant", "destructive");
    notify.mockClear();
    history.pushState(null, "", "/billing");
    await navigated();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("a mounted Instance", () => {
  it("keeps the route it mounted on, and committed() writes its fiber, hint and render count", () => {
    const entry = { anchor: ANCHOR, hint: null, component: "Button", keyPath: "", stateProps: [], meta: null, fiber: null };
    history.replaceState(null, "", "/members");
    const instance = register(ID, entry as unknown as Parameters<typeof register>[1]);
    expect(instance).toMatchObject({ id: ID, route: "/members", renders: 1 });
    history.pushState(null, "", "/billing");
    committed(instance, null, "app/page.tsx:12:5 1/1");
    expect(instance).toMatchObject({ route: "/members", renders: 2, hint: "app/page.tsx:12:5 1/1" });
  });
});
