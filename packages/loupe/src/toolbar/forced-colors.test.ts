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
    expect(all.find((rule) => rule.selector === "[data-start] h2:focus")?.body).toMatch(/outline: 2px solid transparent/);
  });
});

/** The rules inside the stylesheet's `@media (forced-colors: active)` blocks. */
function forcedRules(css: string): { selector: string; body: string }[] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: { selector: string; body: string }[] = [];
  for (let at = plain.indexOf("@media (forced-colors: active)"); at !== -1; at = plain.indexOf("@media (forced-colors: active)", at + 1)) {
    // The block runs to the brace that closes the one after the query.
    let depth = 0;
    let end = plain.indexOf("{", at);
    for (let i = end; i < plain.length; i++) {
      if (plain[i] === "{") depth++;
      if (plain[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    found.push(...rules(plain.slice(plain.indexOf("{", at) + 1, end)));
  }
  return found;
}

describe("marks under forced colours (Dot, Tag, Kbd, Delta)", () => {
  // Forced colours drop backgrounds and box-shadows and redraw borders, outlines, text, fill and stroke in system colours.
  const all = rules(CSS);
  const forced = forcedRules(CSS);
  const of = (attribute: string) => all.filter((rule) => rule.selector.includes(attribute));

  it("draws a filled dot in CanvasText, and a hollow or ringed one with a border they keep", () => {
    for (const tone of ["alert", "amber", "lilac"]) {
      const rule = forced.find((r) => r.selector.split(",").some((s) => s.trim() === `[data-dot="${tone}"]`));
      expect(rule?.body, tone).toMatch(/forced-color-adjust: none;[^}]*background: CanvasText/);
    }
    for (const tone of ["hollow", "ring"]) expect(all.find((rule) => rule.selector === `[data-dot="${tone}"]`)?.body, tone).toMatch(/border: [\d.]+px solid/);
    expect(of("[data-dot").filter((rule) => /box-shadow/.test(rule.body))).toEqual([]);
  });

  it("keeps a tag's pill and a key's box: an outline, which forced colours draw once the fill goes", () => {
    for (const element of ["[data-tag-look]", "[data-kbd]"]) {
      expect(all.find((rule) => rule.selector === element)?.body, element).toMatch(/outline: 1px solid transparent/);
      expect(of(element).filter((rule) => /box-shadow/.test(rule.body)), element).toEqual([]);
    }
  });

  it("draws a delta's triangle and number in system colours", () => {
    expect(forced.find((rule) => rule.selector === "[data-delta] path")?.body).toMatch(/fill: Canvas;[^}]*stroke: CanvasText/);
    expect(forced.find((rule) => rule.selector === "[data-delta-n]")?.body).toMatch(/color: CanvasText/);
  });

  it("leaves none of the views' old dot, tag, key or delta classes behind", () => {
    const old = all.filter((rule) => /(^|[\s,])(\.dot|\.tag|\.key|\.delta|kbd)\b(?![-\w])/.test(rule.selector));
    expect(old.map((rule) => rule.selector)).toEqual([]);
  });
});
