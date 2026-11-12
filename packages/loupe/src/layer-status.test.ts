import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPT_LIST_FORMAT_VERSION } from "./adapt-list.js";
import { stampJson } from "./generate/header.js";
import { formatOf, generateCommand, readLayerStatus } from "./layer-status.js";
import { hashFile } from "./meta/sources.js";
import { stableJson } from "./meta/write.js";

/** A repo with one design-system module and the Product layer `generate` would write for it. */
function repo(layer = "packages/loupe") {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-layer-")));
  const write = (relative: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), text);
  };
  write("ds/components/ui/button.tsx", `export function Button() { return null; }\n`);
  write("ds/components/ui/variants.ts", `export const variants = { size: ["sm"] };\n`);
  write("ds/components/ui/badge.tsx", `export function Badge() { return null; }\n`);
  const meta = (source: string, files: string[], components: string[]) =>
    stampJson(
      stableJson({
        client: false,
        engine: "ts-morph",
        exports: Object.fromEntries([
          ...components.map((name) => [name, { kind: "component", props: {}, shape: "function" }]),
          ["helper", { kind: "other" }],
        ]),
        files: Object.fromEntries(files.map((file) => [file, hashFile(path.join(root, file))])),
        formatVersion: 1,
        source,
      }),
    );
  write(
    `${layer}/meta/ds/ui/button.tsx.json`,
    meta("ds/components/ui/button.tsx", ["ds/components/ui/button.tsx", "ds/components/ui/variants.ts"], ["ButtonGroup", "Button"]),
  );
  write(`${layer}/meta/ds/ui/badge.tsx.json`, meta("ds/components/ui/badge.tsx", ["ds/components/ui/badge.tsx"], ["Badge"]));
  write(
    `${layer}/adapt-list.json`,
    stampJson(stableJson({ app: ["apps/app"], designSystem: ["ds"], formatVersion: 1, modules: {} })),
  );
  const paths = { root, adaptList: path.join(root, layer, "adapt-list.json"), app: path.join(root, "apps/app") };
  return { root, write, paths };
}

/** Moves a file's mtime, so a rewrite in the same millisecond still reads as a change. */
function touch(file: string) {
  const later = new Date(Date.now() + 5000);
  utimesSync(file, later, later);
}

describe("readLayerStatus", () => {
  it("reports nothing while every source matches its hash", () => {
    const { paths } = repo();
    expect(readLayerStatus(paths)).toEqual({
      command: "pnpm -C apps/app exec loupe generate",
      format: null,
      stale: [],
      notGenerated: [],
    });
  });

  it("names what the next generate would add, and only from files it reads", () => {
    const { root, write, paths } = repo();
    write("ds/components/ui/card.tsx", `"use client";\nexport function Card() { return null; }\nexport const CardTitle = () => null;\nexport const CARD_MAX = 3;\nexport const cardVariants = {};\nfunction Local() { return null; }\nexport { Local as CardBody };\nexport type CardProps = { a: 1 };\nexport default function Ignored() { return null; }\nexport type { Local as CardType };\n`);
    write("ds/components/ui/index.ts", `export { Button } from "./button";\n`);
    write("ds/components/ui/card.test.tsx", `export function CardTest() { return null; }\n`);
    write("ds/providers/theme.tsx", `export function ThemeProvider() { return null; }\n`);
    write("apps/app/components/members-summary.tsx", `export function MembersSummary() { return null; }\n`);
    write("packages/loupe/adapters/ds/ui/card.tsx", `export function CardAdapter() { return null; }\n`);
    // A component added to a module generate already read.
    write("ds/components/ui/badge.tsx", `export function Badge() { return null; }\nexport function BadgeDot() { return null; }\n`);
    touch(path.join(root, "ds/components/ui/badge.tsx"));
    expect(readLayerStatus(paths).notGenerated).toEqual(["BadgeDot", "Card", "CardBody", "CardTitle", "MembersSummary"]);
  });

  it("never reads the Product layer when it sits inside the app", () => {
    const { write, paths } = repo("apps/app/loupe");
    write("apps/app/loupe/adapters/ds/ui/badge.tsx", `export function Badge() { return null; }\nexport function BadgeAdapter() { return null; }\n`);
    write("apps/app/page.tsx", `export function Shell() { return null; }\n`);
    expect(readLayerStatus(paths).notGenerated).toEqual(["Shell"]);
  });

  it("clears a name once generate has written its metadata", () => {
    const { root, write, paths } = repo();
    write("ds/components/ui/card.tsx", `export function Card() { return null; }\n`);
    expect(readLayerStatus(paths).notGenerated).toEqual(["Card"]);
    // As the next `generate` writes it.
    write(
      "packages/loupe/meta/ds/ui/card.tsx.json",
      stampJson(
        stableJson({
          client: false,
          engine: "ts-morph",
          exports: { Card: { kind: "component", props: {}, shape: "function" } },
          files: { "ds/components/ui/card.tsx": hashFile(path.join(root, "ds/components/ui/card.tsx")) },
          formatVersion: 1,
          source: "ds/components/ui/card.tsx",
        }),
      ),
    );
    expect(readLayerStatus(paths).notGenerated).toEqual([]);
  });

  it("reads a file that doesn't parse as exporting nothing", () => {
    const { write, paths } = repo();
    write("ds/components/ui/broken.tsx", `export function Broken( {\n`);
    expect(readLayerStatus(paths).notGenerated).toEqual([]);
  });

  it("flags every component of a module whose source changed, and names the file", () => {
    const { root, write, paths } = repo();
    readLayerStatus(paths);
    write("ds/components/ui/variants.ts", `export const variants = { size: ["sm", "lg"] };\n`);
    touch(path.join(root, "ds/components/ui/variants.ts"));
    expect(readLayerStatus(paths).stale).toEqual([
      { source: "ds/components/ui/button.tsx", components: ["Button", "ButtonGroup"], changed: ["ds/components/ui/variants.ts"] },
    ]);
  });

  it("flags a module whose source is gone, and clears once the hash matches again", () => {
    const { root, write, paths } = repo();
    const original = `export function Badge() { return null; }\n`;
    rmSync(path.join(root, "ds/components/ui/badge.tsx"));
    expect(readLayerStatus(paths).stale.map((module) => module.components)).toEqual([["Badge"]]);
    write("ds/components/ui/badge.tsx", original);
    touch(path.join(root, "ds/components/ui/badge.tsx"));
    expect(readLayerStatus(paths).stale).toEqual([]);
  });

  it("writes nothing into the Product layer", () => {
    const { root, write, paths } = repo();
    write("ds/components/ui/button.tsx", `export function Button() { return 1; }\n`);
    const before = JSON.stringify(snapshotDir(path.join(root, "packages/loupe")));
    readLayerStatus(paths);
    expect(JSON.stringify(snapshotDir(path.join(root, "packages/loupe")))).toBe(before);
  });

  it("reports another format instead of staleness, since its meta/ can't be trusted", () => {
    const { root, write, paths } = repo();
    write("ds/components/ui/button.tsx", `export function Button() { return 1; }\n`);
    // As an older generate would stamp it: a valid header for formatVersion 0.
    const body = stableJson({ app: ["apps/app"], designSystem: ["ds"], formatVersion: 1, modules: {} });
    write("packages/loupe/adapt-list.json", restamp(stampJson(body), 0));
    touch(path.join(root, "packages/loupe/adapt-list.json"));
    expect(readLayerStatus(paths)).toEqual({
      command: "pnpm -C apps/app exec loupe generate",
      format: { layer: 0, runtime: 1, newer: false },
      stale: [],
      notGenerated: null,
    });
  });
});

