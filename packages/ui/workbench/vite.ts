// The workbenches' dev server (ADR 0011, 0012): `@loupe/ui`'s and `@loupe/patterns`' both
// take their config from here, `@loupe/ui/workbench/vite`, with their own React Compiler
// and port, and the `stylesheet.ts` beside their `index.html`. Never built, never shipped: `dist` is the packages' own
// `vite.config.ts`, which has neither of the two things added here.
//
// An edit keeps the page as it was, an open Fold, a Popover or a focused chip included:
// - a component's `.tsx` takes React Refresh (`@vitejs/plugin-react`): the components it
//   exports render again with their state. A module that exports a function or a hook
//   beside its components (Button's `lookAttributes`, the Announcer's hooks) isn't one
//   React Refresh can update, and reloads the page;
// - a `.css` the stylesheet is made of reaches no module at all. The stylesheet is one
//   string assembled from every `.css` (`stylesheet()`), so the server builds it again
//   and sends it (`STYLESHEET_EVENT`), and the shell hands it to the surfaces, which swap
//   their adopted sheet in place (`adoptStylesheet`). Nothing renders but the shell.
// - a package's states, or the patterns' sample data, draw again in place (`main.tsx`).
// Anything else (a token, the shell's own page CSS) reloads the page, as before.

import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { isRunnableDevEnvironment, type Plugin, type PluginOption, type UserConfig } from "vite";
import { STYLESHEET_EVENT } from "./shell/hot.js";

export type WorkbenchConfig = {
  /** The workbench's folder: its `index.html`, and its `stylesheet.ts`, which exports `WORKBENCH_STYLESHEET`. */
  root: string;
  /** The package's own React Compiler, as its build runs it (`reactCompiler()`). */
  compiler: PluginOption;
  port: number;
};

/** A workbench's dev server: the build's React Compiler and JSX, React Refresh, and the stylesheet swapped in place. */
export function workbenchConfig({ root, compiler, port }: WorkbenchConfig): UserConfig {
  return {
    root,
    plugins: [react(), compiler, swapStylesheet(join(root, "stylesheet.ts"))],
    oxc: { include: /\.[cm]?tsx?$/, jsx: { runtime: "automatic" } },
    server: { port },
  };
}

/** What every workbench's `stylesheet.ts` exports. */
type StylesheetModule = { WORKBENCH_STYLESHEET: string };

/**
 * Sends the stylesheet again when a `.css` it is made of changes, in place of the update
 * Vite would make: the `.css` modules reach the page only through modules no update can
 * stop at (`styles.ts`, the surface), so Vite would reload it. The server's own module
 * runner builds the stylesheet, from the same sources and plugins as the page's.
 *
 * Whether a `.css` is part of the stylesheet is read from the stylesheet itself: one that
 * leaves it as it was (the shell's `workbench.css`, which the patterns' stylesheet module
 * loads through the shell without using) gets Vite's own update. Saves close together build
 * in turn, and only the latest build is sent, so an older one never lands after a newer.
 */
export function swapStylesheet(file: string): Plugin {
  let build: (() => Promise<string>) | null = null;
  let sent: string | null = null;
  let latest = 0;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    name: "loupe:workbench-stylesheet",
    apply: "serve",
    configureServer(server) {
      const runner = server.environments.ssr;
      if (!isRunnableDevEnvironment(runner)) return;
      // One build at a time: each starts once the one before has finished.
      build = () => {
        const next = queue.then(async () => {
          runner.runner.clearCache();
          return ((await runner.runner.import(file)) as StylesheetModule).WORKBENCH_STYLESHEET;
        });
        queue = next.catch(() => {});
        return next;
      };
      // Built once as the server starts: what the page draws, and the graph of the `.css` files it is made of.
      build().then(
        (css) => {
          sent = css;
        },
        (error: unknown) => server.config.logger.warn(`[workbench] the stylesheet won't swap in place: ${String(error)}`),
      );
    },
    async hotUpdate({ file: changed, server }) {
      if (!build || !changed.endsWith(".css")) return;
      // Not loaded by the stylesheet's module at all: Vite's update.
      if (!server.environments.ssr.moduleGraph.getModulesByFile(changed)?.size) return;
      // The server's runner builds the stylesheet afresh below: its own reload would only say so.
      if (this.environment.name !== "client") return [];
      const save = ++latest;
      try {
        const css = await build();
        // Loaded with the stylesheet, but not part of it: Vite's update, a reload.
        if (css === sent) return;
        // A later save is building already: it sends its own.
        if (save !== latest) return [];
        sent = css;
        this.environment.hot.send({ type: "custom", event: STYLESHEET_EVENT, data: css });
        return [];
      } catch (error) {
        server.config.logger.warn(`[workbench] couldn't build the stylesheet again, reloading: ${String(error)}`);
        return;
      }
    },
  };
}
