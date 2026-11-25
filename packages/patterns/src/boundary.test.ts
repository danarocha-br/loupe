// The package boundary (ADR 0012): the patterns import nothing from Loupe and nothing of UI SDK.
// A shipped module imports only this package, React and `@loupe/ui`'s shipped entries; a
// pattern, only `@loupe/ui` and `@loupe/ui/tokens` (the primitives and the tokens), other
// patterns, the Toolbar's tokens (`tokens.ts`) and the contract (`view.ts`). A test or a fixture
// also its test tools and `@loupe/ui`'s test hosts. Loupe's side of the rule (it reaches the
// package through its entries alone, and `panelView()`, the adapter, takes from it only its
// tokens and its contract) is Loupe's `src/toolbar/layers.test.ts`.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(src, "..");
const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
/** `@loupe/ui`'s manifest, found by its name, as the package itself finds it. */
const system = JSON.parse(readFileSync(createRequire(import.meta.url).resolve("@loupe/ui/package.json"), "utf8"));

/** `@loupe/ui`'s entries, by specifier: `@loupe/ui/tokens` → `./src/tokens.ts`. */
const uiEntries: Record<string, string> = Object.fromEntries(
  Object.entries(system.exports as Record<string, string>)
    .filter(([entry]) => entry !== "./package.json")
    .map(([entry, target]) => [entry === "." ? "@loupe/ui" : `@loupe/ui/${entry.slice(2)}`, target]),
);
/** One that ships: its target is in `src`, and isn't a `.fixture` (a test host), which no build ships. */
const isShippedUiEntry = (specifier: string) => {
  const target = uiEntries[specifier];
  return target !== undefined && target.startsWith("./src/") && !/\.fixture\.tsx?$/.test(target);
};
/** One only tests may import: a `.fixture` (`@loupe/ui/testing`, `/listen`, `/jsdom-gaps`). */
const isTestUiEntry = (specifier: string) => /\.fixture\.tsx?$/.test(uiEntries[specifier] ?? "");

/** Every module under `dir` but this file, whose examples break the rule on purpose. */
const sources = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(c|m)?tsx?$/.test(file))
    .map((file) => path.join(dir, file))
    .filter((file) => file !== fileURLToPath(import.meta.url));

/**
 * Every module specifier `code` imports or re-exports, statically or dynamically, however
 * tightly it is written. A comment that reads like one counts: a false alarm is safer.
 */
