// The import rule (ADR 0003, DESIGN.md "Layers"): tokens, then primitives, then
// patterns, then views, imported in one direction.
// - Nothing outside `ui/` imports UI SDK: the primitives' interface is Loupe's own.
// - `ui/` imports nothing from the rest of the toolbar, so it can become a package by
//   moving it. Its tests may draw in the surface (the test host), never reach
//   `panel-view/` or `runtime/`.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ui = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(ui, "../..");
const pkg = path.resolve(src, "..");

const sources = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(c|m)?tsx?$/.test(file))
    .map((file) => path.join(dir, file));

/** Every module specifier a file imports or re-exports, statically or dynamically. */
function specifiers(file: string): string[] {
  const code = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)["']([^"']+)["']/gm)) found.push(match[1] as string);
  return found;
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file);
const inside = (dir: string, target: string) => target === dir || target.startsWith(dir + path.sep);
const resolved = (file: string, specifier: string) => path.resolve(path.dirname(file), specifier.replace(/\?.*$/, ""));

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