describe("formatOf", () => {
  const body = (formatVersion: number) =>
    stableJson({ app: ["apps/app"], designSystem: ["ds"], formatVersion, modules: {} });

  it("is null for this Loupe's own output", () => {
    expect(formatOf(stampJson(body(1)))).toBeNull();
  });

  it("reads a newer header as newer", () => {
    expect(formatOf(restamp(stampJson(body(1)), 2))).toEqual({ layer: 2, runtime: 1, newer: true });
  });

  it("reads the loader's own field when the header agrees, against the loader's version", () => {
    expect(formatOf(stampJson(body(2)))).toEqual({ layer: 2, runtime: ADAPT_LIST_FORMAT_VERSION, newer: true });
    expect(formatOf(stampJson(body(0)))).toEqual({ layer: 0, runtime: ADAPT_LIST_FORMAT_VERSION, newer: false });
  });

  it("leaves a hand-edited file to loupe doctor", () => {
    expect(formatOf(stampJson(body(1)).replace('"ds"', '"other"'))).toBeNull();
  });
});

describe("generateCommand", () => {
  it("adds --out, relative to the app, for a layer outside packages/loupe", () => {
    const root = "/repo";
    expect(generateCommand({ root, adaptList: "/repo/fixture/app/loupe/adapt-list.json", app: "/repo/fixture/app" })).toBe(
      "pnpm -C fixture/app exec loupe generate --out loupe",
    );
  });

  it("drops -C when the app is the repo root", () => {
    expect(generateCommand({ root: "/repo", adaptList: "/repo/packages/loupe/adapt-list.json", app: "/repo" })).toBe(
      "pnpm exec loupe generate",
    );
  });
});

/** Re-stamps a generated JSON file as another formatVersion would have, with a matching hash. */
function restamp(text: string, version: number): string {
  const lines = text.split("\n");
  const body = [lines[0], ...lines.slice(2)].join("\n");
  const hash = createHash("sha256").update(`${version}\n${body}`, "utf8").digest("hex");
  lines[1] = `  "$generated": "@generated by loupe generate, do not edit (formatVersion ${version}, sha256:${hash})",`;
  return lines.join("\n");
}

function snapshotDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const full = path.join(entry.parentPath, entry.name);
      out[path.relative(dir, full)] = readFileSync(full, "utf8");
    }
  }
  return out;
}
