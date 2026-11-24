// The toolbar's tokens: every value its stylesheet draws from, by role (ADR 0003).
// Colour and shadow come per theme, light and dark; the page's marks and the map's hues
// are named values the same in either; type, space, radius and motion are one scale each.
// styles.ts declares them on the host as custom properties (`hostDeclarations`), and the
// contrast and type tests read them here. DESIGN.md's front matter is written by hand and
// design-md.test.ts fails when it disagrees with this module.

export type Theme = "light" | "dark";

/** Colour by role, light. Each key is its custom property's name: `ink` is `--ink`. */
const LIGHT_COLOR = {
  well: "#F7F7F5",
  card: "#FFFFFF",
  sunk: "#F5F5F3",
  "sunk-hover": "#ECECE9",
  hover: "#F7F7F5",
  ink: "#0A0A0A",
  "on-ink": "#FFFFFF",
  muted: "#5E5E5E",
  faint: "#6E6E6E",
  "icon-faint": "#8A8A8A",
  "line-faint": "#A0A0A0",
  "tree-ink": "#4A4A4A",
  rule: "#EEEEEC",
  ground: "#F0F0EE",
  "rule-strong": "#CFCBC4",
  tree: "#D2CFC9",
  edge: "rgba(27, 34, 32, 0.07)",
  hairline: "rgba(27, 34, 32, 0.06)",
  divider: "rgba(27, 34, 32, 0.1)",
  band: "#1B2220",
  "on-band": "#F0F0F0",
  shown: "#FCD1BF",
  "on-shown": "#0A0A0A",
  "shown-edge": "#FFA8A2",
  accent: "#FE4437",
  "accent-text": "#B3261B",
  "accent-wash": "rgba(254, 68, 55, 0.1)",
  link: "#014886",
  "link-wash": "rgba(1, 72, 134, 0.06)",
  "link-edge": "rgba(1, 72, 134, 0.16)",
  "revision-line": "#8276CF",
  "revision-text": "#4F43B8",
  "ok-bg": "rgba(0, 180, 81, 0.2)",
  "ok-fg": "#01563F",
  "switch-off": "#938B7F",
  "switch-on": "#27917E",
  primary: "#1B2220",
  "on-primary": "#FFFFFF",
  held: "#8E959C",
  alert: "#C2570C",
  "warn-fg": "#7A4B00",
  "warn-bg": "#FFF3DC",
  "warn-dot": "#C98A12",
  select: "rgba(254, 68, 55, 0.2)",
  kbd: "rgba(10, 10, 10, 0.08)",
  "focus-glow": "rgba(254, 68, 55, 0.18)",
  "field-edge": "#8F8A83",
  "tools-wash": "#EFEFEC",
  "map-dot": "rgba(27, 34, 32, 0.16)",
  "on-check": "#FFFFFF",
  "copied-bg": "#DFF7E4",
  "copied-fg": "#14532D",
  "copied-edge": "rgba(20, 83, 45, 0.12)",
  "copied-rule": "rgba(20, 83, 45, 0.18)",
  "warn-edge": "rgba(201, 138, 18, 0.35)",
  "warn-rule": "rgba(122, 75, 0, 0.2)",
  "warn-wash": "rgba(122, 75, 0, 0.1)",
  "warn-muted": "#8A6A2A",
  "on-primary-rule": "rgba(255, 255, 255, 0.18)",
  "on-primary-wash": "rgba(255, 255, 255, 0.14)",
  toast: "#1B2220",
  "copied-badge": "#27917E",
  "on-toast": "#FFFFFF",
  "toast-muted": "#A3AAA7",
  "toast-edge": "rgba(255, 255, 255, 0.06)",
  "popover-edge": "rgba(27, 34, 32, 0.08)",
  "text-select": "rgba(1, 72, 134, 0.12)",
  "band-hover": "#2E3835",
} as const;

export type ColorRole = keyof typeof LIGHT_COLOR;

