// The workbenches' dev server (ADR 0011, 0012): `@loupe/ui`'s and `@loupe/patterns`' both
// take their config from here, `@loupe/ui/workbench/vite`, with their own React Compiler,
// stylesheet module and port. Never built, never shipped: `dist` is the packages' own
// `vite.config.ts`, which has neither of the two things added here.
//
// An edit keeps the page as it was, an open Fold, a Popover or a focused chip included:
// - a component's `.tsx` takes React Refresh (`@vitejs/plugin-react`): the components it
//   exports render again with their state;
// - a `.css` the stylesheet is made of reaches no module at all. The stylesheet is one
//   string assembled from every `.css` (`stylesheet()`), so the server builds it again
//   and sends it (`STYLESHEET_EVENT`), and the shell hands it to the surfaces, which swap
//   their adopted sheet in place (`adoptStylesheet`). Nothing renders but the shell.
// Anything else (a token, a state's file) reloads the page, as before.

import react from "@vitejs/plugin-react";
import { isRunnableDevEnvironment, type Plugin, type PluginOption, type UserConfig } from "vite";
import { STYLESHEET_EVENT, STYLESHEET_EXPORT } from "./shell/hot.js";

export type WorkbenchConfig = {
  /** The workbench's folder, where its `index.html` is. */
  root: string;
  /** The package's own React Compiler, as its build runs it (`reactCompiler()`). */
  compiler: PluginOption;
  /** The workbench's stylesheet module, which exports `WORKBENCH_STYLESHEET`. */
  stylesheet: string;
  port: number;
};

/** A workbench's dev server: the build's React Compiler and JSX, React Refresh, and the stylesheet swapped in place. */
export function workbenchConfig({ root, compiler, stylesheet, port }: WorkbenchConfig): UserConfig {
  return {
    root,
    plugins: [react(), compiler, swapStylesheet(stylesheet)],
    oxc: { include: /\.[cm]?tsx?$/, jsx: { runtime: "automatic" } },
    server: { port },
  };
}

/**
 * Sends the stylesheet again when a `.css` it is made of changes, in place of the update
 * Vite would make: the `.css` modules reach the page only through modules no update can
 * stop at (`styles.ts`, the surface), so Vite would reload it. The server's own module
 * runner builds the stylesheet, from the same sources and plugins as the page's.
 */
export function swapStylesheet(file: string): Plugin {
  let build: (() => Promise<string>) | null = null;
  return {
    name: "loupe:workbench-stylesheet",
    apply: "serve",
    configureServer(server) {
      const runner = server.environments.ssr;
      if (!isRunnableDevEnvironment(runner)) return;
      build = async () => {
        runner.runner.clearCache();
        const module = (await runner.runner.import(file)) as Record<string, unknown>;
        return String(module[STYLESHEET_EXPORT]);
      };
      // Built once as the server starts, so its graph knows which `.css` files the stylesheet is made of.
      build().catch((error: unknown) => server.config.logger.warn(`[workbench] the stylesheet won't swap in place: ${String(error)}`));
    },
    async hotUpdate({ file: changed, server }) {
      if (!build || !changed.endsWith(".css")) return;
      // A `.css` of the page's own (the shell's `workbench.css`) isn't in the stylesheet: Vite's update.
      if (!server.environments.ssr.moduleGraph.getModulesByFile(changed)?.size) return;
      // The server's runner builds the stylesheet afresh below: its own reload would only say so.
      if (this.environment.name !== "client") return [];
      try {
        this.environment.hot.send({ type: "custom", event: STYLESHEET_EVENT, data: await build() });
        return [];
      } catch (error) {
        server.config.logger.warn(`[workbench] couldn't build the stylesheet again, reloading: ${String(error)}`);
        return;
      }
    },
  };
}
