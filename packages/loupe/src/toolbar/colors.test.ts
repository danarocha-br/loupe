import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSS } from "./styles.js";

/** The tokens one theme block declares, read back from the stylesheet the host gets. */
function tokens(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  const block = CSS.slice(start, CSS.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([a-z-]+): ([^;]+);/g)].map((match) => [match[1], (match[2] ?? "").trim()]));
}
const LIGHT = tokens(":host");
const DARK = tokens(':host([data-loupe-theme="dark"])');

/** WCAG 2 contrast of two opaque hex colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

describe("the toolbar's colours (colour review 2026-11-20)", () => {
  it.each([
    ["light", LIGHT],
    ["dark", DARK],
  ])("keeps faint text at 4.5:1 on every surface it sits on, %s", (_, theme) => {
    for (const surface of ["card", "hover", "well", "sunk"]) {
      expect(contrast(theme.faint as string, theme[surface] as string), surface).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["light", LIGHT],
    ["dark", DARK],
  ])("draws what is found by its outline at 3:1, %s", (_, theme) => {
    expect(contrast(theme["field-edge"] as string, theme.card as string)).toBeGreaterThanOrEqual(3);
    // A switch is its edge and its filled half, with the card showing through the hole: both states at 3:1 on the card.
    expect(contrast(theme["switch-off"] as string, theme.card as string)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme["switch-on"] as string, theme.card as string)).toBeGreaterThanOrEqual(3);
  });

  it("names its tokens by role, never by hue, and gives every one a dark value", () => {
    for (const name of Object.keys(LIGHT)) expect(name).not.toMatch(/lilac|amber|pencil|violet|purple|teal|green|orange/);
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).filter((name) => name !== "loupe-px").sort());
  });

  it("writes no colour literal in a rule: tokens for the panel, named page values for the marks", () => {
    // Read the source, where the page's values still show as `${PAGE.…}`: the built string can't tell them apart.
    const source = readFileSync(new URL("./styles.ts", import.meta.url), "utf8");
    const rules = source.slice(source.indexOf("export const CSS = `")).split("\n");
    // Shadows are surfaces' depth, not colour roles.
    const literal = /#[0-9A-Fa-f]{6}\b|rgba?\(/;
    const offenders = rules.filter((line) => literal.test(line) && !/shadow:/.test(line));
    expect(offenders).toEqual([]);
  });
});
