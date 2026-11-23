// What forced colours (Windows High Contrast) keep of the toolbar's focus (accessibility
// review 2026-11-23). They drop box-shadows, so a field whose focus is a ring and a glow
// would show none: each keeps a transparent outline on focus, which forced colours draw.

import { describe, expect, it } from "vitest";
import { STYLESHEET as CSS } from "./surface/index.js";

/** Every rule as selector and body, at any depth of `@media` and `@layer`. */
function rules(css: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    found.push({ selector: (match[1] as string).trim(), body: match[2] as string });
  }
  return found;
}

describe("focus under forced colours", () => {
  const all = rules(CSS);

  it("keeps an outline forced colours draw on every field that trades its outline for a ring", () => {
    // Every text field is Field's (ui/field): it drops the outline once, and each look draws its own ring.
    const fields = all.filter((rule) => /outline: none/.test(rule.body) && /(input|textarea|\.text|\[data-field-control\])\s*$/.test(rule.selector));
    expect(fields.map((rule) => rule.selector)).toEqual(["[data-field-control]"]);
    for (const look of ["filled", "outline", "well"]) {
      const selector = `[data-look="${look}"] [data-field-control]`;
      const focus = all.find((rule) => rule.selector === `${selector}:focus` || rule.selector === `${selector}:focus-visible`);
      expect(focus?.body, look).toMatch(/box-shadow:/);
      expect(focus?.body, look).toMatch(/outline: 2px solid transparent/);
    }
  });

  it("hides no focus outright: a rule for focus that drops the ring keeps an outline forced colours draw", () => {
    const hidden = all.filter((rule) => /:focus(-visible)?$/.test(rule.selector) && /outline: none/.test(rule.body));
    expect(hidden.map((rule) => rule.selector)).toEqual([]);
    expect(all.find((rule) => rule.selector === ".hero .hero-title:focus")?.body).toMatch(/outline: 2px solid transparent/);
  });
});
