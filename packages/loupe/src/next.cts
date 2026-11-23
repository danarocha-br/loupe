// `withLoupe(nextConfig, { adaptList })`: the `next.config.ts` wrapper (PER-93).
//
// It returns Next's phase function and adds the loader only for
// `next dev`. Every other phase gets the config untouched, because `next build`
// serialises `turbopack.rules`, loader path included, into
// `.next/required-server-files.json` even when the rule's condition never fires.
//
// The loader is registered for both bundlers: a Turbopack rule, and a webpack rule
// for `next dev --webpack`. Registering only the first left webpack running with
// no anchors and no error, so the Toolbar found nothing to pick.

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
type WebpackHook = (webpackConfig: any, context: any) => any;
type Config = {
  turbopack?: { rules?: object };
  webpack?: WebpackHook | null;
  env?: Record<string, string | undefined>;
};
type ConfigFunction<C> = (phase: string, context: unknown) => C | Promise<C>;

export function withLoupe<C extends Config>(
  config: C | ConfigFunction<C>,
  options: LoupeOptions,
): (phase: string, context?: unknown) => Promise<C> {
  return async (phase, context) => {
    const base = typeof config === "function" ? await config(phase, context) : config;
    if (phase !== PHASE_DEVELOPMENT_SERVER || process.env.LOUPE === "0") return base;

    const adaptList = path.resolve(options.adaptList);
    const root = realpathSync(path.resolve(options.root ?? findWorkspaceRoot(path.dirname(adaptList))));
    // The Toolbar's notices read the Product layer through a Server Action (PER-133).
    const env = { ...base.env, LOUPE_ROOT: root, LOUPE_ADAPT_LIST: adaptList, LOUPE_APP: process.cwd() };

    const { formatOf, generateCommand, writeAgainCommand } = await import("./layer-status.js");
    const { formatNotice, missingLayerAdvice } = await import("./format-notice.js");
    const { parseAdaptList } = await import("./adapt-list.js");

    // A Product layer the loader can't read fails startup (PER-133): dropping the rule,
    // or handing every file back untouched from the start, broke Turbopack's persistent
    // cache on orbix-ai. A missing one names the command that writes it again (PER-231),
    // one in another format the command that rewrites it (PER-85). Whether the loader's
    // dependency on a missing adapt-list.json (PER-229) makes starting safe is PER-232.
    let text: string;
    try {
      text = readFileSync(adaptList, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const command = writeAgainCommand({ root, adaptList, app: env.LOUPE_APP });
      throw new Error(`withLoupe: ${adaptList} is missing. ${missingLayerAdvice(command)}`, { cause: error });
    }
    const format = formatOf(text);
    const notice = format && `${formatNotice(format)} ${generateCommand({ root, adaptList, app: env.LOUPE_APP })}`;
    try {
      parseAdaptList(text, adaptList);
    } catch (error) {
      if (notice) throw new Error(`withLoupe: ${notice}`, { cause: error });
      throw error;
    }
    if (notice) console.error(`[loupe] ${notice}`);

    const rules = base.turbopack?.rules ?? {};
    if (LOADER_RULE in rules) {
      throw new Error(
        `withLoupe: turbopack.rules already has a "${LOADER_RULE}" rule, and Loupe will not merge into it.`,
      );
    }
    const loader = { loader: path.join(__dirname, "loader.cjs"), options: { root, adaptList } };
    return {
      ...base,
      env,
      turbopack: {
        ...base.turbopack,
        rules: {
          ...rules,
          [LOADER_RULE]: {
            // Design-system packages linked from the workspace are not foreign,
            // so their own call sites are anchored too.
            condition: { all: ["development", { not: "foreign" }] },
            loaders: [loader],
          },
        },
      },
      webpack(webpackConfig: any, context: any) {
        // The host's own hook first; its result is the config we extend.
        const hosted = base.webpack ? base.webpack(webpackConfig, context) : webpackConfig;
        const next = hosted ?? webpackConfig;
        next.module ??= {};
        next.module.rules ??= [];
        next.module.rules.push({
          test: /\.tsx$/,
          // "pre" so the loader reads the source before Next's own transforms, as
          // Turbopack runs it. Webpack resolves workspace symlinks to real paths,
          // so a linked design system is outside node_modules and is anchored too.
          enforce: "pre",
          exclude: /[\\/]node_modules[\\/]/,
          use: [loader],
        });
        return next;
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