/** Every role in both themes: a role without a dark value doesn't compile. */
export const COLOR: Record<Theme, Record<ColorRole, string>> = {
  light: LIGHT_COLOR,
  dark: {
    well: "#1F2423",
    card: "#181C1B",
    sunk: "#242928",
    "sunk-hover": "#2E3432",
    hover: "#1F2423",
    ink: "#ECEDEA",
    "on-ink": "#0E1110",
    muted: "#A4AAA7",
    faint: "#8B918E",
    "icon-faint": "#7F8683",
    "line-faint": "#6E7572",
    "tree-ink": "#C4C9C6",
    rule: "#2C3230",
    ground: "#0E1110",
    "rule-strong": "#4A514E",
    tree: "#3E4543",
    edge: "rgba(255, 255, 255, 0.06)",
    hairline: "rgba(255, 255, 255, 0.07)",
    divider: "rgba(255, 255, 255, 0.12)",
    band: "#29322F",
    "on-band": "#F0F0F0",
    shown: "#5A2A20",
    "on-shown": "#FFE6DD",
    "shown-edge": "#8C3F31",
    accent: "#FF6A5C",
    "accent-text": "#FF9A8F",
    "accent-wash": "rgba(255, 106, 92, 0.14)",
    link: "#8DC2F5",
    "link-wash": "rgba(141, 194, 245, 0.08)",
    "link-edge": "rgba(141, 194, 245, 0.24)",
    "revision-line": "#A99FF2",
    "revision-text": "#BDB5FF",
    "ok-bg": "#143A25",
    "ok-fg": "#93E2AC",
    "switch-off": "#6A726F",
    "switch-on": "#2FA58F",
    primary: "#F6F3EF",
    "on-primary": "#1B2220",
    held: "#6B737C",
    alert: "#F0904A",
    "warn-fg": "#E5B567",
    "warn-bg": "#2A2109",
    "warn-dot": "#D9963B",
    select: "rgba(255, 106, 92, 0.3)",
    kbd: "rgba(255, 255, 255, 0.14)",
    "focus-glow": "rgba(255, 106, 92, 0.3)",
    "field-edge": "#646C69",
    "tools-wash": "#242928",
    "map-dot": "rgba(255, 255, 255, 0.14)",
    "on-check": "#0E1110",
    "copied-bg": "#143A25",
    "copied-fg": "#93E2AC",
    "copied-edge": "rgba(147, 226, 172, 0.16)",
    "copied-rule": "rgba(147, 226, 172, 0.24)",
    "warn-edge": "rgba(217, 150, 59, 0.4)",
    "warn-rule": "rgba(229, 181, 103, 0.24)",
    "warn-wash": "rgba(229, 181, 103, 0.12)",
    "warn-muted": "#C9A56A",
    "on-primary-rule": "rgba(27, 34, 32, 0.18)",
    "on-primary-wash": "rgba(27, 34, 32, 0.08)",
    toast: "#2E3432",
    "copied-badge": "#2FA58F",
    "on-toast": "#F6F3EF",
    "toast-muted": "#A3AAA7",
    "toast-edge": "rgba(255, 255, 255, 0.08)",
    "popover-edge": "rgba(255, 255, 255, 0.1)",
    "text-select": "rgba(141, 194, 245, 0.24)",
    "band-hover": "#35403C",
  },
};

/** Depth by theme: a surface's lift, and the collapsed pill's edge. Each key is its custom property's name. */
const LIGHT_SHADOW = {
  shadow: "0 0 0 1px rgba(27, 34, 32, 0.05), 0 1px 2px rgba(27, 34, 32, 0.06), 0 4px 12px rgba(27, 34, 32, 0.04)",
  "tile-shadow": "inset 0 0 0 1px rgba(27, 34, 32, 0.08), 0 1px 2px rgba(27, 34, 32, 0.05)",
  "site-shadow": "0 0 0 1px rgba(27, 34, 32, 0.06), 0 1px 2px rgba(27, 34, 32, 0.05)",
  "raised-shadow": "0 0 0 1px rgba(27, 34, 32, 0.06), 0 1px 2px rgba(27, 34, 32, 0.14)",
  "primary-shadow": "inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 1px 2px rgba(27, 34, 32, 0.25)",
  "popover-shadow": "0 0 0 1px rgba(27, 34, 32, 0.08), 0 16px 40px rgba(27, 34, 32, 0.18), 0 2px 6px rgba(27, 34, 32, 0.08)",
  "toast-shadow": "0 8px 24px rgba(27, 34, 32, 0.28)",
  "overlay-shadow": "0 12px 36px rgba(27, 34, 32, 0.22), 0 2px 6px rgba(27, 34, 32, 0.1)",
  /** The collapsed pill is flat, as the reference draws it: in light, no edge at all. */
  "launcher-edge": "none",
} as const;

