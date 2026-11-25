// The import rule (ADR 0003, 0010, DESIGN.md "Layers"): tokens, then primitives, then
// patterns, then views, imported in one direction. The tokens and the primitives are
// `@loupe/ui`, a package of their own (`packages/ui`), whose side of the boundary is its
// `src/boundary.test.ts`: it imports nothing from Loupe. This is Loupe's side:
// - Nothing in Loupe imports UI SDK: the primitives' interface is Loupe's own.
// - Nothing in Loupe reaches into `packages/ui` by a path: only through `@loupe/ui`'s
//   entries, the same list in its `package.json`, the tsconfigs and `vite.config.ts`.
// - No shipped module imports a test-only entry (`@loupe/ui/testing`, `/listen`, `/jsdom-gaps`).
// - A pattern imports only `@loupe/ui` (the primitives and the tokens), other patterns and
//   `panel-view`'s types: never a value from `panel-view/` (its words come in its props),
//   never `runtime/`, a view, or UI SDK. Its tests may draw in the surface and take
//   panel-view's words for sample data, never reach `runtime/` or a view.

import { readdirSync, readFileSync } from "node:fs";
import { parse } from "jsonc-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { uiEntries } from "../../vite.config.js";

const toolbar = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(toolbar, "..");
const pkg = path.resolve(src, "..");
const uiPackage = path.resolve(pkg, "..", "ui");
const patterns = path.join(toolbar, "patterns");
const panelView = path.join(toolbar, "panel-view");

/** `@loupe/ui`'s entries a shipped module may import, and the ones only tests may. */
const TEST_ENTRIES = ["@loupe/ui/testing", "@loupe/ui/listen", "@loupe/ui/jsdom-gaps"];
const isShippedEntry = (specifier: string) => specifier in uiEntries() && !TEST_ENTRIES.includes(specifier);

const sources = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(c|m)?tsx?$/.test(file))
    .map((file) => path.join(dir, file));

/** Every module specifier a file imports or re-exports, statically or dynamically. */
function specifiers(file: string): string[] {
  return imports(readFileSync(file, "utf8")).map((found) => found.specifier);
}

/**
 * Every import and re-export in `code`, with whether it brings in types only: `import type`
 * and `export type`, which leave nothing behind at run time. `import { type X }` is a value
 * import as written, and counts as one.
 */
