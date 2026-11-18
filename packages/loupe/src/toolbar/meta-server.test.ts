import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The lookup over the Product layer's meta/, answered by the test.
const lookup = vi.hoisted(() => ({ run: (_requests: unknown): unknown => [] }));
vi.mock("../instance-meta.js", () => ({ createMetaLookup: () => (requests: unknown) => lookup.run(requests) }));

import { readInstanceMeta } from "./meta-server.js";

const ENV = ["LOUPE_ROOT", "LOUPE_ADAPT_LIST"] as const;
const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
const REQUEST = { path: "app/members.tsx", component: "Card" };

beforeEach(() => {
  process.env.LOUPE_ROOT = "/repo";
  process.env.LOUPE_ADAPT_LIST = "/repo/packages/loupe/adapt-list.json";
});

afterEach(() => {
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.restoreAllMocks();
});

describe("readInstanceMeta", () => {
  it("answers null without warning when withLoupe isn't active", async () => {
    delete process.env.LOUPE_ROOT;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readInstanceMeta([REQUEST])).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("answers null and warns once while the same lookup keeps failing", async () => {
    lookup.run = () => {
      throw new Error("meta/ went away");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let selection = 0; selection < 3; selection += 1) expect(await readInstanceMeta([REQUEST])).toBeNull();
    expect(warn.mock.calls).toEqual([["[loupe] loupe-instance-meta: meta/ went away"]]);
  });
});
