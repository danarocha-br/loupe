import { afterEach, describe, expect, it, vi } from "vitest";
import { warnOnce } from "./warn-once.js";

afterEach(() => vi.restoreAllMocks());

describe("warnOnce", () => {
  it("warns the first time a message comes and never again", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("[loupe] first");
    warnOnce("[loupe] first");
    warnOnce("[loupe] second");
    warnOnce("[loupe] first");
    expect(warn.mock.calls).toEqual([["[loupe] first"], ["[loupe] second"]]);
  });

  it("forgets the oldest messages rather than growing without bound", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("[loupe] flood 0");
    for (let n = 1; n <= 1000; n += 1) warnOnce(`[loupe] flood ${n}`);
    warn.mockClear();
    warnOnce("[loupe] flood 1000");
    expect(warn).not.toHaveBeenCalled();
    warnOnce("[loupe] flood 0");
    expect(warn.mock.calls).toEqual([["[loupe] flood 0"]]);
  });

  it("counts two long messages that agree on their first characters as one, and logs the whole of the first", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const long = (end: string) => `[loupe] long ${"x".repeat(2000)}${end}`;
    warnOnce(long("a"));
    warnOnce(long("b"));
    expect(warn.mock.calls).toEqual([[long("a")]]);
  });

  it("logs through the function it is given, and remembers the message whichever one that was", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.fn();
    warnOnce("[loupe] on the error log", log);
    warnOnce("[loupe] on the error log", log);
    warnOnce("[loupe] on the error log");
    expect(log.mock.calls).toEqual([["[loupe] on the error log"]]);
    expect(warn).not.toHaveBeenCalled();
  });
});
