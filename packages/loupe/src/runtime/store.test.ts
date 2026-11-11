import { describe, expect, it, vi } from "vitest";
import { createOverrideStore } from "./store.js";

const ROW_1 = "app/menu.tsx › Menu › Button[1]#m1";
const ROW_2 = "app/menu.tsx › Menu › Button[1]#m2";

describe("Override store", () => {
  it("resolves to the Current value, every value from the app, when nothing is overridden", () => {
    const store = createOverrideStore();
    const resolved = store.resolve({ id: ROW_1, current: { variant: "ghost", size: "icon" } });
    expect(resolved).toEqual({
      props: { variant: "ghost", size: "icon" },
      sources: { variant: "app", size: "app" },
      overrides: {},
    });
  });

  it("puts an Instance Override on top of the Current value and names its source", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    const resolved = store.resolve({ id: ROW_1, current: { variant: "ghost", size: "icon" } });
    expect(resolved.props).toEqual({ variant: "destructive", size: "icon" });
    expect(resolved.sources).toEqual({ variant: "instance", size: "app" });
    expect(resolved.overrides).toEqual({ variant: "destructive" });
  });

  it("can override a prop the app never passed", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "disabled", true);
    const resolved = store.resolve({ id: ROW_1, current: {} });
    expect(resolved.props).toEqual({ disabled: true });
    expect(resolved.sources).toEqual({ disabled: "instance" });
  });

  it("treats undefined as an Override that unsets the prop", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", undefined);
    const resolved = store.resolve({ id: ROW_1, current: { variant: "ghost" } });
    expect("variant" in resolved.props).toBe(true);
    expect(resolved.props.variant).toBeUndefined();
    expect(resolved.sources.variant).toBe("instance");
  });

  it("keeps repeated Instances independent", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    expect(store.resolve({ id: ROW_2, current: { variant: "ghost" } }).props.variant).toBe("ghost");
    expect(store.has(ROW_2)).toBe(false);
  });

  it("follows the live Current value under an Override, so computed props keep updating", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    expect(store.resolve({ id: ROW_1, current: { variant: "ghost", disabled: false } }).props).toEqual({
      variant: "destructive",
      disabled: false,
    });
    expect(store.resolve({ id: ROW_1, current: { variant: "ghost", disabled: true } }).props).toEqual({
      variant: "destructive",
      disabled: true,
    });
  });

  it("resets one prop back to the Current value and leaves the others", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    store.set(ROW_1, "size", "lg");
    store.reset(ROW_1, "variant");
    const resolved = store.resolve({ id: ROW_1, current: { variant: "ghost", size: "icon" } });
    expect(resolved.props).toEqual({ variant: "ghost", size: "lg" });
    expect(resolved.sources).toEqual({ variant: "app", size: "instance" });
  });

  it("resets every prop of an Instance and drops its record", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    store.set(ROW_1, "size", "lg");
    store.set(ROW_2, "size", "sm");
    store.reset(ROW_1);
    expect(store.has(ROW_1)).toBe(false);
    expect(store.records()).toEqual([{ scope: "instance", target: ROW_2, values: { size: "sm" } }]);
  });

  it("resetting the last prop drops the record", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    store.reset(ROW_1, "variant");
    expect(store.has(ROW_1)).toBe(false);
    expect(store.records()).toEqual([]);
  });

  it("tells listeners which Instance changed, and only when something did", () => {
    const store = createOverrideStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(ROW_1, "variant", "destructive");
    store.set(ROW_1, "variant", "destructive");
    store.reset(ROW_2);
    store.reset(ROW_1, "size");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith([ROW_1]);

    store.reset(ROW_1);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set(ROW_2, "size", "sm");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies when an Override changes from a value to undefined", () => {
    const store = createOverrideStore();
    const listener = vi.fn();
    store.set(ROW_1, "variant", "destructive");
    store.subscribe(listener);
    store.set(ROW_1, "variant", undefined);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps records by Instance id, independent of anything being mounted", () => {
    const store = createOverrideStore();
    store.set(ROW_1, "variant", "destructive");
    // Whatever unmounts and mounts again under the same id finds its Override.
    expect(store.resolve({ id: ROW_1, current: { variant: "ghost" } }).props.variant).toBe(
      "destructive",
    );
  });
});
