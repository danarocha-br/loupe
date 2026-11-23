import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR, type ColorRole, FONT, MAP_HUES, PAGE, RADIUS, SPACE, TYPE, type TypeRole } from "./tokens.js";

// DESIGN.md stays written by hand; this only checks that its front matter says what the module does.

type Value = string | number;
type FrontMatter = { [key: string]: Value | FrontMatter };

/** The front matter's nested maps of scalars: enough YAML for DESIGN.md, which has no lists. */
function frontMatter(markdown: string): FrontMatter {
  const [, yaml = ""] = markdown.split(/^---$/m);
  const root: FrontMatter = {};
  const stack: { indent: number; map: FrontMatter }[] = [{ indent: -1, map: root }];
  for (const line of yaml.split("\n")) {
    const match = /^( *)([^:\s][^:]*):(?: (.*))?$/.exec(line);
    if (!match) continue;
    const [, spaces = "", key = "", raw] = match;
    while ((stack.at(-1)?.indent ?? -1) >= spaces.length) stack.pop();
    const parent = (stack.at(-1) as { map: FrontMatter }).map;
    if (raw === undefined || raw === "") {
      const map: FrontMatter = {};
      parent[key] = map;
      stack.push({ indent: spaces.length, map });
    } else {
      parent[key] = raw.startsWith('"') ? (JSON.parse(raw) as string) : Number.isNaN(Number(raw)) ? raw : Number(raw);
    }
  }
  return root;
}

const design = frontMatter(readFileSync(new URL("../../DESIGN.md", import.meta.url), "utf8"));
const section = (name: string) => design[name] as Record<string, Value>;
const camel = (kebab: string) => kebab.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The module's value for a DESIGN.md colour name: `ink`, `ink-dark`, `page-on-band-muted` (PAGE.onBandMuted), `map-hue-3`. */
function moduleColor(name: string): string | undefined {
  const hue = /^map-hue-(\d+)$/.exec(name);
  if (hue) return MAP_HUES[Number(hue[1])];
  if (name.startsWith("page-")) return (PAGE as Record<string, string>)[camel(name.slice("page-".length))];
  if (name.endsWith("-dark")) return COLOR.dark[name.slice(0, -"-dark".length) as ColorRole];
  return COLOR.light[name as ColorRole];
}

describe("DESIGN.md's front matter agrees with the tokens module", () => {
  it("gives every colour the module's value", () => {
    const colors = section("colors");
    const disagreeing = Object.entries(colors).filter(([name, value]) => moduleColor(name) !== value);
    expect(disagreeing.map(([name, value]) => `${name}: ${value} (module: ${moduleColor(name) ?? "none"})`)).toEqual([]);
  });

  it("lists every light role, every page mark and every map hue", () => {
    // Dark values are listed where a reader needs them; the module holds them all.
    const names = Object.keys(section("colors"));
    const expected = [
      ...Object.keys(COLOR.light),
      ...Object.keys(PAGE).map((key) => `page-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`),
      ...MAP_HUES.map((_, index) => `map-hue-${index}`),
    ];
    expect(expected.filter((name) => !names.includes(name))).toEqual([]);
  });

  it.each([
    ["rounded", RADIUS],
    ["spacing", SPACE],
  ] as const)("writes the same %s scale", (name, scale) => {
    const written = Object.fromEntries(Object.entries(scale).map(([key, px]) => [key, `${px}px`]));
    expect(section(name)).toEqual(written);
  });

  it("writes the same type scale", () => {
    const written = Object.fromEntries(
      (Object.entries(TYPE) as [TypeRole, (typeof TYPE)[TypeRole]][]).map(([role, style]) => [
        role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        {
          fontFamily: FONT[style.family],
          fontSize: `${style.size}px`,
          fontWeight: style.weight,
          // A step whose line is its size is written unitless.
          lineHeight: style.lineHeight === style.size ? 1 : `${style.lineHeight}px`,
          ...("tracking" in style ? { letterSpacing: style.tracking } : {}),
          ...("tabular" in style && style.tabular ? { fontFeature: '"tnum"' } : {}),
        },
      ]),
    );
    expect(section("typography")).toEqual(written);
  });
});
