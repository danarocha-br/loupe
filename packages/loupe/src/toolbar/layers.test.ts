// The import rule (ADR 0003, 0010, 0012, DESIGN.md "Layers"): tokens, then primitives, then
// patterns, then views, imported in one direction. The tokens and the primitives are
// `@loupe/ui` (`packages/ui`), the patterns `@loupe/patterns` (`packages/patterns`), packages of
// their own, whose sides of the boundary are their `src/boundary.test.ts`: neither imports
// anything from Loupe, and a pattern imports only `@loupe/ui`, other patterns, their tokens and
// their contract. This is Loupe's side:
// - Nothing in Loupe imports UI SDK: the primitives' interface is Loupe's own.
// - Nothing in Loupe reaches into `packages/ui` or `packages/patterns` by a path: only through
//   their entries, the same lists in their `package.json`, the tsconfigs and `vite.config.ts`.
// - No shipped module imports a test-only entry, one whose target is a `.fixture`
//   (`@loupe/ui/testing`, `/listen`, `/jsdom-gaps`, `@loupe/patterns/testing`): `isTestEntry`,
//   as the build decides it.
// - No pattern, sample, test or `.md` of the patterns names a `*_WORDS` constant: they spell
//   their words out, and `panel-view/samples.test.ts` holds them equal (ADR 0012).
// - panel-view takes from the patterns only their tokens and their contract's types, never a pattern.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "jsonc-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isTestEntry, patternsEntries, uiEntries, workspaceEntries } from "../../vite.config.js";

const toolbar = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(toolbar, "..");
const pkg = path.resolve(src, "..");
const uiPackage = path.resolve(pkg, "..", "ui");
const patternsPackage = path.resolve(pkg, "..", "patterns");
const panelView = path.join(toolbar, "panel-view");

/** A workspace entry a shipped module may import: one whose target isn't a `.fixture` (the build's own rule, `isTestEntry`). */
const isShippedEntry = (specifier: string) => {
  const target = workspaceEntries()[specifier];
  return target !== undefined && !isTestEntry(target);
};
const isTestOnlyEntry = (specifier: string) => {
  const target = workspaceEntries()[specifier];
  return target !== undefined && isTestEntry(target);
};
/** A path as the tsconfigs write it, with `/` on any platform. */
const posix = (file: string) => file.split(path.sep).join("/");

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

/** What a file imports from `packages/ui` or `packages/patterns` by a path, or an entry of theirs that isn't one. */
function packageOffenders(file: string, code: string): string[] {
  return imports(code)
    .filter(({ specifier }) =>
      specifier.startsWith(".")
        ? [uiPackage, patternsPackage].some((dir) => inside(dir, resolved(file, specifier)))
        : /^@loupe\/(ui|patterns)(\/|$)/.test(specifier) && !(specifier in workspaceEntries()),
    )
    .map(({ specifier }) => `${path.relative(src, file)} → ${specifier}`);
}

/**
 * What a module of panel-view takes from `@loupe/patterns` that it may not: anything but the
 * contract's types, from the main entry and as types alone, and the Toolbar's tokens.
 */
