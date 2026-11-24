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
