import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The dev server's disk, answered by the test.
const layer = vi.hoisted(() => ({ read: (): unknown => null }));
vi.mock("../layer-status.js", () => ({ readLayerStatus: () => layer.read() }));

import { readProductLayerStatus } from "./layer-server.js";

const ENV = ["LOUPE_ROOT", "LOUPE_ADAPT_LIST", "LOUPE_APP"] as const;
const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));

beforeEach(() => {
  process.env.LOUPE_ROOT = "/repo";
  process.env.LOUPE_ADAPT_LIST = "/repo/packages/loupe/adapt-list.json";
  process.env.LOUPE_APP = "apps/web";
});

afterEach(() => {
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.restoreAllMocks();
});

describe("readProductLayerStatus", () => {
  it("answers null without warning when withLoupe isn't active", async () => {
    delete process.env.LOUPE_ROOT;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readProductLayerStatus()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("answers null and warns once while the same read keeps failing, as after a branch switch", async () => {
    layer.read = () => {
      throw new Error("ENOENT: no such file, open '/repo/packages/loupe/adapt-list.json'");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let focus = 0; focus < 3; focus += 1) expect(await readProductLayerStatus()).toBeNull();
    expect(warn.mock.calls).toEqual([
      ["[loupe] loupe-layer-status: ENOENT: no such file, open '/repo/packages/loupe/adapt-list.json'"],
    ]);
  });

  it("warns again for a different failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    layer.read = () => {
      throw new Error("a different failure");
    };
    await readProductLayerStatus();
    expect(warn.mock.calls).toEqual([["[loupe] loupe-layer-status: a different failure"]]);
  });
});
