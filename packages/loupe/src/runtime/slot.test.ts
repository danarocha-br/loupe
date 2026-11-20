// Loupe's page state (PER-218): one value per key per page, kept when a module is
// evaluated again, and started over by `resetLoupe()` as a reload would.
import { afterEach, describe, expect, it, vi } from "vitest";
import { perPage, resetLoupe } from "./slot.js";

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
    perPage("test:queue", () => ({ list: [1], queue: "running" }), {
      stop,
      restart: (old) => ({ list: [], queue: old.queue }),
    });
    resetLoupe();
    expect(perPage("test:queue", () => ({ list: [9], queue: "idle" }))).toEqual({ list: [], queue: "running" });
    expect(stop).not.toHaveBeenCalled();
  });
});
