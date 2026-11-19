import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The dev server's disk, answered by the test.
const layer = vi.hoisted(() => ({ read: (): unknown => null }));
vi.mock("../layer-status.js", () => ({ readLayerStatus: () => layer.read() }));

import { missingLayerAdvice } from "../format-notice.js";
import type { LayerStatus } from "../layer-status.js";
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

  // A missing file is a status of its own (below); this is a read that fails for any other reason.
  it("answers null and warns once while the same read keeps failing, and again for another failure", async () => {
    const fail = (message: string) => {
      layer.read = () => {
        throw new Error(message);
      };
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fail("EACCES: permission denied, open '/repo/packages/loupe/adapt-list.json'");
    for (let focus = 0; focus < 3; focus += 1) expect(await readProductLayerStatus()).toBeNull();
    expect(warn.mock.calls).toEqual([
      ["[loupe] loupe-layer-status: EACCES: permission denied, open '/repo/packages/loupe/adapt-list.json'"],
    ]);

    fail("a different failure");
    await readProductLayerStatus();
    await readProductLayerStatus();
    expect(warn.mock.calls.at(-1)).toEqual(["[loupe] loupe-layer-status: a different failure"]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  // PER-227: a Product layer that went missing is a status the Toolbar shows, not a failure.
  const status = (missing: boolean): LayerStatus => ({
    command: missing ? "pnpm -C apps/web exec loupe generate --design-system <dir> --app <dir>" : "pnpm -C apps/web exec loupe generate",
    missing,
    format: null,
    stale: [],
    notGenerated: missing ? null : [],
  });

  it("answers a missing Product layer as a status, and says so once in the terminal however often it is asked", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    layer.read = () => status(false);
    expect(await readProductLayerStatus()).toEqual(status(false));
    expect(warn).not.toHaveBeenCalled();

    // A branch switch removes the file; every focus asks again.
    layer.read = () => status(true);
    for (let focus = 0; focus < 3; focus += 1) expect(await readProductLayerStatus()).toEqual(status(true));
    // The terminal and the Toolbar's card say the same advice (`missingLayerAdvice`, tested on its own).
    expect(warn.mock.calls).toEqual([
      [`[loupe] loupe-layer-status: /repo/packages/loupe/adapt-list.json is missing. ${missingLayerAdvice(status(true).command)}`],
    ]);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Restore it with git");

    // Back after `generate`: the status is normal again, with nothing more said.
    layer.read = () => status(false);
    expect(await readProductLayerStatus()).toEqual(status(false));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