export type ShadowRole = keyof typeof LIGHT_SHADOW;

export const SHADOW: Record<Theme, Record<ShadowRole, string>> = {
  light: LIGHT_SHADOW,
  dark: {
    shadow: "0 0 0 1px rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.25)",
    "tile-shadow": "inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.3)",
    "site-shadow": "0 0 0 1px rgba(255, 255, 255, 0.07), 0 1px 2px rgba(0, 0, 0, 0.3)",
    "raised-shadow": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.4)",
    "primary-shadow": "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.4)",
    "popover-shadow": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 40px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)",
    "toast-shadow": "0 8px 24px rgba(0, 0, 0, 0.5)",
    "overlay-shadow": "0 12px 36px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3)",
    /** In dark, a hairline keeps the flat pill apart from a dark page. A filter, so it follows the outline, fillets and all. */
    "launcher-edge": "drop-shadow(0 0 0.5px rgba(255, 255, 255, 0.35))",
  },
};

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
  /** Text on `ink` (the size tag) and on `band` (the pick tag), and the pick tag's detail. */
  onInk: "#FFFFFF",
  onBand: "#F0F0F0",
  onBandMuted: "rgba(240, 240, 240, 0.62)",
  /** The white keyline that lifts the selection's outline off any page. */
  halo: "rgba(255, 255, 255, 0.85)",
} as const;

/**
 * The page map's hues, one per component in the list's order (page-map.tsx): categories,
 * not roles, so they are named values like the page's marks, the same in either theme.
 */
export const MAP_HUES = ["#D2577A", "#3D7FD9", "#7A9A2E", "#A05ED1", "#8276CF", "#27917E", "#D08A16"] as const;

