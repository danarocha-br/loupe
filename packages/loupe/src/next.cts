// `withLoupe(nextConfig, { adaptList })`: the `next.config.ts` wrapper (PER-93).
//
// It returns Next's phase function and adds the loader only for
// `next dev`. Every other phase gets the config untouched, because `next build`
// serialises `turbopack.rules`, loader path included, into
// `.next/required-server-files.json` even when the rule's condition never fires.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

/** Next's `PHASE_DEVELOPMENT_SERVER`, inlined so Loupe needs no `next` import. */
export const PHASE_DEVELOPMENT_SERVER = "phase-development-server";
export const LOADER_RULE = "*.tsx";

export type LoupeOptions = {
  /** Path of the Product layer's `adapt-list.json`, absolute or from the cwd. */
  adaptList: string;
  /** Repo root the adapt list's paths are relative to. Default: the nearest pnpm workspace. */
  root?: string;
};

// Structural, so Next's own `NextConfig` interface fits without Loupe importing it.
type Config = { turbopack?: { rules?: object } };
type ConfigFunction<C> = (phase: string, context: unknown) => C | Promise<C>;

export function withLoupe<C extends Config>(
  config: C | ConfigFunction<C>,
  options: LoupeOptions,
): (phase: string, context?: unknown) => Promise<C> {
  return async (phase, context) => {
    const base = typeof config === "function" ? await config(phase, context) : config;
    if (phase !== PHASE_DEVELOPMENT_SERVER || process.env.LOUPE === "0") return base;

    const adaptList = path.resolve(options.adaptList);
    // Fail at startup, once, rather than on every file the loader sees.
    const { parseAdaptList } = await import("./adapt-list.js");
    parseAdaptList(readFileSync(adaptList, "utf8"), adaptList);
    const root = realpathSync(path.resolve(options.root ?? findWorkspaceRoot(path.dirname(adaptList))));

    const rules = base.turbopack?.rules ?? {};
    if (LOADER_RULE in rules) {
      throw new Error(
        `withLoupe: turbopack.rules already has a "${LOADER_RULE}" rule, and Loupe will not merge into it.`,
      );
    }
    return {
      ...base,
      turbopack: {
        ...base.turbopack,
        rules: {
          ...rules,
          [LOADER_RULE]: {
            // Design-system packages linked from the workspace are not foreign,
            // so their own call sites are anchored too.
            condition: { all: ["development", { not: "foreign" }] },
            loaders: [{ loader: path.join(__dirname, "loader.cjs"), options: { root, adaptList } }],
          },
        },
      },
    };
  };
}

function findWorkspaceRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    if (path.dirname(dir) === dir) {
      throw new Error(`withLoupe: no pnpm-workspace.yaml above ${from}; pass { root }.`);
    }
  }
}
