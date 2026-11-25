import { describe, expect, it } from "vitest";
import { STYLESHEET } from "./surface/index.js";
import { COLOR, SHADOW } from "@loupe/ui/tokens";
import { PAGE } from "./patterns/tokens.js";

const LIGHT = COLOR.light;
const DARK = COLOR.dark;

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
    for (const surface of ["card", "hover", "well", "sunk"] as const) {
      expect(contrast(theme.faint, theme[surface]), surface).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["light", LIGHT],
    ["dark", DARK],
  ])("draws what is found by its outline at 3:1, %s", (_, theme) => {
    expect(contrast(theme["field-edge"], theme.card)).toBeGreaterThanOrEqual(3);
    // A switch is its edge and its filled half, with the card showing through the hole: both states at 3:1 on the card.
    expect(contrast(theme["switch-off"], theme.card)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme["switch-on"], theme.card)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the page's tags' text at 4.5:1 on their fill, whatever the app's page is (PER-245)", () => {
    // The size tag: its figures on the selection's coral.
    expect(contrast(PAGE.onInk, PAGE.ink)).toBeGreaterThanOrEqual(4.5);
    // The pick tag: its name on the band.
    expect(contrast(PAGE.onBand, PAGE.band)).toBeGreaterThanOrEqual(4.5);
  });

  it("names its tokens by role, never by hue, and gives every one a dark value", () => {
    for (const name of [...Object.keys(LIGHT), ...Object.keys(SHADOW.light)]) {
      expect(name).not.toMatch(/lilac|amber|pencil|violet|purple|teal|green|orange/);
    }
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
    expect(Object.keys(SHADOW.dark).sort()).toEqual(Object.keys(SHADOW.light).sort());
  });

  it("writes no colour literal in a rule: the panel's and the page's marks' colours are all tokens on the host", () => {
    // Every rule is a primitive's or a pattern's now (each one's CSS test refuses a literal); the only literals left are the tokens' declarations on the host.
    const rules = STYLESHEET.replace(/\/\*[\s\S]*?\*\//g, "").replace(/:host(\([^)]*\))? \{[^}]*\}/g, "");
    expect(rules.match(/#[0-9A-Fa-f]{6}\b|rgba?\(/g)).toBeNull();
    // The page's marks keep their fixed values, declared once for both panel themes.
    for (const [name, value] of Object.entries(PAGE)) expect(STYLESHEET).toContain(`--page-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`);
  });
});
