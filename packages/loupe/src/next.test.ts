import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PHASE_DEVELOPMENT_SERVER, withLoupe } from "./next.cjs";

const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-next-")));
const adaptList = path.join(dir, "adapt-list.json");
writeFileSync(
  adaptList,
  JSON.stringify({ formatVersion: 1, designSystem: ["ds"], app: ["app"], modules: {} }),
);
const options = { adaptList, root: dir };
const config = { agentRules: false, turbopack: { rules: { "*.svg": { loaders: ["svgr"] } } } };

afterEach(() => {
  delete process.env.LOUPE;
});

describe("withLoupe", () => {
  it.each(["phase-production-build", "phase-production-server", "phase-export", "phase-test"])(
    "returns the config untouched in %s",
    async (phase) => {
      expect(await withLoupe(config, options)(phase)).toBe(config);
    },
  );

  it("adds the dev-only loader rule under next dev", async () => {
    const result = await withLoupe(config, options)(PHASE_DEVELOPMENT_SERVER);
    const rules = result.turbopack.rules as Record<string, any>;
    expect(rules["*.svg"]).toEqual({ loaders: ["svgr"] });
    expect(rules["*.tsx"].condition).toEqual({ all: ["development", { not: "foreign" }] });
    expect(rules["*.tsx"].loaders).toHaveLength(1);
    expect(path.basename(rules["*.tsx"].loaders[0].loader)).toBe("loader.cjs");
    expect(rules["*.tsx"].loaders[0].options).toEqual({ root: dir, adaptList });
    expect(config.turbopack.rules).not.toHaveProperty("*.tsx");
  });

  it("calls a phase-function config with the phase", async () => {
    const result = await withLoupe(
      async (phase: string) => ({ phase, turbopack: {} as { rules?: object } }),
      options,
    )(PHASE_DEVELOPMENT_SERVER);
    expect(result.phase).toBe(PHASE_DEVELOPMENT_SERVER);
    expect(result.turbopack.rules).toHaveProperty("*.tsx");
  });

  it("stays out of next dev when LOUPE=0", async () => {
    process.env.LOUPE = "0";
    expect(await withLoupe(config, options)(PHASE_DEVELOPMENT_SERVER)).toBe(config);
  });

  it("refuses to merge into an existing *.tsx rule", async () => {
    const taken = { turbopack: { rules: { "*.tsx": { loaders: ["other"] } } } };
    await expect(withLoupe(taken, options)(PHASE_DEVELOPMENT_SERVER)).rejects.toThrow(
      /already has a "\*\.tsx" rule/,
    );
  });

  it("fails at startup on a broken adapt-list.json", async () => {
    const broken = path.join(dir, "broken.json");
    writeFileSync(broken, JSON.stringify({ formatVersion: 2 }));
    await expect(
      withLoupe(config, { adaptList: broken, root: dir })(PHASE_DEVELOPMENT_SERVER),
    ).rejects.toThrow(/formatVersion is 2/);
  });
});
