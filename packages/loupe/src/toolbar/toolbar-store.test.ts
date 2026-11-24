// The toolbar's store (ADR 0009), driven through its interface: what each write leaves,
// and that a listener hears a change once and a write that changes nothing not at all.

import { describe, expect, it, vi } from "vitest";
import { createToolbarStore, scopeOf } from "./toolbar-store.js";

const listening = () => {
  const store = createToolbarStore();
  const heard = vi.fn();
  store.subscribe(heard);
  return { store, heard };
};

describe("the toolbar store", () => {
  it("starts on the list, at Select one, with the marks on and nothing pointed at", () => {
    const state = createToolbarStore().get();
    expect(state).toEqual({ selected: null, mode: "one", widened: false, marksHidden: false, hovered: [], lit: null });
    expect(scopeOf(state)).toBe("instance");
  });

  it("selects with or without a tool, and a new selection starts at its call site again", () => {
    const { store } = listening();
    store.select("btn-1", "many");
    expect(store.get()).toMatchObject({ selected: "btn-1", mode: "many" });
    expect(scopeOf(store.get())).toBe("group");

    store.setScope("page");
    expect(scopeOf(store.get())).toBe("page");
    // The tool stays as chosen; widening doesn't.
    store.select("btn-2");
    expect(store.get()).toMatchObject({ selected: "btn-2", mode: "many", widened: false });
    expect(scopeOf(store.get())).toBe("group");

    store.select(null);
    expect(store.get().selected).toBeNull();
  });

  it("sets the scope through the tool and the widen link", () => {
    const { store } = listening();
    store.setScope("group");
    expect(store.get()).toMatchObject({ mode: "many", widened: false });
    store.setScope("page");
    expect(store.get()).toMatchObject({ mode: "many", widened: true });
    store.setScope("instance");
    expect(store.get()).toMatchObject({ mode: "one", widened: false });
  });

  it("toggles Hide marks", () => {
    const { store } = listening();
    store.toggleMarks();
    expect(store.get().marksHidden).toBe(true);
    store.toggleMarks();
    expect(store.get().marksHidden).toBe(false);
  });

  it("keeps the same ids as they are, as the pointer crosses a row's children", () => {
    const { store, heard } = listening();
    store.hover(["a", "b"]);
    const first = store.get().hovered;
    store.hover(["a", "b"]);
    expect(store.get().hovered).toBe(first);
    expect(heard).toHaveBeenCalledTimes(1);
    store.hover([]);
    expect(store.get().hovered).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("lights what a row or a block points at and outlines its Instances, in one change", () => {
    const { store, heard } = listening();
    store.point({ component: "Button", outlineIds: ["btn-1", "btn-2"] });
    expect(store.get()).toMatchObject({ lit: "Button", hovered: ["btn-1", "btn-2"] });
    expect(heard).toHaveBeenCalledTimes(1);

    store.point(null);
    expect(store.get()).toMatchObject({ lit: null, hovered: [] });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("clears the light alone, leaving the outline as it was", () => {
    const { store } = listening();
    store.point({ component: "Badge", outlineIds: ["badge-1"] });
    store.clearLight();
    expect(store.get()).toMatchObject({ lit: null, hovered: ["badge-1"] });
  });

  it("tells no one of a write that changes nothing, and stops telling a listener that left", () => {
    const store = createToolbarStore();
    const heard = vi.fn();
    const leave = store.subscribe(heard);
    store.select(null);
    store.setScope("instance");
    store.clearLight();
    store.point(null);
    expect(heard).not.toHaveBeenCalled();

    store.toggleMarks();
    expect(heard).toHaveBeenCalledTimes(1);
    leave();
    store.toggleMarks();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("is one per Toolbar: two stores share nothing", () => {
    const one = createToolbarStore();
    const two = createToolbarStore();
    one.select("btn-1");
    expect(two.get().selected).toBeNull();
  });
});
