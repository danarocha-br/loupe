// Where each touch point is in this repo, in the order `init` applies them.

import { existsSync } from "node:fs";
import path from "node:path";
import { NPM_PACKAGE, PRODUCT_LAYER, type TouchPoint, type TouchPointContext } from "../touch-points.js";
import { biomeConfig } from "./biome-config.js";
import { nextConfig } from "./next-config.js";
import { packageJson } from "./package-json.js";
import { rootLayout } from "./root-layout.js";

/** In the order `init` applies them. */
export function touchPoints(ctx: TouchPointContext): TouchPoint[] {
  const biome = firstExisting(ctx.root, ["biome.jsonc", "biome.json"]);
  return [
    ...(biome ? [biomeConfig(biome)] : []),
    packageJson(`${ctx.app}/package.json`, {
      [NPM_PACKAGE]: ctx.version,
      [PRODUCT_LAYER.name]: ctx.workspaceProtocol,
    }),
    nextConfig(
      firstExisting(ctx.root, ["ts", "mts", "js", "mjs"].map((ext) => `${ctx.app}/next.config.${ext}`)) ??
        `${ctx.app}/next.config.ts`,
    ),
    rootLayout(
      firstExisting(ctx.root, [`${ctx.app}/app/layout.tsx`, `${ctx.app}/src/app/layout.tsx`]) ??
        `${ctx.app}/app/layout.tsx`,
    ),
  ];
}

function firstExisting(root: string, files: string[]): string | undefined {
  return files.find((f) => existsSync(path.join(root, f)));
}
