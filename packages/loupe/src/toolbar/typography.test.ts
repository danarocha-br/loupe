import { describe, expect, it } from "vitest";
import { isolate, reachText } from "./panel-view/words.js";
import { CSS } from "./styles.js";

describe("the toolbar's type (typography review 2026-11-20)", () => {
  it("writes every font size through the reader-scaled unit, never a bare px", () => {
    // `font: 500 12px/…` or `font-size: 12px` would ignore a reader's larger default text.
    expect(CSS).not.toMatch(/font: \d{3} \d+(\.\d+)?px/);
    expect(CSS).not.toMatch(/font-size: \d+(\.\d+)?px/);
    expect(CSS).toContain("--loupe-px: 1px;");
    expect(CSS).toContain(":host([data-loupe-scale]) { --loupe-px: calc(1em / 16); }");
  });

  it("smooths once on the root and leaves weight synthesis to the browser", () => {
    expect(CSS).not.toContain("font-synthesis: none");
    expect(CSS.match(/-webkit-font-smoothing/g)).toHaveLength(1);
    expect(CSS).toContain("-moz-osx-font-smoothing: grayscale");
  });

  it("isolates an app's name inside an English sentence", () => {
    expect(isolate("أحمد")).toBe("⁨أحمد⁩");
    expect(reachText("أحمد", 3)).toBe("⁨أحمد⁩ and 2 more");
    expect(reachText("Ana", 1)).toBe("Ana");
  });
});
