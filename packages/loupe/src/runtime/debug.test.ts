// @vitest-environment jsdom
// `debugOf()` (PER-218): the page's `window.__loupe`, made on first use and kept in
// the page's slot, which `resetLoupe()` takes away again. A stand-in a test put
// there is returned as it is, and left there.
import { afterEach, describe, expect, it } from "vitest";
import { debugOf, type LoupeDebug } from "./debug.js";
import { resetLoupe } from "./slot.js";

const host = window as typeof window & { __loupe?: LoupeDebug };

afterEach(() => {
  resetLoupe();
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
