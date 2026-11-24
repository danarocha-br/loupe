import { describe, expect, it } from "vitest";
import { labelPlace, labelText } from "./highlight.js";

describe("the selected Instance's size tag on the page", () => {
  const ring = { top: 200, left: 300, width: 120, height: 32, label: "Button" };

  it("names the Instance and its rendered size", () => {
    expect(labelText({ ...ring, width: 119.6 })).toBe("Button · 120 × 32");
  });

  it("ends at the outline's right, goes under it near the window's top, and starts at its left where it would run off the left edge", () => {
    expect(labelPlace(ring)).toEqual({ below: false, start: false });
    expect(labelPlace({ ...ring, top: 10 })).toEqual({ below: true, start: false });
    // A 32px button 4px from the window's left: ending at its right, the tag would start off-screen (review 2026-11-20).
    expect(labelPlace({ ...ring, left: 4, width: 32 })).toEqual({ below: false, start: true });
  });
});