function specifiers(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(/\b(?:import|export)\b(?:\s*type\b)?(?:[^;"'`()]*?\bfrom)?\s*["']([^"']+)["']/g)) found.push(match[1] as string);
  for (const match of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) found.push(match[1] as string);
  return found;
}

const isTest = (file: string) => /\.(test|fixture)\.tsx?$/.test(file);
const inside = (dir: string, target: string) => target === dir || target.startsWith(dir + path.sep);
const resolved = (file: string, specifier: string) => path.resolve(path.dirname(file), specifier.replace(/\?.*$/, ""));
const REACT = /^(react|react-dom)(\/|$)/;
const TEST_TOOLS = /^(vitest|@testing-library\/(dom|user-event)|axe-core|node:[\w/]+)$/;
/** The sample data: the tests' and the workbench's, never a shipped module's. */
const samples = [path.join(src, "samples.ts"), path.join(src, "samples.js")];

/**
 * What a module of `src` imports that it may not: a path out of `src` (out of the package,
 * for a test, which may read the package's own build config), the samples or a fixture from a
 * shipped module, or a package it has no business with.
 */
function offenders(file: string, code: string): string[] {
  const test = isTest(file);
  return specifiers(code)
    .filter((specifier) => {
      if (specifier.startsWith(".")) {
        const target = resolved(file, specifier);
        if (!inside(test ? pkg : src, target)) return true;
        return !test && (samples.includes(target) || /\.(test|fixture)\.(t|j)sx?$/.test(target));
      }
      return !(REACT.test(specifier) || isShippedUiEntry(specifier) || (test && (TEST_TOOLS.test(specifier) || isTestUiEntry(specifier))));
    })
    .map((specifier) => `${path.relative(src, file)} → ${specifier}`);
}

/** What a pattern may take from `@loupe/ui`: the primitives and the tokens, not the surface or the announcer's module, which are the views'. */
const PATTERN_ENTRIES = ["@loupe/ui", "@loupe/ui/tokens"];

/** Whether a file is a pattern's: inside one of the patterns' folders. */
const isPatternFile = (file: string) => path.relative(src, file).includes(path.sep);

/**
 * What a pattern's file imports that a pattern may not: anything outside `@loupe/ui`'s
 * primitives and tokens, the patterns (their tokens and their contract among them), React
 * and its own CSS. The samples and the fixtures are the tests'; `stylesheet.ts` is the surface's.
 */
function patternOffenders(file: string, code: string): string[] {
  return specifiers(code)
    .filter((specifier) => {
      if (!specifier.startsWith(".")) return !(REACT.test(specifier) || PATTERN_ENTRIES.includes(specifier));
      const target = resolved(file, specifier);
      // Another pattern's folder, or the contract or the Toolbar's tokens beside them.
      const shared = ["tokens", "view"].some((name) => [`${name}.ts`, `${name}.js`].map((f) => path.join(src, f)).includes(target));
      return !(shared || (inside(src, target) && isPatternFile(target))) || /\.(test|fixture)\.(t|j)sx?$/.test(target);
    })
    .map((specifier) => `${path.relative(src, file)} → ${specifier}`);
}

describe("the package boundary", () => {
  it("keeps a shipped module to this package, React and @loupe/ui's shipped entries", () => {
    expect(sources(src).filter((file) => !isTest(file)).flatMap((file) => offenders(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("keeps the tests to this package, React, @loupe/ui's entries and their tools", () => {
    expect(sources(src).filter(isTest).flatMap((file) => offenders(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("keeps a pattern to @loupe/ui, other patterns, the Toolbar's tokens and the patterns' contract", () => {
    const offending = sources(src)
      .filter((file) => isPatternFile(file) && !isTest(file))
      .flatMap((file) => patternOffenders(file, readFileSync(file, "utf8")));
    expect(offending).toEqual([]);
  });

  it("would catch a module that reaches into Loupe, UI SDK or the samples", () => {
    const file = path.join(src, "stylesheet.ts");
    const code = [
      'import { useState } from "react";',
      'import { Button } from "@loupe/ui";',
      'import { stylesheet } from "@loupe/ui/surface";',
      'import { PATTERNS_CSS } from "./styles.js";',
      'import { panelView } from "../../loupe/src/toolbar/panel-view/index.js";',
      'import type { PropItem } from "@danarocha/loupe/runtime";',
      'import { Chip } from "../../ui/src/chip-group/chip-group.js";',
      'import{Popover}from"@ui-sdk/react";',
      'import { WORDS } from "./samples.js";',
      'import { renderInSurface } from "@loupe/ui/testing";',
      'import { Workbench } from "@loupe/ui/workbench";',
      'import { Card } from "@loupe/ui/card";',
      'import { describe } from "vitest";',
      'const lazy = () => import("@danarocha/loupe/workbench");',
    ].join("\n");
    expect(offenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../../loupe/src/toolbar/panel-view/index.js",
      "@danarocha/loupe/runtime",
      "../../ui/src/chip-group/chip-group.js",
      "@ui-sdk/react",
      "./samples.js",
      // A test host, the workbench's shell and an entry @loupe/ui doesn't have.
      "@loupe/ui/testing",
      "@loupe/ui/workbench",
      "@loupe/ui/card",
      // A test tool, in a shipped file.
      "vitest",
      // Dynamic imports are read after the statements.
      "@danarocha/loupe/workbench",
    ]);
  });

  it("would catch a pattern that reaches past the primitives, the patterns, their tokens and their contract", () => {
    const file = path.join(src, "example", "example.tsx");
    const code = [
      'import type { PropItem } from "../view.js";',
      'import { PAGE } from "../tokens.js";',
      'import { Keys } from "../marks/marks.js";',
      'import { Button } from "@loupe/ui";',
      'import { SPACE } from "@loupe/ui/tokens";',
      'import CSS from "./example.css?inline";',
      'import { useState } from "react";',
      'import { HELD } from "../samples.js";',
      'import { expectPatternCss } from "../css.fixture.js";',
      'import { STYLESHEET } from "../stylesheet.js";',
      'import { PATTERNS_CSS } from "../styles.js";',
      'import type { Write } from "../../../loupe/src/toolbar/panel-view/types.js";',
      'import { Field } from "@ui-sdk/react";',
      'import { attachSurface } from "@loupe/ui/surface";',
      'import { Announcer } from "@loupe/ui/announcer";',
      'import { renderInSurface } from "@loupe/ui/testing";',
      'const lazy = () => import("../index.js");',
    ].join("\n");
    expect(patternOffenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../samples.js",
      "../css.fixture.js",
      // The surface's and the stylesheet's: not a pattern's to draw from.
      "../stylesheet.js",
      "../styles.js",
      "../../../loupe/src/toolbar/panel-view/types.js",
      "@ui-sdk/react",
      "@loupe/ui/surface",
      "@loupe/ui/announcer",
      "@loupe/ui/testing",
      // Dynamic imports are read after the statements; the package's own entry is not a pattern.
      "../index.js",
    ]);
  });

  it("names no Loupe package anywhere in its source, nor UI SDK", () => {
    const named = sources(src).filter((file) => /@danarocha\/loupe\b|@ui-sdk\//.test(readFileSync(file, "utf8")));
    expect(named.map((file) => path.relative(src, file))).toEqual([]);
  });

  it("keeps the workbench to this package, @loupe/ui's entries, React and its dev server", () => {
    // The workbench (ADR 0012) draws `src` from beside it, in @loupe/ui's shell (`@loupe/ui/workbench`).
    const workbench = path.join(pkg, "workbench");
    if (!existsSync(workbench)) return;
    const offending = sources(workbench).flatMap((file) => {
      const code = readFileSync(file, "utf8");
      const named = /@danarocha\/loupe\b|@ui-sdk\//.test(code) ? [`${path.relative(pkg, file)} names Loupe or UI SDK`] : [];
      const allowed = isTest(file) ? TEST_TOOLS : /^(vite|node:[\w/]+)$/;
      return [
        ...named,
        ...specifiers(code)
          .filter((specifier) => {
            if (specifier.startsWith(".")) return !inside(pkg, resolved(file, specifier));
            return !(REACT.test(specifier) || specifier in uiEntries || allowed.test(specifier));
          })
          .map((specifier) => `${path.relative(pkg, file)} → ${specifier}`),
      ];
    });
    expect(offending).toEqual([]);
  });

  it("is private, and its entries are files in src", () => {
    expect(manifest.private).toBe(true);
    for (const [entry, target] of Object.entries(manifest.exports as Record<string, string>)) {
      expect(existsSync(path.join(pkg, target)), entry).toBe(true);
      if (entry !== "./package.json") expect(target, entry).toMatch(/^\.\/src\//);
    }
  });

  it("depends on @loupe/ui alone, from the workspace, and leaves UI SDK's pin to it", () => {
    // One pin of UI SDK, @loupe/ui's (its boundary.test.ts), repeated by @danarocha/loupe, which ships both.
    expect(manifest.dependencies).toEqual({ "@loupe/ui": "workspace:*" });
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      expect(Object.keys(manifest[field] ?? {}).filter((name) => name.startsWith("@ui-sdk/")), field).toEqual([]);
    }
  });

  it("builds its .d.ts against @loupe/ui's own, one path for each entry @loupe/ui ships", () => {
    // tsconfig.build.json's comments are JSONC: read the paths alone.
    const text = readFileSync(path.join(pkg, "tsconfig.build.json"), "utf8");
    const paths = JSON.parse(`{${(text.match(/"paths":\s*\{[^}]*\}/) as RegExpMatchArray)[0]}}`).paths as Record<string, string[]>;
    const shipped = Object.keys(uiEntries).filter(isShippedUiEntry);
    expect(Object.keys(paths).sort()).toEqual(shipped.sort());
    for (const specifier of shipped) {
      const target = (uiEntries[specifier] as string).replace(/^\.\/src\//, "").replace(/\.tsx?$/, ".d.ts");
      expect(paths[specifier], specifier).toEqual([`../ui/dist/${target}`]);
    }
  });
});
