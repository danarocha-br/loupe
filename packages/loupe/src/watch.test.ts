// The watch (`watch.ts`, `pnpm --filter @danarocha/loupe watch`): the build's steps in watch
// mode, their changed files moved into `dist` one rename at a time. These tests hold it to the
// build: each step, built once as the watch builds it, writes the bytes `dist` has, so they
// run after a build, as `src/build.test.ts` does. A `dist` the watch has written into fails
// them, as it fails `build.test.ts`: build again.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOptions, changes, isNodeSideModule, loadConfigs, SWAP_MARK, SWAPPED, syncInto, viteSteps, watched, withSwap } from "../watch.js";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(pkg, "dist");
const scratch = mkdtempSync(path.join(tmpdir(), "loupe-watch-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A folder of files, written from `files`. */
function folder(name: string, files: Record<string, string>): string {
  const dir = path.join(scratch, name);
  for (const [file, code] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), code);
  }
  return dir;
}

describe("syncInto", () => {
  it("moves only the files whose bytes changed, by a rename over the old file, and leaves nothing behind", () => {
    const from = folder("sync-from", { "same.js": "same", "changed.js": "new", "added/deep.js": "added", "skipped.d.ts": "types" });
    const to = folder("sync-to", { "same.js": "same", "changed.js": "old", "kept.js": "kept" });
    const before = { same: statSync(path.join(to, "same.js")).ino, changed: statSync(path.join(to, "changed.js")).ino };
    const moved = syncInto(from, to, { only: (file) => file.endsWith(".js") });
    expect(moved.sort()).toEqual(["added/deep.js", "changed.js"]);
    expect(readFileSync(path.join(to, "changed.js"), "utf8")).toBe("new");
    expect(readFileSync(path.join(to, "added/deep.js"), "utf8")).toBe("added");
    // A file left alone keeps its inode; a changed one is a new file renamed over it, never written in place.
    expect(statSync(path.join(to, "same.js")).ino).toBe(before.same);
    expect(statSync(path.join(to, "changed.js")).ino).not.toBe(before.changed);
    expect(existsSync(path.join(to, "skipped.d.ts"))).toBe(false);
    expect(readFileSync(path.join(to, "kept.js"), "utf8")).toBe("kept");
    expect(readdirSync(from, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".loupe-watch"))).toEqual([]);
    expect(syncInto(from, to, { only: (file) => file.endsWith(".js") })).toEqual([]);
  });

  it("compares what it would write, rewritten", () => {
    const from = folder("rewrite-from", { "a.js": "@loupe/ui" });
    const to = folder("rewrite-to", { "a.js": "../ui/index.js" });
    expect([...changes(from, to, { rewrite: (code) => code.replace("@loupe/ui", "../ui/index.js") }).keys()]).toEqual([]);
    expect([...changes(from, to).keys()]).toEqual(["a.js"]);
  });
});

describe("the stylesheet swap", () => {
  // The surface's module as the build writes it.
  const surface = () => readFileSync(path.join(dist, SWAPPED), "utf8");

  it("is added to the surface's module alone, after it, marked", () => {
    const swapped = withSwap(surface());
    expect(swapped.startsWith(surface())).toBe(true);
    expect(swapped.slice(surface().length)).toContain(SWAP_MARK);
    expect(swapped.slice(surface().length)).toContain("adoptStylesheet as loupeWatchAdopt");
    const step = watched({ name: "browser side", into: "", config: {} });
    expect(step.rewrite?.(surface(), SWAPPED)).toBe(swapped);
    expect(step.rewrite?.(surface(), "toolbar/index.js")).toBe(surface());
  });

  it("fails, rather than swap nothing, when the surface no longer imports what it uses", () => {
    const without = surface().replace(/\bHOST_ATTRIBUTE\b/g, "OTHER_ATTRIBUTE");
    expect(() => withSwap(without)).toThrow(/HOST_ATTRIBUTE/);
  });
});

describe("the watch's output", () => {
  let nodeEnv: string | undefined;
  beforeAll(() => {
    if (!existsSync(path.join(dist, "toolbar", "index.js"))) {
      throw new Error("No dist/toolbar/index.js: run `pnpm --filter @danarocha/loupe build` first.");
    }
    // As the watch builds, and as `vite build` does.
    nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
  });
  afterAll(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it("is the build's: each Vite step, built as the watch builds it, writes the bytes dist has", async () => {
    const steps = viteSteps(await loadConfigs());
    expect(steps.map((step) => step.name)).toEqual(["@loupe/ui", "@loupe/patterns", "browser side"]);
    for (const step of steps) {
      const out = path.join(scratch, `vite-${step.into || "browser"}`);
      await build({ ...buildOptions(step.config, out, false), logLevel: "silent" });
      expect([...changes(out, path.join(dist, step.into), step).keys()], `${step.name}'s files that differ from dist's`).toEqual([]);
    }
  });

  it("is the build's on the Node side: tsc6, built as the watch builds it, writes the modules dist has", () => {
    const out = path.join(scratch, "tsc");
    const tsc = spawnSync(path.join(pkg, "node_modules", ".bin", "tsc6"), ["-p", "tsconfig.build.json", "--outDir", out], { cwd: pkg, encoding: "utf8" });
    expect(tsc.status, tsc.stdout).toBe(0);
    expect([...changes(out, dist, { only: isNodeSideModule }).keys()]).toEqual([]);
  });
});
