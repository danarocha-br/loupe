// @vitest-environment jsdom
// Loupe's page state (PER-218): one value per key per page, kept when a module is
// evaluated again, and started over by `resetLoupe()` as a reload would.
import { afterEach, describe, expect, it, vi } from "vitest";
import { debugOf, type LoupeDebug } from "./debug.js";
import { perPage, resetLoupe } from "./slot.js";

const host = window as typeof window & { __loupe?: LoupeDebug };

afterEach(() => {
  resetLoupe();
});

describe("perPage", () => {
  it("makes a key's value once, and a module evaluated again finds it", async () => {
    const make = vi.fn(() => ({ n: 1 }));
    const value = perPage("test:once", make);
    expect(perPage("test:once", make)).toBe(value);
    vi.resetModules();
    const again = await import("./slot.js");
    expect(again.perPage("test:once", () => ({ n: 2 }))).toBe(value);
    expect(make).toHaveBeenCalledOnce();
  });
});

describe("resetLoupe", () => {
  it("drops every value and stops each, newest first", () => {
    const stopped: string[] = [];
    perPage("test:first", () => "first", { stop: (value) => stopped.push(value) });
    perPage("test:second", () => "second", { stop: (value) => stopped.push(value) });
    resetLoupe();
    expect(stopped).toEqual(["second", "first"]);
    expect(perPage("test:first", () => "made again")).toBe("made again");
  });

  it("puts what restart returns in a value's place, and stops nothing of it", () => {
    const stop = vi.fn();
    perPage("test:snapshots", () => ({ list: [1], queue: "capturing" }), {
      stop,
      restart: (old) => ({ list: [], queue: old.queue }),
    });
    resetLoupe();
    expect(perPage("test:snapshots", () => ({ list: [9], queue: "idle" }))).toEqual({ list: [], queue: "capturing" });
    expect(stop).not.toHaveBeenCalled();
  });
});

describe("debugOf", () => {
  it("makes window.__loupe on first use, and resetLoupe() takes it away", () => {
    const debug = debugOf();
    expect(host.__loupe).toBe(debug);
    expect(debugOf()).toBe(debug);
    resetLoupe();
    expect("__loupe" in window).toBe(false);
    expect(debugOf()).not.toBe(debug);
  });

  it("puts the page's own back when window.__loupe was deleted", () => {
    const debug = debugOf();
    delete host.__loupe;
    expect(debugOf()).toBe(debug);
    expect(host.__loupe).toBe(debug);
  });

  it("returns a stand-in already on window.__loupe, and resetLoupe() leaves it there", () => {
    debugOf();
    const stub = {} as LoupeDebug;
    host.__loupe = stub;
    try {
      expect(debugOf()).toBe(stub);
      resetLoupe();
      expect(host.__loupe).toBe(stub);
    } finally {
      delete host.__loupe;
    }
  });
});
