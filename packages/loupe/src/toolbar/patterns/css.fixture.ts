// What every pattern's CSS keeps true (ADR 0003, DESIGN.md "Layers"): it sits in the
// `patterns` layer of the stylesheet the surface adopts, after the primitives; it names
// state and part attributes, never a view's class or ARIA; and it takes colour, type and
// corners from the tokens, never a literal.

import { expect } from "vitest";
import { STYLESHEET } from "../surface/index.js";

export function expectPatternCss(css: string): void {
  const at = STYLESHEET.indexOf(css);
  expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer patterns {"));
  expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // No class selector: a pattern is written against attributes.
  expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
  expect(body).not.toMatch(/aria-|role=/);
  // Colours, type and corners come from the tokens.
  expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  expect(body).not.toMatch(/font(-size)?: *\d|font-family: *[a-z"]/i);
  expect(body).not.toMatch(/border-radius: *\d+px/);
  expect(body).not.toMatch(/letter-spacing: *-/);
}

/** A style rule as the CSSOM parses it: its selector, what it declares, and whether it sits in a `@media (forced-colors: active)` block. */
export type StyleRule = { selector: string; declares: Record<string, string>; forced: boolean };

/** A rule inside a `@media (forced-colors: active)` block. */
export type ForcedRule = Omit<StyleRule, "forced">;

/** Every style rule a CSS string holds, in source order, at any depth of `@media`. */
export function styleRules(css: string): StyleRule[] {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const found: StyleRule[] = [];
  const visit = (rules: CSSRuleList, forced: boolean) => {
    for (const rule of [...rules]) {
      if (rule instanceof CSSMediaRule) visit(rule.cssRules, forced || rule.media.mediaText.includes("forced-colors: active"));
      else if (rule instanceof CSSStyleRule) {
        const declares: Record<string, string> = {};
        for (let i = 0; i < rule.style.length; i++) {
          const property = rule.style[i] as string;
          declares[property] = rule.style.getPropertyValue(property);
        }
        found.push({ selector: rule.selectorText, declares, forced });
      }
    }
  };
  visit(style.sheet?.cssRules ?? ([] as unknown as CSSRuleList), false);
  style.remove();
  return found;
}

/**
 * The rules a CSS string keeps for forced colours. jsdom applies no media query, so a test
 * shows they still apply by matching each selector against the parts a pattern drew.
 */
export function forcedColorRules(css: string): ForcedRule[] {
  return styleRules(css)
    .filter((rule) => rule.forced)
    .map(({ selector, declares }) => ({ selector, declares }));
}

/** The selectors of a selector list, one by one. */
export const selectorsOf = (list: string) => list.split(",").map((selector) => selector.trim());

/** A selector without its user-action pseudo-classes, to match a part that isn't hovered or focused in a test. */
export const atRest = (selector: string) => selector.replace(/:(hover|focus-visible|focus)\b/g, "");
