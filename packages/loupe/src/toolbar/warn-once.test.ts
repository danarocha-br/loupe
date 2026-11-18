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
