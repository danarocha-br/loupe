// Where each touch point is in this repo, in the order `init` applies them.

import { existsSync } from "node:fs";
import path from "node:path";
import { NPM_PACKAGE, PRODUCT_LAYER } from "../../names.js";
import type { TouchPoint, TouchPointContext } from "../touch-points.js";
import { biomeConfig } from "./biome-config.js";
import { nextConfig } from "./next-config.js";
import { packageJson } from "./package-json.js";
import { rootLayout } from "./root-layout.js";

/** In the order `init` applies them. Without `ctx.app`, only the ones at the root. */
export function touchPoints(ctx: TouchPointContext): TouchPoint[] {
  const biome = firstExisting(ctx.root, ["biome.jsonc", "biome.json"]);
  const atRoot = biome ? [biomeConfig(biome)] : [];
  const { app } = ctx;
  if (app === undefined) return atRoot;
  return [
    ...atRoot,
    packageJson(`${app}/package.json`, {
      [NPM_PACKAGE]: ctx.version,
      [PRODUCT_LAYER.name]: ctx.workspaceProtocol,
    }),
    nextConfig(
      firstExisting(ctx.root, ["ts", "mts", "js", "mjs"].map((ext) => `${app}/next.config.${ext}`)) ?? `${app}/next.config.ts`,
    ),
    rootLayout(firstExisting(ctx.root, [`${app}/app/layout.tsx`, `${app}/src/app/layout.tsx`]) ?? `${app}/app/layout.tsx`),
  ];
}

function firstExisting(root: string, files: string[]): string | undefined {
  return files.find((f) => existsSync(path.join(root, f)));
}