function imports(code: string): { specifier: string; typeOnly: boolean }[] {
  const found: { specifier: string; typeOnly: boolean }[] = [];
  // A statement: `import … from "x"`, `export … from "x"`, or a bare `import "x"`, wherever it
  // starts (after another statement on the line too) and however tightly it is written
  // (`import{X}from"x"`). A comment that reads like one counts: a false alarm is safer.
  for (const match of code.matchAll(/\b(import|export)\b(\s*type\b)?(?:[^;"'`()]*?\bfrom)?\s*["']([^"']+)["']/g)) {
    found.push({ specifier: match[3] as string, typeOnly: match[2] !== undefined });
  }
  for (const match of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) found.push({ specifier: match[1] as string, typeOnly: false });
  return found;
}

/** Every module in Loupe's `src` but this file, whose examples break the rules on purpose. */
const loupeSources = () => sources(src).filter((file) => file !== fileURLToPath(import.meta.url));

/** A test, or a fixture only tests load: neither ships. */
const isTest = (file: string) => /\.(test|fixture)\.tsx?$/.test(file);
const inside = (dir: string, target: string) => target === dir || target.startsWith(dir + path.sep);
const resolved = (file: string, specifier: string) => path.resolve(path.dirname(file), specifier.replace(/\?.*$/, ""));

/**
 * What a pattern's file imports that a pattern may not: anything outside `@loupe/ui`'s
 * shipped entries, the patterns, React and its own CSS, and any value from `panel-view/`.
 */
function patternOffenders(file: string, code: string): string[] {
  return imports(code)
    .filter(({ specifier, typeOnly }) => {
      if (!specifier.startsWith(".")) return !(/^(react|react-dom)(\/|$)/.test(specifier) || isShippedEntry(specifier));
      const target = resolved(file, specifier);
      if (inside(panelView, target)) return !typeOnly;
      return !inside(patterns, target);
    })
    .map(({ specifier }) => `${path.relative(src, file)} → ${specifier}`);
}

/** What a file imports from `packages/ui` by a path, or a `@loupe/ui` entry that isn't one. */
function packageOffenders(file: string, code: string): string[] {
  return imports(code)
    .filter(({ specifier }) =>
      specifier.startsWith(".") ? inside(uiPackage, resolved(file, specifier)) : /^@loupe\/ui(\/|$)/.test(specifier) && !(specifier in uiEntries()),
    )
    .map(({ specifier }) => `${path.relative(src, file)} → ${specifier}`);
}

/** The `paths` a tsconfig maps `@loupe/ui`'s entries to. */
const tsconfigPaths = (file: string): Record<string, string[]> => parse(readFileSync(path.join(pkg, file), "utf8")).compilerOptions.paths;

describe("the layers' import rule", () => {
  it("keeps UI SDK behind the primitives: nothing in Loupe imports it", () => {
    const offenders = loupeSources().flatMap((file) =>
      specifiers(file)
        .filter((s) => s.startsWith("@ui-sdk/"))
        .map((s) => `${path.relative(src, file)} → ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it("reaches @loupe/ui through its entries only, never by a path into packages/ui", () => {
    expect(loupeSources().flatMap((file) => packageOffenders(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("would catch a path into packages/ui, or an entry the package doesn't have", () => {
    const file = path.join(toolbar, "example.tsx");
    const code = [
      'import { Button } from "@loupe/ui";',
      'import { SPACE } from "@loupe/ui/tokens";',
      'import { Chip } from "../../../ui/src/chip-group/chip-group.js";',
      'import { Card } from "@loupe/ui/card";',
      'const lazy = () => import("../../../ui/dist/index.js");',
    ].join("\n");
    expect(packageOffenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../../../ui/src/chip-group/chip-group.js",
      "@loupe/ui/card",
      "../../../ui/dist/index.js",
    ]);
  });

  it("ships no test-only entry: a module that isn't a test imports none", () => {
    const offenders = loupeSources()
      .filter((file) => !isTest(file))
      .flatMap((file) => specifiers(file).filter((s) => TEST_ENTRIES.includes(s)).map((s) => `${path.relative(src, file)} → ${s}`));
    expect(offenders).toEqual([]);
  });

  it("names @loupe/ui nowhere in package.json, and maps its entries in both tsconfigs as its package.json does", () => {
    // A published package must never depend on an unpublished one: not even a devDependency (ADR 0010).
    expect(readFileSync(path.join(pkg, "package.json"), "utf8")).not.toContain("@loupe/ui");
    const entries = uiEntries();
    const source = tsconfigPaths("tsconfig.json");
    expect(Object.keys(source).sort()).toEqual(Object.keys(entries).sort());
    for (const [specifier, target] of Object.entries(entries)) expect(source[specifier], specifier).toEqual([path.relative(pkg, target)]);
    // The build reads the package's own .d.ts, of every entry that ships.
    const built = tsconfigPaths("tsconfig.build.json");
    expect(Object.keys(built).sort()).toEqual(Object.keys(entries).filter(isShippedEntry).sort());
    for (const specifier of Object.keys(built)) {
      const target = path.relative(path.join(uiPackage, "src"), entries[specifier] as string).replace(/\.tsx?$/, ".d.ts");
      expect(built[specifier], specifier).toEqual([path.join("..", "ui", "dist", target)]);
    }
  });

  it("keeps a pattern to @loupe/ui, other patterns and panel-view's types", () => {
    const offenders = sources(patterns)
      .filter((file) => !isTest(file))
      .flatMap((file) => patternOffenders(file, readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("would catch a pattern that reaches past them", () => {
    const file = path.join(patterns, "example", "example.tsx");
    const code = [
      'import type { PropItem } from "../../panel-view/index.js";',
      'import { TEXT } from "../../panel-view/index.js";',
      'import { type Write } from "../../panel-view/types.js";',
      'import { Button } from "@loupe/ui";',
      'import { Keys } from "../marks/marks.js";',
      'import { SPACE } from "@loupe/ui/tokens";',
      'import CSS from "./example.css?inline";',
      'import { useState } from "react";',
      'import { Field } from "@ui-sdk/react";',
      'import type { LoupeDebug } from "../../../runtime/debug.js";',
      'import { attempt } from "../../controls.js";',
      'import { FileIcon } from "../../icons.js";',
      'export { panelView } from "../../panel-view/index.js";',
      'const lazy = () => import("../../panel.js");',
      'import{Popover}from"@ui-sdk/react";',
      'const x = 1; export { attempt } from "../../controls.js";',
      'import type{Write}from"../../panel-view/types.js";',
      // Patterns read no store: the view reads the Toolbar's store and passes props down (ADR 0009).
      'import { useToolbar } from "../../toolbar-store.js";',
      // The package by a path, a test's entry, and the surface's internals: not a pattern's.
      'import { Chip } from "../../../../../ui/src/chip-group/chip-group.js";',
      'import { renderInSurface } from "@loupe/ui/testing";',
    ].join("\n");
    expect(patternOffenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../../panel-view/index.js",
      "../../panel-view/types.js",
      "@ui-sdk/react",
      "../../../runtime/debug.js",
      "../../controls.js",
      "../../icons.js",
      "../../panel-view/index.js",
      "@ui-sdk/react",
      "../../controls.js",
      "../../toolbar-store.js",
      "../../../../../ui/src/chip-group/chip-group.js",
      "@loupe/ui/testing",
      // Dynamic imports are read after the statements.
      "../../panel.js",
    ]);
  });

  it("keeps the patterns' tests off runtime/ and the views", () => {
    const allowed = [patterns, panelView, path.join(toolbar, "surface")];
    const offenders = sources(patterns)
      .filter(isTest)
      .flatMap((file) =>
        specifiers(file)
          .filter((s) => s.startsWith(".") && !allowed.some((dir) => inside(dir, resolved(file, s))))
          .map((s) => `${path.relative(src, file)} → ${s}`),
      );
    expect(offenders).toEqual([]);
  });

  it("keeps the Server Actions out of panel-view: the flags store and its actions for types only", () => {
    // panel-view is what the workbench draws its samples with; it must not pull a request in.
    const actions = ["flags-store", "flags-server"].flatMap((name) => [path.join(toolbar, `${name}.ts`), path.join(toolbar, `${name}.js`)]);
    const offenders = sources(panelView)
      .filter((file) => !isTest(file))
      .flatMap((file) =>
        imports(readFileSync(file, "utf8"))
          .filter((found) => !found.typeOnly && actions.includes(resolved(file, found.specifier)))
          .map((found) => `${path.relative(src, file)} → ${found.specifier}`),
      );
    expect(offenders).toEqual([]);
  });

  it("repeats @loupe/ui's UI SDK pin, as a dependency the host never imports", () => {
    // The pin is @loupe/ui's (its boundary.test.ts); dist/ui imports UI SDK, so a host installs it with Loupe.
    const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
    const system = JSON.parse(readFileSync(path.join(uiPackage, "package.json"), "utf8"));
    for (const name of ["@ui-sdk/react", "@ui-sdk/core"]) {
      expect(manifest.dependencies[name], name).toBe(system.dependencies[name]);
      expect(manifest.peerDependencies?.[name], name).toBeUndefined();
    }
  });
});
