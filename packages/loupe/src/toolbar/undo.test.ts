import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoupeDebug } from "../runtime/debug.js";
import { dismissUndo, keepUndoWhile, offerUndo, recordsKey, takeUndo, useUndoOffer } from "./undo.js";

// The hook reads the same store the footer does; outside React, read it through a stand-in.
vi.mock("react", () => ({ useSyncExternalStore: (_subscribe: unknown, current: () => unknown) => current() }));

afterEach(() => {
  dismissUndo();
  vi.useRealTimers();
});

const offered = () => useUndoOffer()?.text ?? null;

describe("the undo offer", () => {
  it("has no timer: it stays until it is taken, replaced or the Overrides move on (WCAG 2.2.1)", () => {
    vi.useFakeTimers();
    offerUndo("Reset 2 Overrides", () => {}, "after");
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(offered()).toBe("Reset 2 Overrides");

    keepUndoWhile("after");
    expect(offered()).toBe("Reset 2 Overrides");
    keepUndoWhile("something else");
    expect(offered()).toBeNull();
  });

  it("puts back once, and a newer offer replaces the older", () => {
    const undo = vi.fn();
    offerUndo("Reset 1 Override", () => {}, "a");
    offerUndo("Discarded 1 held Override", undo, "b");
    expect(offered()).toBe("Discarded 1 held Override");
    takeUndo();
    takeUndo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(offered()).toBeNull();
  });

  it("keys the Overrides without which Instances are mounted, so a menu closing ends nothing", () => {
    const record = { target: { scope: "instance", id: "a" }, values: { variant: "ghost" }, excluded: [], suspended: null };
    const debug = (mounted: string[]) => ({ records: () => [{ ...record, mounted }] }) as unknown as LoupeDebug;
    expect(recordsKey(debug(["a"]))).toBe(recordsKey(debug([])));
    const changed = { records: () => [{ ...record, values: { variant: "default" }, mounted: [] }] } as unknown as LoupeDebug;
    expect(recordsKey(changed)).not.toBe(recordsKey(debug([])));
  });
});
