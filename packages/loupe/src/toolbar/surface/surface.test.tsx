// @vitest-environment jsdom
// The Toolbar's surface (surface/): the design system's stylesheet with the patterns' layer
// on top (ADR 0010), `@loupe/patterns/stylesheet`'s (ADR 0012), the one every surface of the Toolbar adopts.

import { PRIMITIVES_CSS } from "@loupe/ui";
import { ground, stylesheet } from "@loupe/ui/surface";
import { afterEach, describe, expect, it } from "vitest";
import { PATTERNS_CSS } from "@loupe/patterns";
import { PATTERN_PROPERTIES } from "@loupe/patterns/tokens";
import { STYLESHEET } from "./index.js";
import { cleanup, renderInSurface } from "./render.fixture.js";

afterEach(cleanup);

describe("the Toolbar's stylesheet", () => {
  it("is the system's, with the patterns as its top layer and the Toolbar's own tokens on the host", () => {
    expect(STYLESHEET).toBe(stylesheet(PATTERNS_CSS, PATTERN_PROPERTIES));
    expect(STYLESHEET.split("\n")[0]).toBe("@layer tokens, primitives, patterns;");
  });

  it("puts the ground, then the primitives, then the patterns, which end the sheet", () => {
    const tokens = STYLESHEET.indexOf(`@layer tokens {${ground(PATTERN_PROPERTIES)}}`);
    const primitives = STYLESHEET.indexOf(`@layer primitives {\n${PRIMITIVES_CSS}\n}`);
    const patterns = STYLESHEET.indexOf(`@layer patterns {\n${PATTERNS_CSS}\n}`);
    expect(tokens).toBeGreaterThan(0);
    expect(primitives).toBeGreaterThan(tokens);
    expect(patterns).toBeGreaterThan(primitives);
    expect(PATTERNS_CSS.length).toBeGreaterThan(0);
    // Every rule is in a layer: no view writes one of its own, so the patterns' layer ends the sheet.
    expect(STYLESHEET.endsWith(`@layer patterns {\n${PATTERNS_CSS}\n}`)).toBe(true);
  });

  it("is what a pattern's test draws under", () => {
    const screen = renderInSurface(<p>Hello</p>);
    expect(screen.host.getAttribute("lang")).toBe("en");
    expect(screen.shadow.querySelector("style")?.textContent).toBe(STYLESHEET);
  });
});
