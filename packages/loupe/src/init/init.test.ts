import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { run } from "../cli.js";
import { type Files, git, makeRepo, snapshot, supportedRepo } from "../compat/repo.fixture.js";
import { EXIT_MANUAL, parseInitArgs, runInit } from "./command.js";
import { type Ledger as LedgerFile, serialiseLedger } from "./ledger.js";
import { sha256 } from "./syntax.js";

const LEDGER = "packages/loupe/loupe.ledger.json";
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const layout = `import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
`;

const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`;

const biome = `{
  "files": {
    "includes": [
      "**/*",
      // Generated.
      "!dist"
    ]
  }
}
`;

const repoFiles: Files = {
  ...supportedRepo,
  "apps/web/package.json": {
    name: "web",
    scripts: { dev: "next dev -p 3000" },
    dependencies: { "@repo/design-system": "workspace:*", next: "16.3.6", react: "19.2.4" },
    devDependencies: { typescript: "^5.9.3" },
  },
  "apps/web/tsconfig.json": { compilerOptions: { jsx: "preserve", strict: true } },
  "apps/web/next.config.ts": nextConfig,
  "apps/web/app/layout.tsx": layout,
  "packages/design-system/tsconfig.json": { compilerOptions: { jsx: "preserve", strict: true } },
  "biome.jsonc": biome,
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};

/** A committed repo, so the touch points start clean. */
function gitRepo(files: Files = {}): string {
  const root = makeRepo({ ...repoFiles, ...files });
  temps.push(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "start");
  return root;
}

function commit(root: string): void {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "step");
}

async function init(root: string, ...argv: string[]) {
  return initAnswering(root, [], ...argv);
}

async function initAnswering(root: string, answers: string[], ...argv: string[]) {
  const out: string[] = [];
  const code = await run(["init", ...argv], {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    ask: async () => answers.shift() ?? "",
    cwd: root,
    nodeVersion: "22.22.2",
  });
  return { code, text: out.join("\n") };
}

/** `loupe init` as the given installed Loupe version would run it. */
async function initAt(root: string, version: string, ...argv: string[]) {
  const options = parseInitArgs(argv);
  if (typeof options === "string") throw new Error(options);
  const out: string[] = [];
  const code = await runInit(options, {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    ask: async () => "",
    cwd: root,
    nodeVersion: "22.22.2",
    version,
  });
  return { code, text: out.join("\n") };
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");
type Ledger = {
  touchPoints: { id: string; file: string; mode: string; sha256: string | null }[];
  files: { path: string; sha256: string }[];
  productLayer: unknown;
  loupe?: { package: string; version: string };
};
const ledger = (root: string) => JSON.parse(read(root, LEDGER)) as Ledger;

describe("loupe init on a clean repo", () => {
  it("makes the four edits, records each in a sorted ledger and leaves the lockfile alone", async () => {
    const root = gitRepo();
    const { code, text } = await init(root);
    expect(text).toContain("Result: works here.");
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
    const root = gitRepo();
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
    const root = gitRepo();
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

  it("only warns about other files, and refuses outside git even with --allow-dirty", async () => {
    const root = gitRepo();
    writeFileSync(path.join(root, "notes.md"), "x\n");
    const { code, text } = await init(root);
    expect(code).toBe(0);
    expect(text).toContain("1 other file(s) have uncommitted changes");

    const bare = makeRepo(repoFiles);
    temps.push(bare);
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
    const root = gitRepo({ "apps/web/next.config.ts": fnConfig });
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
    const root = gitRepo({ [LEDGER]: { formatVersion: 2 } });
    const before = snapshot(root);
    const newer = await init(root);
    expect(newer.code).toBe(1);
    expect(newer.text).toContain("formatVersion 2");
    expect(snapshot(root)).toEqual(before);
  });

  it("keeps a yes the check records during the same run", async () => {
    const root = gitRepo({ "apps/web/.babelrc": "{}\n" });
    const { code, text } = await initAnswering(root, ["yes"]);
    expect(text).toContain("Recorded your yes");
    expect(code).toBe(0);
    const l = JSON.parse(read(root, LEDGER));
    expect(l.untestedAccepted).toEqual([expect.objectContaining({ app: "apps/web", item: "bundler", seen: ".babelrc" })]);
    expect(l.touchPoints).toHaveLength(4);
  });

  it("keeps the compatibility check's field", async () => {
    const accepted = [{ app: "apps/web", item: "bundler", seen: ".babelrc", acceptedAt: "2026-11-11T00:00:00.000Z" }];
    const root = gitRepo({ [LEDGER]: { formatVersion: 1, untestedAccepted: accepted } });
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
  async function installedAt004(): Promise<string> {
    const root = gitRepo();
    expect((await initAt(root, "0.0.4")).code).toBe(0);
    const l = JSON.parse(read(root, LEDGER)) as LedgerFile;
    for (const t of l.touchPoints ?? []) {
      if (t.id === "package-json") t.sha256 = sha256(JSON.stringify([["@danarocha/loupe", "0.0.4"], ["@repo/loupe", "workspace:*"]]));
    }
    writeFileSync(path.join(root, LEDGER), serialiseLedger(l));
    commit(root);
    return root;
  }

  /** The person's half: the version bump in the app's package.json (pnpm install updates the lockfile too). */
  function bump(root: string, version: string): void {
    const json = JSON.parse(read(root, PKG));
    json.devDependencies["@danarocha/loupe"] = version;
    writeFileSync(path.join(root, PKG), `${JSON.stringify(json, null, 2)}\n`);
  }

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
