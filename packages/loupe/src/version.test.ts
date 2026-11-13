import { describe, expect, it } from "vitest";
import { compareVersions } from "./version.js";

describe("compareVersions", () => {
  it.each([
    ["0.0.5", "0.0.4", 1],
    ["0.0.10", "0.0.9", 1],
    ["0.1.0", "0.0.99", 1],
    ["1.0.0", "1.0.0", 0],
    ["1.0.0+build.2", "1.0.0", 0],
    ["1.0.0-beta.1", "1.0.0", -1],
    ["1.0.0-beta.10", "1.0.0-beta.9", 1],
    ["1.0.0-alpha", "1.0.0-beta", -1],
    ["1.0.0-alpha.1", "1.0.0-alpha", 1],
    ["1.0.0-1", "1.0.0-alpha", -1],
  ])("orders %s against %s", (a, b, sign) => {
    expect(compareVersions(a, b)).toBe(sign);
    expect(compareVersions(b, a)).toBe(-sign || 0);
  });
});
