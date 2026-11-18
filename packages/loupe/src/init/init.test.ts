import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  biome,
  bump,
  cli,
  commit,
  committedRepo,
  git,
  installable,
  installedRepo,
  LEDGER,
  type LedgerJson,
  link,
  makeRepo,
  nextConfig,
  snapshot,
} from "../compat/repo.fixture.js";
import { EXIT_MANUAL } from "./command.js";
import { sha256 } from "./syntax.js";

const init = (root: string, ...argv: string[]) => cli(root, ["init", ...argv]);

/** `loupe init` as the given installed Loupe version would run it. */
const initAt = (root: string, version: string, ...argv: string[]) => cli(root, ["init", ...argv], { version });

/** `loupe doctor` as the given installed Loupe version would run it. */
const doctorAt = (root: string, version: string) => cli(root, ["doctor"], { version });

const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");
const ledger = (root: string) => JSON.parse(read(root, LEDGER)) as LedgerJson;

describe("loupe init on a clean repo", () => {
  it("makes the four edits, records each in a sorted ledger and leaves the lockfile alone", async () => {
    const root = committedRepo();
    const { code, text } = await init(root);
    expect(text).toContain("Result: works here.");
    expect(text).toContain(`Recorded in ${LEDGER}.`);
    expect(code).toBe(0);

    expect(JSON.parse(read(root, "apps/web/package.json")).devDependencies).toEqual({
      "@danarocha/loupe": expect.stringMatching(/^\d+\.\d+\.\d+/),
      "@repo/loupe": "workspace:*",
      typescript: "^5.9.3",
    });
    expect(read(root, "apps/web/next.config.ts")).toContain("export default withLoupe(nextConfig);");
    expect(read(root, "apps/web/app/layout.tsx")).toContain(
      '        {children}\n        {process.env.NODE_ENV === "development" && <LoupeMount />}\n      </body>',
    );
    expect(read(root, "biome.jsonc")).toContain('// Generated.\n      "!dist",\n      // Loupe');
    expect(read(root, "pnpm-lock.yaml")).toBe("lockfileVersion: '9.0'\n");
    expect(read(root, "packages/loupe/adapt-list.json")).toContain('"formatVersion": 1');

    const l = ledger(root);
    expect(l.touchPoints.map((t) => [t.id, t.mode])).toEqual([
      ["biome-config", "auto"],
      ["next-config", "auto"],
      ["package-json", "auto"],
      ["root-layout", "auto"],
    ]);
    for (const t of l.touchPoints) expect(t.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(l.files.map((f) => f.path)).toEqual(["mount.tsx", "next.d.ts", "next.js", "package.json"]);
    expect(l.productLayer).toEqual({ app: "apps/web", name: "@repo/loupe", path: "packages/loupe" });
    expect(read(root, LEDGER)).toBe(`${JSON.stringify(JSON.parse(read(root, LEDGER)), null, 2)}\n`);
    expect(Object.keys(JSON.parse(read(root, LEDGER)))).toEqual(["files", "formatVersion", "loupe", "productLayer", "touchPoints"]);
    expect(text).toContain("Next: run pnpm install");

    // A rerun writes nothing at all, the ledger included.
    commit(root);
    const before = snapshot(root);
    const ledgerBytes = read(root, LEDGER);
    const again = await init(root);
    expect(again.code).toBe(0);
    expect(again.text).toContain("Nothing to do");
    expect(snapshot(root)).toEqual(before);
    expect(read(root, LEDGER)).toBe(ledgerBytes);
    expect(git(root, "status", "--porcelain")).toBe("");
  });

  it("reapplies a touch point that went missing and leaves a changed one alone", async () => {
    const root = committedRepo();
    await init(root);
    writeFileSync(path.join(root, "biome.jsonc"), biome);
    const layoutFile = path.join(root, "apps/web/app/layout.tsx");
    const edited = read(root, "apps/web/app/layout.tsx").replace("<LoupeMount />", "<LoupeMount debug />");
    writeFileSync(layoutFile, edited);
    commit(root);

    const { code, text } = await init(root);
    expect(code).toBe(1);
    expect(text).toMatch(/biome-config +biome\.jsonc: reapplied/);
    expect(text).toMatch(/root-layout +apps\/web\/app\/layout\.tsx: changed since loupe init recorded it; left as is/);
    expect(read(root, "apps/web/app/layout.tsx")).toBe(edited);
  });
});

describe("the dirty-tree rule", () => {
  it("refuses an uncommitted touch point and writes nothing; --allow-dirty proceeds", async () => {
    const root = committedRepo();
    writeFileSync(path.join(root, "apps/web/next.config.ts"), `${nextConfig}// wip\n`);
    const before = snapshot(root);
    const refused = await init(root);
    expect(refused.code).toBe(1);
    expect(refused.text).toContain("apps/web/next.config.ts");
    expect(refused.text).toContain("Nothing was written.");
    expect(snapshot(root)).toEqual(before);

    const allowed = await init(root, "--allow-dirty");
    expect(allowed.code).toBe(0);
    expect(read(root, "apps/web/next.config.ts")).toContain("withLoupe(nextConfig)");
    expect(read(root, "apps/web/next.config.ts")).toContain("// wip");
  });

  it("lists a file --allow-dirty lets through once, though a first install asks the guard twice", async () => {
    const root = committedRepo();
    writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n# wip\n");
    const { code, text } = await init(root, "--allow-dirty");
    expect(code).toBe(0);
    expect(text.match(/Proceeding with uncommitted changes/g)).toHaveLength(1);
    expect(text.match(/^ {2}pnpm-lock\.yaml$/gm)).toHaveLength(1);
  });

  it("only warns about other files, and refuses outside git even with --allow-dirty", async () => {
    const root = committedRepo();
    writeFileSync(path.join(root, "notes.md"), "x\n");
    const { code, text } = await init(root);
    expect(code).toBe(0);
    // Once, though a first install asks the guard twice.
    expect(text.match(/1 other file\(s\) have uncommitted changes/g)).toHaveLength(1);

    const bare = makeRepo({}, installable);
    const before = snapshot(bare);
    const outside = await init(bare, "--allow-dirty");
    expect(outside.code).toBe(1);
    expect(outside.text).toContain("isn't inside a git repository");
    expect(snapshot(bare)).toEqual(before);
  });
});

describe("a touch point with an unexpected shape", () => {
  it("is recorded manual with the snippet printed, then adopted with --adopt", async () => {
    const fnConfig = 'import type { NextConfig } from "next";\n\nexport default (phase: string): NextConfig => ({});\n';
    const root = committedRepo({ "apps/web/next.config.ts": fnConfig });
    const first = await init(root);
    expect(first.code).toBe(EXIT_MANUAL);
    expect(first.text).toContain("manual step needed: apps/web/next.config.ts exports a function");
    expect(first.text).toContain('import { withLoupe } from "@repo/loupe/next";');
    expect(read(root, "apps/web/next.config.ts")).toBe(fnConfig);
    expect(ledger(root).touchPoints.find((t) => t.id === "next-config")).toEqual({
      id: "next-config",
      file: "apps/web/next.config.ts",
      mode: "manual",
      sha256: null,
    });

    // The snippet, applied by hand, with init's own writes still uncommitted.
    writeFileSync(
      path.join(root, "apps/web/next.config.ts"),
      'import { withLoupe } from "@repo/loupe/next";\nimport type { NextConfig } from "next";\n\nexport default withLoupe((phase: string): NextConfig => ({}));\n',
    );
    const dirty = await init(root);
    expect(dirty.code).toBe(1);
    expect(dirty.text).toContain("record it with loupe init --adopt");

    const before = snapshot(root);
    const adopted = await init(root, "--adopt");
    expect(adopted.code).toBe(0);
    const after = snapshot(root);
    // Only the ledger and generate's output move: its meta hashes the edited next.config.ts.
    for (const file of Object.keys({ ...before, ...after })) {
      if (file !== LEDGER && !file.startsWith("packages/loupe/meta/")) expect(after[file]).toBe(before[file]);
    }
    expect(adopted.text).toMatch(/next-config +apps\/web\/next\.config\.ts: adopted \(manual\)/);
    const entry = ledger(root).touchPoints.find((t) => t.id === "next-config");
    expect(entry?.mode).toBe("manual");
    expect(entry?.sha256).toMatch(/^[0-9a-f]{64}$/);

    commit(root);
    const settled = snapshot(root);
    const rerun = await init(root);
    expect(rerun.code).toBe(0);
    expect(rerun.text).toContain("Nothing to do");
    expect(snapshot(root)).toEqual(settled);
  });
});

describe("the ledger", () => {
  it("refuses a ledger from a newer format", async () => {
    const root = committedRepo({ [LEDGER]: { formatVersion: 2 } });
    const before = snapshot(root);
    const newer = await init(root);
    expect(newer.code).toBe(1);
    expect(newer.text).toContain("formatVersion 2");
    expect(snapshot(root)).toEqual(before);
  });

  it("keeps a yes the check records during the same run", async () => {
    const root = committedRepo({ "apps/web/.babelrc": "{}\n" });
    const { code, text } = await cli(root, ["init"], { answers: ["yes"] });
    expect(text).toContain("Recorded your yes");
    expect(code).toBe(0);
    const l = JSON.parse(read(root, LEDGER));
    expect(l.untestedAccepted).toEqual([expect.objectContaining({ app: "apps/web", item: "bundler", seen: ".babelrc" })]);
    expect(l.touchPoints).toHaveLength(4);
  });

  it("keeps the compatibility check's field", async () => {
    const accepted = [{ app: "apps/web", item: "bundler", seen: ".babelrc", acceptedAt: "2026-11-11T00:00:00.000Z" }];
    const root = committedRepo({ [LEDGER]: { formatVersion: 1, untestedAccepted: accepted } });
    await init(root);
    expect(JSON.parse(read(root, LEDGER)).untestedAccepted).toEqual(accepted);
  });
});

describe("upgrading by rerunning loupe init", () => {
  const PKG = "apps/web/package.json";
  const LAYOUT = "apps/web/app/layout.tsx";
  const packageJsonHash = (root: string) => ledger(root).touchPoints.find((t) => t.id === "package-json")?.sha256;
  const peer = (root: string) => JSON.parse(read(root, "packages/loupe/package.json")).peerDependencies["@danarocha/loupe"];

  /** An install as Loupe 0.0.4 left it, committed: its package-json hash carries the version. */
  const installedAt004 = async () => (await installedRepo({ at: "0.0.4", oldHash: true })).root;

  it("moves an install to the newer version and re-records the old-format hash", async () => {
    const root = await installedAt004();
    bump(root, "0.0.5");
    commit(root);

    const { code, text } = await initAt(root, "0.0.5");
    expect(text).toMatch(/package-json +apps\/web\/package\.json: recorded again, without Loupe's version in its hash/);
    expect(text).toContain("Upgraded from Loupe 0.0.4 to 0.0.5.");
    expect(code).toBe(0);
    expect(ledger(root).loupe).toEqual({ package: "@danarocha/loupe", version: "0.0.5" });
    expect(packageJsonHash(root)).toBe(sha256(JSON.stringify([["@danarocha/loupe"], ["@repo/loupe", "workspace:*"]])));
    expect(peer(root)).toBe("0.0.5");

    commit(root);
    const settled = snapshot(root);
    const again = await initAt(root, "0.0.5");
    expect(again.text).toContain("Nothing to do");
    expect(again.code).toBe(0);
    expect(snapshot(root)).toEqual(settled);
  });

  it("keeps the old version while a hand-edited file blocks it, and a rerun finishes the upgrade", async () => {
    const root = await installedAt004();
    const original = read(root, LAYOUT);
    writeFileSync(path.join(root, LAYOUT), original.replace("<LoupeMount />", "<LoupeMount debug />"));
    bump(root, "0.0.5");
    commit(root);

    const blocked = await initAt(root, "0.0.5");
    expect(blocked.code).toBe(1);
    expect(blocked.text).toMatch(/root-layout +apps\/web\/app\/layout\.tsx: changed since loupe init recorded it; left as is/);
    expect(blocked.text).toContain(`${LEDGER} stays at Loupe 0.0.4 until they are resolved.`);
    expect(ledger(root).loupe).toEqual({ package: "@danarocha/loupe", version: "0.0.4" });
    // The other items were reconciled, each recorded before it was written.
    expect(peer(root)).toBe("0.0.5");
    expect(packageJsonHash(root)).toBe(sha256(JSON.stringify([["@danarocha/loupe"], ["@repo/loupe", "workspace:*"]])));

    writeFileSync(path.join(root, LAYOUT), original);
    commit(root);
    const rerun = await initAt(root, "0.0.5");
    expect(rerun.text).toContain("Upgraded from Loupe 0.0.4 to 0.0.5.");
    expect(rerun.code).toBe(0);
    expect(ledger(root).loupe).toEqual({ package: "@danarocha/loupe", version: "0.0.5" });
  });

  it("refuses a newer Loupe while the app still pins the old one, as pnpm dlx would run it", async () => {
    const root = await installedAt004();
    const before = snapshot(root);
    const { code, text } = await initAt(root, "0.0.5");
    expect(code).toBe(1);
    expect(text).toContain("apps/web/package.json has @danarocha/loupe 0.0.4, and this is Loupe 0.0.5.");
    expect(text).toContain("To upgrade, set it to 0.0.5, run pnpm install, commit, then rerun loupe init.");
    expect(snapshot(root)).toEqual(before);
  });

  it("keeps the old version while a manual step waits, even after --adopt, until a rerun", async () => {
    const root = await installedAt004();
    const fnConfig = 'import type { NextConfig } from "next";\n\nexport default (phase: string): NextConfig => ({});\n';
    writeFileSync(path.join(root, "apps/web/next.config.ts"), fnConfig);
    bump(root, "0.0.5");
    commit(root);

    const first = await initAt(root, "0.0.5");
    expect(first.code).toBe(EXIT_MANUAL);
    expect(first.text).toContain(`${LEDGER} stays at Loupe 0.0.4 until the manual steps are recorded.`);
    expect(ledger(root).loupe?.version).toBe("0.0.4");

    writeFileSync(
      path.join(root, "apps/web/next.config.ts"),
      'import { withLoupe } from "@repo/loupe/next";\nimport type { NextConfig } from "next";\n\nexport default withLoupe((phase: string): NextConfig => ({}));\n',
    );
    const adopted = await initAt(root, "0.0.5", "--adopt");
    expect(adopted.code).toBe(0);
    expect(adopted.text).toContain("Rerun loupe init to finish upgrading to 0.0.5.");
    expect(ledger(root).loupe?.version).toBe("0.0.4");

    commit(root);
    const rerun = await initAt(root, "0.0.5");
    expect(rerun.text).toContain("Upgraded from Loupe 0.0.4 to 0.0.5.");
    expect(rerun.code).toBe(0);
    expect(ledger(root).loupe?.version).toBe("0.0.5");
  });

  it("refuses a downgrade and writes nothing", async () => {
    const root = await installedAt004();
    const before = snapshot(root);
    const { code, text } = await initAt(root, "0.0.3");
    expect(code).toBe(1);
    expect(text).toContain(`${LEDGER} was written by Loupe 0.0.4; this is 0.0.3.`);
    expect(text).toContain("Install @danarocha/loupe@0.0.4");
    expect(snapshot(root)).toEqual(before);
  });

  it("asks for pnpm install when it rewrites the layer's peer, and says nothing on a rerun with nothing to do", async () => {
    const root = await installedAt004();
    bump(root, "0.0.5");
    commit(root);

    const { code, text } = await initAt(root, "0.0.5");
    expect(code).toBe(0);
    expect(peer(root)).toBe("0.0.5");
    // The app's package.json is untouched during an upgrade: this is the layer's own, rewritten.
    expect(text).not.toMatch(/package-json +apps\/web\/package\.json: \+/);
    expect(text).toContain(
      "Next: run pnpm install so @repo/loupe resolves Loupe 0.0.5, then commit pnpm-lock.yaml. Loupe never writes the lockfile.",
    );

    commit(root);
    const again = await initAt(root, "0.0.5");
    expect(again.text).toContain("Nothing to do");
    expect(again.text).not.toContain("Next:");
  });

  it("still asks once a rerun finishes an upgrade that a hand-edited file blocked", async () => {
    const root = await installedAt004();
    const original = read(root, LAYOUT);
    writeFileSync(path.join(root, LAYOUT), original.replace("<LoupeMount />", "<LoupeMount debug />"));
    bump(root, "0.0.5");
    commit(root);

    // The blocked run rewrites the layer's package.json but is not an upgrade yet: it asks for the fix, not the install.
    const blocked = await initAt(root, "0.0.5");
    expect(blocked.code).toBe(1);
    expect(peer(root)).toBe("0.0.5");
    expect(blocked.text).not.toContain("Next: run pnpm install");

    // The rerun rewrites nothing in the layer, yet the layer still resolves the old copy.
    writeFileSync(path.join(root, LAYOUT), original);
    commit(root);
    const rerun = await initAt(root, "0.0.5");
    expect(rerun.code).toBe(0);
    expect(rerun.text).toContain("Upgraded from Loupe 0.0.4 to 0.0.5.");
    expect(rerun.text).toContain("Next: run pnpm install so @repo/loupe resolves Loupe 0.0.5");
  });

  it("makes doctor fail while the layer resolves an older Loupe than its peer, until pnpm install", async () => {
    const root = await installedAt004();
    link(root, { app: "0.0.4", layer: "0.0.4" });
    expect((await doctorAt(root, "0.0.4")).code).toBe(0);

    bump(root, "0.0.5");
    commit(root);
    expect((await initAt(root, "0.0.5")).code).toBe(0);

    // The person's first install moved the app's copy; the layer's own stays until the second one.
    link(root, { app: "0.0.5", layer: "0.0.4" });
    const stale = await doctorAt(root, "0.0.5");
    expect(stale.code).toBe(1);
    expect(stale.text).toContain("✗ packages/loupe pins Loupe 0.0.5 in peerDependencies, and resolves 0.0.4");
    expect(stale.text).toContain("Run pnpm install, then commit pnpm-lock.yaml.");
    expect(stale.text).toContain("Result: 1 problem.");

    link(root, { app: "0.0.5", layer: "0.0.5" });
    const fixed = await doctorAt(root, "0.0.5");
    expect(fixed.text).toContain("✓ packages/loupe resolves Loupe 0.0.5, the version its peerDependencies pin");
    expect(fixed.text).toContain("Result: healthy.");
    expect(fixed.code).toBe(0);
  });

  it("asks for the version bump to be committed first", async () => {
    const root = await installedAt004();
    bump(root, "0.0.5");
    const before = snapshot(root);
    const { code, text } = await initAt(root, "0.0.5");
    expect(code).toBe(1);
    expect(text).toContain(PKG);
    expect(text).toContain("records Loupe 0.0.4, and 0.0.5 is installed: commit the version bump, then rerun loupe init.");
    expect(text).toContain("Nothing was written.");
    expect(snapshot(root)).toEqual(before);

    // The lockfile alone counts too: pnpm install changed it after the bump was committed.
    commit(root);
    writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n# 0.0.5\n");
    const lock = await initAt(root, "0.0.5");
    expect(lock.code).toBe(1);
    expect(lock.text).toContain("commit the version bump, then rerun loupe init.");
  });
});
