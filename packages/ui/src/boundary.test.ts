// The package boundary (ADR 0010): the design system imports nothing from Loupe. A shipped
// module imports only this package, React and UI SDK; a test or a fixture also its test
// tools. Loupe's side of the rule (nothing in Loupe imports UI SDK, nor reaches in here but
// through the entries below) is Loupe's `src/toolbar/layers.test.ts`.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(src, "..");
const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));

/** Every module in `src` but this file, whose examples break the rule on purpose. */
const sources = () =>
  readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(c|m)?tsx?$/.test(file))
    .map((file) => path.join(src, file))
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
const SHIPPED = /^(react|react-dom)(\/|$)|^@ui-sdk\/(react|core)(\/|$)/;
const TEST_TOOLS = /^(vitest|@testing-library\/(dom|user-event)|axe-core|node:[\w/]+)$/;

/**
 * What a file imports that it may not: a path out of `src` (out of the package, for a test,
 * which may read the package's own build config), or a package it has no business with.
 */
function offenders(file: string, code: string): string[] {
  const home = isTest(file) ? pkg : src;
  return specifiers(code)
    .filter((specifier) => {
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier.replace(/\?.*$/, ""));
        return !target.startsWith(home + path.sep);
      }
      return !(SHIPPED.test(specifier) || (isTest(file) && TEST_TOOLS.test(specifier)));
    })
    .map((specifier) => `${path.relative(src, file)} → ${specifier}`);
}

describe("the package boundary", () => {
  it("keeps a shipped module to this package, React and UI SDK", () => {
    expect(sources().filter((file) => !isTest(file)).flatMap((file) => offenders(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("keeps the tests to this package, React, UI SDK and their tools", () => {
    expect(sources().filter(isTest).flatMap((file) => offenders(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("would catch a module that reaches into Loupe", () => {
    const file = path.join(src, "example", "example.tsx");
    const code = [
      'import { Radio } from "@ui-sdk/react/radio";',
      'import { useState } from "react";',
      'import { Button } from "../button/button.js";',
      'import CSS from "./example.css?inline";',
      'import { panelView } from "../../../loupe/src/toolbar/panel-view/index.js";',
      'import type { PropItem } from "@danarocha/loupe/runtime";',
      'import{STYLESHEET}from"../../../loupe/src/toolbar/surface/index.js";',
      'const lazy = () => import("@danarocha/loupe/workbench");',
      'import { describe } from "vitest";',
    ].join("\n");
    expect(offenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../../../loupe/src/toolbar/panel-view/index.js",
      "@danarocha/loupe/runtime",
      "../../../loupe/src/toolbar/surface/index.js",
      // A test tool, in a shipped file.
      "vitest",
      // Dynamic imports are read after the statements.
      "@danarocha/loupe/workbench",
    ]);
  });

  it("names no Loupe package anywhere in its source", () => {
    const named = sources().filter((file) => /@danarocha\/loupe\b/.test(readFileSync(file, "utf8")));
    expect(named.map((file) => path.relative(src, file))).toEqual([]);
  });

  it("keeps the workbench to this package, React and its dev server: it draws the system as Loupe would, and imports nothing of Loupe's", () => {
    // The workbench (ADR 0011) draws `src` from beside it: a path into the package, never out of it.
    const workbench = path.join(pkg, "workbench");
    const offending = readdirSync(workbench, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(c|m)?tsx?$/.test(file))
      .map((file) => path.join(workbench, file))
      .flatMap((file) => {
        const code = readFileSync(file, "utf8");
        const named = /@danarocha\/loupe\b/.test(code) ? [`${path.relative(pkg, file)} names Loupe`] : [];
        // Its dev server's React Refresh (`vite.ts`) too: the workbench's alone, never the build's (build.test.ts).
        const server = /^(vite|@vitejs\/plugin-react|node:[\w/]+)$/;
        const allowed = isTest(file) ? { test: (specifier: string) => TEST_TOOLS.test(specifier) || server.test(specifier) } : server;
        return [
          ...named,
          ...specifiers(code)
            .filter((specifier) => {
              if (specifier.startsWith(".")) return !path.resolve(path.dirname(file), specifier.replace(/\?.*$/, "")).startsWith(pkg + path.sep);
              return !(/^(react|react-dom)(\/|$)/.test(specifier) || allowed.test(specifier));
            })
            .map((specifier) => `${path.relative(pkg, file)} → ${specifier}`),
        ];
      });
    expect(offending).toEqual([]);
  });

  it("is private, and its entries are files in src, but the workbench's shell, which nothing builds", () => {
    expect(manifest.private).toBe(true);
    for (const [entry, target] of Object.entries(manifest.exports as Record<string, string>)) {
      expect(existsSync(path.join(pkg, target)), entry).toBe(true);
      if (entry === "./package.json") continue;
      // `@loupe/ui/workbench` (ADR 0012): for the packages' workbenches alone. Outside `src`, so
      // `entries()` never builds it and `dist` never holds it; Loupe's tsconfigs never map it.
      if (entry === "./workbench") expect(target).toBe("./workbench/shell/index.tsx");
      // And its dev server's config, which `@loupe/patterns`' workbench takes too.
      else if (entry === "./workbench/vite") expect(target).toBe("./workbench/vite.ts");
      else expect(target, entry).toMatch(/^\.\/src\//);
    }
  });

  it("pins UI SDK to one exact version, as a dependency, never a peer", () => {
    for (const name of ["@ui-sdk/react", "@ui-sdk/core"]) {
      expect(manifest.dependencies[name], name).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
      expect(manifest.peerDependencies?.[name], name).toBeUndefined();
    }
    expect(manifest.dependencies["@ui-sdk/react"]).toBe(manifest.dependencies["@ui-sdk/core"]);
  });
});
