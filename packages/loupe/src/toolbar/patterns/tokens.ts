// The Toolbar's own tokens (ADR 0011): named values the patterns draw from that are Loupe's,
// not the design system's. The page's marks sit on the app, in its light, and the page map's
// hues are categories, so neither follows the panel's theme. The system's tokens are
// `@loupe/ui/tokens`; these are declared on the same host, in the same `tokens` layer, after
// the system's (`stylesheet(PATTERNS_CSS, PATTERN_PROPERTIES)`, surface/). Loupe's DESIGN.md
// front matter names them too, and design-md.test.ts holds it to this module.

/** The page's marks don't follow the panel's theme: they sit on the app, in its light. */
export const PAGE = {
  /** The Instances a selection reaches besides the one picked: dashed. */
  line: "#FE9992",
  /** The one picked, solid, and its size tag. */
  ink: "#FE4437",
  fill: "rgba(254, 68, 55, 0.12)",
  band: "#1B2220",
  /** Not applied: a left-out or hovered Instance's grey dashes. */
  hover: "#6F7472",
  /**
   * The size tag's figures on `ink`: the band's near-black, 4.7:1. White was 3.4:1 (PER-245).
   */
  onInk: "#1B2220",
  /** The pick tag's name on `band`, and its detail. */
  onBand: "#F0F0F0",
  onBandMuted: "rgba(240, 240, 240, 0.62)",
  /** The white keyline that lifts the selection's outline off any page. */
  halo: "rgba(255, 255, 255, 0.85)",
} as const;

/** The page's tags' lift, fixed like the marks' colours: the size tag's, and the pick tag's, a touch deeper. */
export const PAGE_SHADOW = {
  tag: "0 1px 2px rgba(27, 34, 32, 0.2)",
  pick: "0 1px 2px rgba(27, 34, 32, 0.24)",
} as const;

/**
 * The page map's hues, one per component in the list's order (page-map.tsx): categories,
 * not roles, so they are named values like the page's marks, the same in either theme.
 */
export const MAP_HUES = ["#D2577A", "#3D7FD9", "#7A9A2E", "#A05ED1", "#8276CF", "#27917E", "#D08A16"] as const;

/** `onBandMuted` → `on-band-muted`: a key as its custom property writes it. */
const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * The custom properties these declare on the host, by name without the `--`, in the order the
 * stylesheet writes them: `--map-hue-0` … `--map-hue-6`, `--page-*`, then `--page-*-shadow`.
 */
export const PATTERN_PROPERTIES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(MAP_HUES.map((hue, index) => [`map-hue-${index}`, hue])),
  ...Object.fromEntries(Object.entries(PAGE).map(([name, value]) => [`page-${kebab(name)}`, value])),
  ...Object.fromEntries(Object.entries(PAGE_SHADOW).map(([name, value]) => [`page-${name}-shadow`, value])),
};