/** The two system stacks: a shadow root can't load a web font. */
export const FONT = {
  sans: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
  mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`,
} as const;

/**
 * A font size from the type scale, written in px at the browser's default 16px text.
 * `rem` would read the app's root size, so the unit is the host's own `medium` (the
 * reader's default) over 16: `--loupe-px` is registered as a <length>, so it resolves
 * once on the host and nested sizes never compound (typography review 2026-11-20).
 * Unregistered (an older browser, jsdom), it stays 1px and every size is as written.
 */
export const size = (px: number) => `calc(var(--loupe-px) * ${px})`;

/** One step of the type scale, in px at the browser's default 16px text. */
export interface TypeStyle {
  family: keyof typeof FONT;
  weight: number;
  /** Font size in px; written through `size()`, so it follows the reader's default. */
  size: number;
  /** Line height in px; written as its ratio to the size, so it scales with it. */
  lineHeight: number;
  /** Letter spacing, in em. */
  tracking?: string;
  /** Tabular figures: a counted or keyed number. */
  tabular?: boolean;
  /** Set in capitals. */
  uppercase?: boolean;
}

/** The type scale, per DESIGN.md "Typography": Figure … Annotation, then two single-use steps. */
export const TYPE = {
  /** The footer's change count. */
  figure: { family: "sans", weight: 600, size: 20, lineHeight: 24, tracking: "-0.02em", tabular: true },
  /** "What do you want to change?" at the list's start. Balanced. */
  hero: { family: "sans", weight: 600, size: 20, lineHeight: 26, tracking: "-0.02em" },
  /** The selected Instance's visible name, in full. Balanced. */
  headline: { family: "sans", weight: 600, size: 17, lineHeight: 22, tracking: "-0.015em" },
  /** Card titles, prop names, the scope's name. */
  title: { family: "sans", weight: 500, size: 14, lineHeight: 18, tracking: "-0.01em" },
  /** The base text. */
  body: { family: "sans", weight: 400, size: 13, lineHeight: 18 },
  /** Explanatory paragraphs: anything that wraps sits on at least a 1.4 line height. */
  paragraph: { family: "sans", weight: 400, size: 13, lineHeight: 19 },
  /** Buttons, Widen, the count toggle. */
  control: { family: "sans", weight: 500, size: 12, lineHeight: 16 },
  /** Copy Proposal and the primary button: Control stepped up to 13px and 600. */
  action: { family: "sans", weight: 600, size: 13, lineHeight: 17 },
  /** Option chips. */
  option: { family: "sans", weight: 400, size: 12, lineHeight: 16 },
  /** Under a control: a field's hint or error, a refused copy's reason. */
  caption: { family: "sans", weight: 400, size: 12, lineHeight: 17 },
  /** Field labels, the "Inside" label. */
  label: { family: "sans", weight: 500, size: 11, lineHeight: 14 },
  /** The counts beside card titles. */
  meta: { family: "sans", weight: 400, size: 11, lineHeight: 14, tabular: true },
  /** A tag's words: "State prop", "On the server", "Not visible now". */
  tag: { family: "sans", weight: 400, size: 11, lineHeight: 16 },
  /** The number inside a delta; the 9px step is the delta's alone. */
  delta: { family: "sans", weight: 700, size: 9, lineHeight: 9, tabular: true },
  /** Call sites, change lines, values: what an engineer would paste. */
  mono: { family: "mono", weight: 400, size: 12, lineHeight: 18 },
  monoSmall: { family: "mono", weight: 400, size: 11, lineHeight: 16 },
  /** A component's count on its row in "On this page": "×7". */
  count: { family: "mono", weight: 600, size: 13, lineHeight: 18, tabular: true },
  /** A key on the keyboard: Esc, Alt. */
  key: { family: "mono", weight: 500, size: 11, lineHeight: 14 },
  /** A tag that quotes why, in mono: "set by the library". */
  tagMono: { family: "mono", weight: 400, size: 10, lineHeight: 16, tracking: "0.02em" },
  /** The status chip, the held chip, the "picked" tag: 10px mono at 500, not recased. */
  chip: { family: "mono", weight: 500, size: 10, lineHeight: 14 },
  /** The page after the wordmark, the "app" tag on a chip. */
  annotation: { family: "mono", weight: 400, size: 10, lineHeight: 14, tracking: "0.04em", uppercase: true },
  /** A text field on a touch screen: 16px or more, so the browser doesn't zoom in on focus. */
  fieldTouch: { family: "sans", weight: 400, size: 16, lineHeight: 22 },
  /** The Proposal's text in a refused copy. */
  proposalText: { family: "mono", weight: 400, size: 10, lineHeight: 15 },
} as const satisfies Record<string, TypeStyle>;

export type TypeRole = keyof typeof TYPE;

/** A line height as the unitless ratio the stylesheet writes: 18px on 13px is 1.3846. */
export const leading = (style: TypeStyle) => Number((style.lineHeight / style.size).toFixed(4));

/** A type step as a `font` shorthand: `500 calc(var(--loupe-px) * 12)/1.3333 system-ui, …`. */
export const font = (style: TypeStyle) => `${style.weight} ${size(style.size)}/${leading(style)} ${FONT[style.family]}`;

/** Space steps in px, per DESIGN.md's `spacing`: 1, 2, 4, 6, 8, 10, 12, 14 and 16. */
export const SPACE = {
  hairline: 1,
  hair: 2,
  xs: 4,
  /** Between the sheet's cards, and from its edges. */
  sheet: 6,
  inset: 8,
  row: 10,
  /** A card's text from its top. */
  card: 12,
  /** A card's text from its left edge. */
  gutter: 14,
  hero: 16,
} as const;

/** Corner radii in px, per DESIGN.md's `rounded`. A pill is any height, fully round. */
export const RADIUS = {
  /** The 3px edge in its hue that marks an open row of "On this page", on its outer side. */
  edge: 2,
  swatch: 3,
  /** The size tag on the page, the map's blocks. */
  "page-tag": 4,
  /** A checkbox, a key. */
  checkbox: 5,
  /** Option chips. */
  chip: 8,
  /** The page's outline. */
  ring: 8,
  /** The copy popover's fields. */
  field: 10,
  /** Wells, text fields, notices, call-site cards, the page map. */
  well: 12,
  /** Start tiles. */
  tile: 14,
  /** The status strip, the toast. */
  status: 14,
  /** Cards, the header, the footer, the copy popover. */
  card: 18,
  /** The sheet's left corners. */
  sheet: 24,
  /** Every button, tag, status chip and tool. */
  pill: 999,
} as const;

/** Durations in ms, by what moves. */
export const DURATION = {
  /** A colour or surface change under the pointer, a press. */
  hover: 120,
  /** The page map's blocks. */
  map: 140,
  /** Reduced motion: a fade in place of a move. */
  fade: 150,
  /** A fold's chevron, a mark's entrance, a switch's colour, the pill's opacity. */
  fold: 160,
  /** The toast's entrance, the switch's thumb. */
  toast: 180,
  /** The drawer closing on Hide, quicker than it opens. */
  close: 220,
  /** The pill tucking into its side. */
  tuck: 240,
  /** The pill travelling to its place. */
  settle: 260,
  /** The drawer sliding out of the window's edge. */
  open: 300,
  /** The pill's liquid neck letting go of the window's edge. */
  release: 320,
  /** The page's marks fading once a change has shown what it reached. */
  quiet: 480,
} as const;

/** Easing curves, by how a thing moves. */
export const EASE = {
  out: "ease-out",
  in: "ease-in",
  /** The drawer: fast out of the edge, a long settle. */
  drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  /** Quick out and a soft landing: the pill travelling, tucking, the drawer closing. */
  land: "cubic-bezier(0.23, 1, 0.32, 1)",
  /** Slow at first, then fast: the neck thins, pinches, and its stubs pull back. */
  "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
  /** The switch's thumb. */
  thumb: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

const declare = (properties: Record<string, string>) =>
  Object.entries(properties)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(" ");

const prefixed = (prefix: string, scale: Record<string, number | string>, unit = "") =>
  Object.fromEntries(Object.entries(scale).map(([name, value]) => [`${prefix}-${name}`, `${value}${unit}`]));

/** `monoSmall` → `mono-small`: a role's name as a custom property writes it. */
const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * Each type step as a `font` shorthand, `--font-<role>`, for the primitives' real CSS
 * files (ADR 0003), which can't call `font()`. Case and figures stay with the rule; a
 * tracked step's tracking is `--tracking-<role>`, so the value lives in the token alone.
 */
export const TYPE_PROPERTIES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TYPE).map(([role, style]) => [`font-${kebab(role)}`, font(style)])),
  ...Object.fromEntries(
    Object.entries(TYPE as Record<string, TypeStyle>)
      .filter(([, style]) => style.tracking !== undefined)
      .map(([role, style]) => [`tracking-${kebab(role)}`, style.tracking as string]),
  ),
};

/**
 * The host's custom properties for one theme: its colours and shadows. The light block
 * also carries what doesn't change with the theme (`--space-*`, `--radius-*`,
 * `--duration-*`, `--ease-*`, `--font-*`, `--tracking-*`, and the map's `--map-hue-*`):
 * the dark block only overrides the themed ones.
 */
export function hostDeclarations(theme: Theme): string {
  const themed = declare({ ...COLOR[theme], ...SHADOW[theme] });
  if (theme === "dark") return themed;
  const scales = declare({
    ...prefixed("space", SPACE, "px"),
    ...prefixed("radius", RADIUS, "px"),
    ...prefixed("duration", DURATION, "ms"),
    ...prefixed("ease", EASE),
    ...TYPE_PROPERTIES,
    ...prefixed("map-hue", Object.fromEntries(MAP_HUES.entries())),
  });
  return `${themed} ${scales}`;
}
