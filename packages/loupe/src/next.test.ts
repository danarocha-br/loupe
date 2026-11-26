import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { missingLayerAdvice } from "./format-notice.js";
import { writeAgainCommand } from "./layer-status.js";
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
  delete process.env.TURBOPACK;
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

  describe("under webpack (next dev --webpack)", () => {
    // `withLoupe` hands back the config it was given, plus the hook.
    type Hooked = { webpack?: (webpackConfig: unknown, context: unknown) => unknown };
    const hooked = async (base: object) =>
      (await withLoupe(base, options)(PHASE_DEVELOPMENT_SERVER)) as Hooked;
    const loaderRule = async (extra: object = {}) => {
      const result = await hooked({ ...config, ...extra });
      const webpackConfig = result.webpack?.({ module: { rules: [{ test: /\.svg$/ }] } }, { dev: true }) as {
        module: { rules: Array<Record<string, any>> };
      };
      return { result, rules: webpackConfig.module.rules, rule: webpackConfig.module.rules.at(-1)! };
    };

    it("adds the same loader as a pre-rule for .tsx outside node_modules", async () => {
      const { rules, rule } = await loaderRule();
      expect(rules).toHaveLength(2);
      expect(rule.enforce).toBe("pre");
      expect(rule.test.test("/repo/app/page.tsx")).toBe(true);
      expect(rule.test.test("/repo/app/page.ts")).toBe(false);
      // Webpack resolves a linked workspace package to its real path, so it is not excluded.
      expect(rule.exclude.test("/repo/fixture/design-system/components/ui/button.tsx")).toBe(false);
      expect(rule.exclude.test("/repo/node_modules/.pnpm/x@1/node_modules/x/index.tsx")).toBe(true);
      expect(rule.exclude.test("C:\\repo\\node_modules\\x\\index.tsx")).toBe(true);
      expect(rule.use).toHaveLength(1);
      expect(path.basename(rule.use[0].loader)).toBe("loader.cjs");
      expect(rule.use[0].options).toEqual({ root: dir, adaptList });
    });

    it("runs the host's own webpack hook first, and keeps the config it returns", async () => {
      const seen: unknown[] = [];
      const replaced = { module: { rules: [] as object[] }, name: "from-host" };
      const result = await hooked({
        webpack: (_: unknown, context: unknown) => {
          seen.push(context);
          return replaced;
        },
      });
      const out = result.webpack?.({ module: { rules: [] } }, { dev: true }) as typeof replaced;
      expect(seen).toEqual([{ dev: true }]);
      expect(out).toBe(replaced);
      expect(out.module.rules).toHaveLength(1);
    });

    it("copes with a config that has no module or rules yet", async () => {
      const result = await hooked(config);
      const out = result.webpack?.({}, { dev: true }) as { module: { rules: unknown[] } };
      expect(out.module.rules).toHaveLength(1);
    });

    it("adds nothing outside next dev", async () => {
      const untouched = await withLoupe(config, options)("phase-production-build");
      expect(untouched).not.toHaveProperty("webpack");
    });
  });

  it("calls a phase-function config with the phase", async () => {
    const result = await withLoupe(
      async (phase: string) => ({ phase, turbopack: {} as { rules?: object } }),
      options,
    )(PHASE_DEVELOPMENT_SERVER);
    expect(result.phase).toBe(PHASE_DEVELOPMENT_SERVER);
    expect(result.turbopack.rules).toHaveProperty("*.tsx");
  });

  it("stays out of next dev when LOUPE=0, and tells the mount the Toolbar is off", async () => {
    process.env.LOUPE = "0";
    const result = await withLoupe({ ...config, env: { HOST: "kept" } }, options)(PHASE_DEVELOPMENT_SERVER);
    // No loader for either bundler: the config as given, plus the flag the mount folds on.
    expect(result).toEqual({ ...config, env: { HOST: "kept", LOUPE_TOOLBAR: "off" } });
    expect(result).not.toHaveProperty("webpack");
    expect(result.turbopack.rules).not.toHaveProperty("*.tsx");
  });

  it("refuses to merge into an existing *.tsx rule under Turbopack", async () => {
    process.env.TURBOPACK = "auto";
    const taken = { turbopack: { rules: { "*.tsx": { loaders: ["other"] } } } };
    await expect(withLoupe(taken, options)(PHASE_DEVELOPMENT_SERVER)).rejects.toThrow(
      /already has a "\*\.tsx" rule/,
    );
  });

  it("leaves a host's *.tsx Turbopack rule alone under webpack, where nothing reads it", async () => {
    // Next leaves TURBOPACK unset for `next dev --webpack`.
    const taken = { turbopack: { rules: { "*.tsx": { loaders: ["other"] } } } };
    const result = await withLoupe(taken, options)(PHASE_DEVELOPMENT_SERVER);
    expect(result.turbopack.rules).toEqual({ "*.tsx": { loaders: ["other"] } });
    expect(result).toHaveProperty("webpack");
  });

  it("fails at startup on a broken adapt-list.json", async () => {
    const broken = path.join(dir, "broken.json");
    writeFileSync(broken, JSON.stringify({ formatVersion: 1, designSystem: "ds" }));
    await expect(
      withLoupe(config, { adaptList: broken, root: dir })(PHASE_DEVELOPMENT_SERVER),
    ).rejects.toThrow(/designSystem must be an array/);
  });

  it("fails at startup on a missing adapt-list.json, naming the command that writes it again (PER-231)", async () => {
    const missing = path.join(dir, "gone", "adapt-list.json");
    const failure = await withLoupe(config, { adaptList: missing, root: dir })(PHASE_DEVELOPMENT_SERVER).then(
      () => null,
      (error: unknown) => error as Error,
    );
    // This layer has no package.json, so the command asks for the specifier too.
    expect(failure?.message).toContain(`withLoupe: ${missing} is missing. Restore it with git. `);
    expect(failure?.message).toMatch(
      / exec loupe generate --out .+? --design-system <dir> --app <dir> --specifier <name>, replacing /,
    );
    // The command the Toolbar's card and `loupe doctor` name, in the dev server's terminal words.
    const command = writeAgainCommand({ root: dir, adaptList: missing, app: process.cwd() });
    expect(failure?.message).toBe(`withLoupe: ${missing} is missing. ${missingLayerAdvice(command)}`);
    expect((failure?.cause as NodeJS.ErrnoException | undefined)?.code).toBe("ENOENT");
  });

  it("throws any other failure to read adapt-list.json as it is", async () => {
    // A directory where the file should be.
    const failure = await withLoupe(config, { adaptList: dir, root: dir })(PHASE_DEVELOPMENT_SERVER).then(
      () => null,
      (error: unknown) => error as NodeJS.ErrnoException,
    );
    expect(failure?.code).toBe("EISDIR");
    expect(failure?.message).not.toMatch(/^withLoupe:/);
  });

  it("tells the mount the Toolbar is on, and hands its Server Action the paths it resolved", async () => {
    const result = (await withLoupe(config, options)(PHASE_DEVELOPMENT_SERVER)) as { env?: Record<string, string> };
    expect(result.env).toEqual({ LOUPE_TOOLBAR: "on", LOUPE_ROOT: dir, LOUPE_ADAPT_LIST: adaptList, LOUPE_APP: process.cwd() });
  });

  it("fails at startup when the loader can't read another formatVersion, naming the command (PER-85)", async () => {
    const other = path.join(dir, "other.json");
    writeFileSync(other, JSON.stringify({ formatVersion: 0, designSystem: ["ds"], app: ["app"], modules: {} }));
    await expect(withLoupe(config, { adaptList: other, root: dir })(PHASE_DEVELOPMENT_SERVER)).rejects.toThrow(
      /generated by an older Loupe \(formatVersion 0, and this Loupe reads 1\)\. Regenerate it from the repo root: pnpm -C .* exec loupe generate --out /,
    );
  });

  it("starts with the loader on a generate format it can still read, and logs the command (PER-85)", async () => {
    const older = path.join(dir, "older.json");
    // Stamped as generate's formatVersion 0 would: the hash covers the version.
    const body = `{\n  "app": [\n    "app"\n  ],\n  "designSystem": [\n    "ds"\n  ],\n  "formatVersion": 1,\n  "modules": {}\n}\n`;
    const hash = createHash("sha256").update(`0\n${body}`, "utf8").digest("hex");
    writeFileSync(
      older,
      `{\n  "$generated": "@generated by loupe generate, do not edit (formatVersion 0, sha256:${hash})",\n${body.slice(2)}`,
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await withLoupe(config, { adaptList: older, root: dir })(PHASE_DEVELOPMENT_SERVER);
      expect(result.turbopack.rules).toHaveProperty("*.tsx");
      expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringMatching(/^\[loupe\] The Product layer was generated by an older Loupe \(formatVersion 0, .* exec loupe generate/),
      ]);
    } finally {
      errors.mockRestore();
    }
  });
});
