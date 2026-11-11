// The Product layer package `init` creates (PER-93): `packages/loupe` as
// `@repo/loupe`. `generate` fills `adapters/`, `meta/` and `adapt-list.json`;
// `init` writes only the package's own entry points.

import { NPM_PACKAGE, PRODUCT_LAYER } from "./touch-points.js";

export type ProductLayerInput = {
  version: string;
  /** The design system's package name, which the Adapters import. */
  designSystem: string;
  workspaceProtocol: string;
  /** The app's own `react` and `next` ranges, so the workspace keeps one copy of each. */
  react: string;
  next: string;
};

const NOTE = "Written by loupe init. Edit nothing here: loupe init and loupe generate own this package.";

/** Paths relative to the Product layer, mapped to their exact bytes. */
export function productLayerFiles(input: ProductLayerInput): Map<string, string> {
  const pkg = {
    name: PRODUCT_LAYER.name,
    version: "0.0.0",
    private: true,
    description: NOTE,
    sideEffects: false,
    dependencies: {
      [input.designSystem]: input.workspaceProtocol,
      react: input.react,
    },
    // One runtime copy: the app's own devDependency satisfies both.
    peerDependencies: {
      [NPM_PACKAGE]: input.version,
      next: input.next,
    },
  };
  return new Map([
    ["package.json", `${JSON.stringify(pkg, null, 2)}\n`],
    // Resolved relative to this file, never by the package's own name: a
    // package without an `exports` map can't require itself (PER-94).
    [
      "next.js",
      [
        `// ${NOTE}`,
        `const path = require("node:path");`,
        `const loupe = require("${NPM_PACKAGE}/next");`,
        "",
        "/** Wraps the app's Next config. Adds Loupe's loader under `next dev` only. */",
        "exports.withLoupe = (config) =>",
        `  loupe.withLoupe(config, { adaptList: path.join(__dirname, "adapt-list.json") });`,
        "",
      ].join("\n"),
    ],
    [
      "next.d.ts",
      [
        `// ${NOTE}`,
        "export declare function withLoupe<C extends object>(",
        "  config: C | ((phase: string, context: unknown) => C | Promise<C>),",
        "): (phase: string, context?: unknown) => Promise<C>;",
        "",
      ].join("\n"),
    ],
    [
      "mount.tsx",
      [`"use client";`, "", `// ${NOTE}`, `export { LoupeMount } from "${NPM_PACKAGE}/mount";`, ""].join("\n"),
    ],
  ]);
}
