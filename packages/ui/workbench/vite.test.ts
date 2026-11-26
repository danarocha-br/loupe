// The workbenches' dev server (`vite.ts`): React Refresh and the stylesheet's swap in place
// are the workbench's alone, never the build's, and the stylesheet it sends again is the one
// the page draws.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PluginOption, UserConfig } from "vite";
import build, { reactCompiler } from "../vite.config.js";
import * as stylesheet from "./stylesheet.js";
import { workbenchConfig } from "./vite.js";

/** Every plugin's name in a config, its arrays flattened. */
const names = (config: UserConfig) =>
  (config.plugins ?? [])
    .flat(Infinity as 1)
    .filter((plugin): plugin is Exclude<PluginOption, unknown[]> & { name: string } => typeof plugin === "object" && plugin !== null && "name" in plugin)
    .map((plugin) => plugin.name);

describe("the workbench's dev server", () => {
  const compiler = reactCompiler();
  const config = workbenchConfig({ root: "/workbench", compiler, port: 3200 });

  it("adds React Refresh and the stylesheet's swap to the build's React Compiler and JSX", () => {
    expect(names(config)).toEqual(expect.arrayContaining(["vite:react-refresh", "loupe:workbench-stylesheet"]));
    expect(config.plugins).toContain(compiler);
    expect(config.oxc).toEqual(build.oxc);
    expect(config.server?.port).toBe(3200);
  });

  it("never reaches the build: dist is drawn without React Refresh", () => {
    expect(names(build).filter((name) => name.startsWith("vite:react") || name.startsWith("loupe:workbench"))).toEqual([]);
  });

  it("swaps in the stylesheet this workbench's surfaces adopt, from the stylesheet.ts beside its page", () => {
    // `swapStylesheet` reads `WORKBENCH_STYLESHEET` from `<root>/stylesheet.ts`: the module the page draws with.
    expect(typeof stylesheet.WORKBENCH_STYLESHEET).toBe("string");
    expect(existsSync(fileURLToPath(new URL("./stylesheet.ts", import.meta.url)))).toBe(true);
  });
});
