import { describe, expect, it } from "vitest";
import { isolate, reachText } from "./panel-view/words.js";
import { STYLESHEET as CSS } from "./surface/index.js";
import { FONT, font, leading, TYPE, TYPE_PROPERTIES, type TypeRole } from "./tokens.js";

const steps = Object.entries(TYPE) as [TypeRole, (typeof TYPE)[TypeRole]][];

describe("the toolbar's type (typography review 2026-11-20)", () => {
  it("writes every step through the reader-scaled unit", () => {
    expect(font(TYPE.control)).toBe(`500 calc(var(--loupe-px) * 12)/1.3333 ${FONT.sans}`);
    for (const [role, style] of steps) expect(font(style), role).toMatch(/^\d{3} calc\(var\(--loupe-px\) \* \d+\)\/[\d.]+ /);
  });

  it("keeps mono for evidence and tabular figures for counted numbers", () => {
    const mono = steps.filter(([, style]) => style.family === "mono").map(([role]) => role);
    expect(mono.sort()).toEqual(["annotation", "chip", "count", "key", "mono", "monoSmall", "proposalText", "tagMono"]);
    const tabular = steps.filter(([, style]) => "tabular" in style && style.tabular).map(([role]) => role);
    expect(tabular.sort()).toEqual(["count", "delta", "figure", "meta"]);
  });

  it("gives the 9px step to the delta alone, and wraps a paragraph on at least 1.4", () => {
    expect(steps.filter(([, style]) => style.size === 9).map(([role]) => role)).toEqual(["delta"]);
    expect(leading(TYPE.paragraph)).toBeGreaterThanOrEqual(1.4);
  });

  it("matches what the stylesheet writes for each step it sets as a shorthand", () => {
    // Hero and a touch field set size and line height apart, not as `font:`. A primitive's
    // real CSS file reads the step's custom property, which the host declares from the module.
    for (const [role, style] of steps) {
      const property = Object.keys(TYPE_PROPERTIES).find((name) => TYPE_PROPERTIES[name] === font(style));
      expect(CSS, role).toContain(`--${property}: ${font(style)};`);
      if (role === "hero" || role === "fieldTouch") continue;
      expect(CSS.includes(`font: ${font(style)}`) || CSS.includes(`font: var(--${property})`), role).toBe(true);
    }
  });

  it("declares each tracked step's tracking once, for a primitive's CSS to read", () => {
    const tracked = steps.filter(([, style]) => "tracking" in style);
    expect(tracked.length).toBeGreaterThan(0);
    for (const [role, style] of tracked) {
      const name = `tracking-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      expect(TYPE_PROPERTIES[name], role).toBe((style as { tracking: string }).tracking);
      expect(CSS, role).toContain(`--${name}: ${(style as { tracking: string }).tracking};`);
    }
    // The primitives read it: a literal `letter-spacing: 0.02em` in their CSS would drift from the token.
    expect(CSS).toContain("letter-spacing: var(--tracking-tag-mono)");
    expect(CSS).toContain("letter-spacing: var(--tracking-annotation)");
  });

  it("writes every font size in a rule through the reader-scaled unit, never a bare px", () => {
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