function panelViewOffenders(file: string, code: string): string[] {
  return imports(code)
    .filter(({ specifier, typeOnly }) => {
      if (specifier.startsWith(".")) return inside(patternsPackage, resolved(file, specifier));
      if (!/^@loupe\/patterns(\/|$)/.test(specifier)) return false;
      return !(specifier === "@loupe/patterns/tokens" || (specifier === "@loupe/patterns" && typeOnly));
    })
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

  it("reaches @loupe/ui and @loupe/patterns through their entries only, never by a path into their folders", () => {
    expect(loupeSources().flatMap((file) => packageOffenders(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("would catch a path into packages/ui or packages/patterns, or an entry a package doesn't have", () => {
    const file = path.join(toolbar, "example.tsx");
    const code = [
      'import { Button } from "@loupe/ui";',
      'import { SPACE } from "@loupe/ui/tokens";',
      'import { PropRow } from "@loupe/patterns";',
      'import { MAP_HUES } from "@loupe/patterns/tokens";',
      'import { Chip } from "../../../ui/src/chip-group/chip-group.js";',
      'import { Card } from "@loupe/ui/card";',
      'import { Sheet } from "../../../patterns/src/sheet/sheet.js";',
      'import type { PropItem } from "@loupe/patterns/view";',
      // The ui workbench's shell is the packages' own development, never Loupe's.
      'import { mountWorkbench } from "@loupe/ui/workbench";',
      'const lazy = () => import("../../../ui/dist/index.js");',
    ].join("\n");
    expect(packageOffenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "../../../ui/src/chip-group/chip-group.js",
      "@loupe/ui/card",
      "../../../patterns/src/sheet/sheet.js",
      "@loupe/patterns/view",
      "@loupe/ui/workbench",
      "../../../ui/dist/index.js",
    ]);
  });

  it("ships no test-only entry: a module that isn't a test imports none", () => {
    const offenders = loupeSources()
      .filter((file) => !isTest(file))
      .flatMap((file) => specifiers(file).filter(isTestOnlyEntry).map((s) => `${path.relative(src, file)} → ${s}`));
    expect(offenders).toEqual([]);
    expect(isTestOnlyEntry("@loupe/patterns/testing")).toBe(true);
    expect(isTestOnlyEntry("@loupe/ui/testing")).toBe(true);
  });

  it("names neither package in package.json, and maps their entries in both tsconfigs as their package.json do", () => {
    // A published package must never depend on an unpublished one: not even a devDependency (ADR 0010, 0012).
    const manifest = readFileSync(path.join(pkg, "package.json"), "utf8");
    expect(manifest).not.toContain("@loupe/ui");
    expect(manifest).not.toContain("@loupe/patterns");
    const entries = workspaceEntries();
    expect(Object.keys(uiEntries())).toContain("@loupe/ui/surface");
    expect(Object.keys(patternsEntries())).toEqual(["@loupe/patterns", "@loupe/patterns/launcher", "@loupe/patterns/stylesheet", "@loupe/patterns/tokens", "@loupe/patterns/samples", "@loupe/patterns/testing"]);
    const source = tsconfigPaths("tsconfig.json");
    expect(Object.keys(source).sort()).toEqual(Object.keys(entries).sort());
    for (const [specifier, target] of Object.entries(entries)) expect(source[specifier], specifier).toEqual([posix(path.relative(pkg, target))]);
    // The build reads each package's own .d.ts, of every entry that ships.
    const built = tsconfigPaths("tsconfig.build.json");
    expect(Object.keys(built).sort()).toEqual(Object.keys(entries).filter(isShippedEntry).sort());
    for (const specifier of Object.keys(built)) {
      const home = specifier.startsWith("@loupe/patterns") ? patternsPackage : uiPackage;
      const target = path.relative(path.join(home, "src"), entries[specifier] as string).replace(/\.tsx?$/, ".d.ts");
      expect(built[specifier], specifier).toEqual([posix(path.join("..", path.basename(home), "dist", target))]);
    }
  });

  it("leaves both packages' builds to loupe's: the root build skips them, so one task writes each dist", () => {
    // Loupe's build runs `pnpm --dir ../patterns build`, which runs `pnpm --dir ../ui build` first;
    // with no dependency between them, a recursive build that also ran theirs would race it on the
    // same dist (review of #87).
    const root = JSON.parse(readFileSync(path.join(pkg, "..", "..", "package.json"), "utf8"));
    const build = (dir: string) => JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).scripts.build;
    expect(build(pkg)).toMatch(/^pnpm --dir \.\.\/patterns build && /);
    expect(build(patternsPackage)).toMatch(/^pnpm --dir \.\.\/ui build && /);
    expect(root.scripts.build).toMatch(/^pnpm -r --filter '!@loupe\/ui' --filter '!@loupe\/patterns' build$/);
  });

  it("keeps the words panelView() decides out of the patterns: their samples spell them out", () => {
    // ADR 0012: no pattern, test, sample or `.md` of `@loupe/patterns`, nor its workbench, names
    // panel-view's words; `panel-view/samples.test.ts` holds the samples' words equal to them.
    const constants = ["words.ts", "chrome.ts"].flatMap((file) =>
      [...readFileSync(path.join(panelView, file), "utf8").matchAll(/^export const ([A-Z_]+_WORDS)\b/gm)].map((match) => match[1] as string),
    );
    const named = new RegExp(`\\b(${constants.join("|")})\\b`, "g");
    const files = ["src", "workbench"]
      .map((dir) => path.join(patternsPackage, dir))
      .filter((dir) => existsSync(dir))
      .flatMap((dir) => readdirSync(dir, { recursive: true, encoding: "utf8" }).map((file) => path.join(dir, file)))
      .filter((file) => /\.(tsx?|md)$/.test(file));
    const offenders = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(named)].map((match) => `${path.relative(patternsPackage, file)} → ${match[0]}`),
    );
    expect(constants).toHaveLength(9);
    expect(files.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });

  it("lets panel-view take from the patterns only their tokens and their contract's types, never a pattern", () => {
    // The Toolbar's own tokens sit with the patterns (ADR 0011); panel-view reads the map's hue count from them.
    // The contract is what `panelView()` returns (ADR 0012), so the adapter imports its types.
    const offenders = sources(panelView)
      .filter((file) => !isTest(file))
      .flatMap((file) => panelViewOffenders(file, readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("would catch panel-view taking a pattern, or the contract as a value", () => {
    const file = path.join(panelView, "example.ts");
    const code = [
      'import type { PropItem, Write } from "@loupe/patterns";',
      'import { MAP_HUES } from "@loupe/patterns/tokens";',
      'import { PropRow } from "@loupe/patterns";',
      'import { type GroupItem } from "@loupe/patterns";',
      'import { LauncherPill } from "@loupe/patterns/launcher";',
      'import { STYLESHEET } from "@loupe/patterns/stylesheet";',
      'import { WORDS } from "@loupe/patterns/testing";',
      'import { PAGE } from "../../../../patterns/src/tokens.js";',
    ].join("\n");
    expect(panelViewOffenders(file, code).map((offender) => offender.split(" → ")[1])).toEqual([
      "@loupe/patterns",
      // `import { type X }` is a value import as written.
      "@loupe/patterns",
      "@loupe/patterns/launcher",
      "@loupe/patterns/stylesheet",
      "@loupe/patterns/testing",
      "../../../../patterns/src/tokens.js",
    ]);
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

  it("repeats @loupe/ui's UI SDK pin, as a dependency the host never imports, and @loupe/patterns names none", () => {
    // The pin is @loupe/ui's (its boundary.test.ts); dist/ui imports UI SDK, so a host installs it with Loupe.
    // @loupe/patterns draws UI SDK only through @loupe/ui's primitives: one pin for the three packages.
    const manifest = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
    const system = JSON.parse(readFileSync(path.join(uiPackage, "package.json"), "utf8"));
    const product = JSON.parse(readFileSync(path.join(patternsPackage, "package.json"), "utf8"));
    for (const name of ["@ui-sdk/react", "@ui-sdk/core"]) {
      expect(manifest.dependencies[name], name).toBe(system.dependencies[name]);
      expect(manifest.peerDependencies?.[name], name).toBeUndefined();
      for (const field of ["dependencies", "devDependencies", "peerDependencies"]) expect(product[field]?.[name], `@loupe/patterns ${field} ${name}`).toBeUndefined();
    }
    expect(product.dependencies["@loupe/ui"]).toBe("workspace:*");
  });
});
