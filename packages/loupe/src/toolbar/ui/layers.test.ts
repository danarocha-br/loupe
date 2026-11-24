// The import rule (ADR 0003, DESIGN.md "Layers"): tokens, then primitives, then
// patterns, then views, imported in one direction.
// - Nothing outside `ui/` imports UI SDK: the primitives' interface is Loupe's own.
// - `ui/` imports nothing from the rest of the toolbar, patterns included, so it can
//   become a package by moving it. Its tests may draw in the surface (the test host),
//   never reach `panel-view/` or `runtime/`.
// - A pattern imports only `ui/`, the tokens, other patterns and `panel-view`'s types:
//   never a value from `panel-view/` (its words come in its props), never `runtime/`, a
//   view, or UI SDK. Its tests may draw in the surface and take panel-view's words for
//   sample data, never reach `runtime/` or a view.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ui = path.dirname(fileURLToPath(import.meta.url));
const toolbar = path.resolve(ui, "..");
const src = path.resolve(toolbar, "..");
const pkg = path.resolve(src, "..");
const patterns = path.join(toolbar, "patterns");
const panelView = path.join(toolbar, "panel-view");
const tokens = path.join(toolbar, "tokens.ts");

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

/** A test, or a fixture only tests load: neither ships. */
const isTest = (file: string) => /\.(test|fixture)\.tsx?$/.test(file);
const inside = (dir: string, target: string) => target === dir || target.startsWith(dir + path.sep);
const resolved = (file: string, specifier: string) => path.resolve(path.dirname(file), specifier.replace(/\?.*$/, ""));

/**
 * What a pattern's file imports that a pattern may not: anything outside `ui/`, the tokens,
 * the patterns, React and its own CSS, and any value from `panel-view/`.
 */
function patternOffenders(file: string, code: string): string[] {
  return imports(code)
    .filter(({ specifier, typeOnly }) => {
      if (!specifier.startsWith(".")) return !/^(react|react-dom)(\/|$)/.test(specifier);
      const target = resolved(file, specifier);
      if (inside(panelView, target)) return !typeOnly;
      const allowed = inside(ui, target) || inside(patterns, target) || target === tokens || target === tokens.replace(/\.ts$/, ".js");
      return !allowed;
    })
    .map(({ specifier }) => `${path.relative(src, file)} → ${specifier}`);
}

/** What a file in `ui/` imports from the patterns, types included: none may. */
function patternImports(file: string, code: string): string[] {
  return imports(code)
    .filter(({ specifier }) => specifier.startsWith(".") && inside(patterns, resolved(file, specifier)))
    .map(({ specifier }) => `${path.relative(src, file)} → ${specifier}`);
}

describe("the layers' import rule", () => {
  it("keeps UI SDK behind the primitives: nothing outside ui/ imports it", () => {
    const offenders = sources(src)
      .filter((file) => !inside(ui, file))
      .flatMap((file) => specifiers(file).filter((s) => s.startsWith("@ui-sdk/")).map((s) => `${path.relative(src, file)} → ${s}`));
    expect(offenders).toEqual([]);
  });

  it("keeps ui/ to itself: a primitive imports only ui/, React and UI SDK", () => {
    const offenders: string[] = [];
    for (const file of sources(ui).filter((file) => !isTest(file))) {
      for (const specifier of specifiers(file)) {
        const ok = specifier.startsWith(".")
          ? inside(ui, resolved(file, specifier))
          : /^(react|react-dom)(\/|$)|^@ui-sdk\//.test(specifier);
        if (!ok) offenders.push(`${path.relative(src, file)} → ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the patterns out of ui/: no primitive, nor its test, imports a pattern", () => {
    expect(sources(ui).flatMap((file) => patternImports(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("would catch a primitive that imports a pattern", () => {
    const file = path.join(ui, "example", "example.tsx");
    const code = [
      'import { Button } from "../button/button.js";',
      'import { Identity } from "../../patterns/index.js";',
      'import type { PropRowProps } from "../../patterns/prop-row/prop-row.js";',
      'const lazy = () => import("../../patterns/marks/marks.js");',
    ].join("\n");
    expect(patternImports(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../../patterns/index.js",
      "../../patterns/prop-row/prop-row.js",
      "../../patterns/marks/marks.js",
    ]);
  });

  it("keeps a pattern to ui/, the tokens, other patterns and panel-view's types", () => {
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
      'import { Button } from "../../ui/index.js";',
      'import { Keys } from "../marks/marks.js";',
      'import { SPACE } from "../../tokens.js";',
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
      // Dynamic imports are read after the statements.
      "../../panel.js",
    ]);
  });

  it("keeps the patterns' tests off runtime/ and the views", () => {
    const allowed = [ui, patterns, panelView, path.join(toolbar, "surface"), tokens];
    const offenders = sources(patterns)
      .filter(isTest)
      .flatMap((file) =>
        specifiers(file)
          .filter((s) => s.startsWith(".") && !allowed.some((dir) => inside(dir, resolved(file, s))))
          .map((s) => `${path.relative(src, file)} → ${s}`),
      );
    expect(offenders).toEqual([]);
  });

  it("keeps ui/'s tests off panel-view/ and runtime/", () => {
    const off = [path.join(src, "toolbar", "panel-view"), path.join(src, "runtime")];
    const offenders = sources(ui)
      .filter(isTest)
      .flatMap((file) =>
        specifiers(file)
          .filter((s) => s.startsWith(".") && off.some((dir) => inside(dir, resolved(file, s))))
          .map((s) => `${path.relative(src, file)} → ${s}`),
      );
    expect(offenders).toEqual([]);
  });

  it("pins UI SDK to an exact version, as a dependency the host never imports", () => {
    const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
    for (const name of ["@ui-sdk/react", "@ui-sdk/core"]) {
      expect(manifest.dependencies[name], name).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
      expect(manifest.peerDependencies?.[name], name).toBeUndefined();
    }
    expect(manifest.dependencies["@ui-sdk/react"]).toBe(manifest.dependencies["@ui-sdk/core"]);
  });
});
