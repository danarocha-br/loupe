import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../cli.js";
import { checkCompatibility } from "./check.js";
import { STATEMENT } from "./statement.js";
import { makeRepo, snapshot } from "./repo.fixture.js";

const LEDGER = "packages/loupe/loupe.ledger.json";

async function check(root: string, answers: string[] = [], argv: string[] = [], node = "22.22.2") {
  const out: string[] = [];
  const err: string[] = [];
  const questions: string[] = [];
  const code = await run(["check", ...argv], {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ask: async (question) => {
      questions.push(question);
      return answers.shift() ?? "";
    },
    cwd: root,
    nodeVersion: node,
  });
  return { code, text: [...out, ...err].join("\n"), questions };
}

describe("loupe check on a supported repo", () => {
  it("shows every item as supported and asks nothing", async () => {
    const root = makeRepo();
    const { code, text, questions } = await check(root);
    expect(code).toBe(0);
    expect(questions).toEqual([]);
    expect(text).toContain("Compatibility check — apps/web");
    expect(text).toMatch(/✓ Next\.js 16\.3\.6, App Router, Turbopack dev +supported/);
    expect(text).toContain("React 19.3.0-canary-cbb046ab-20260731 (bundled by Next)");
    expect(text).toMatch(/✓ pnpm workspace +supported/);
    expect(text).toMatch(/✓ Design system @repo\/design-system \(shadcn on Base UI\) +supported/);
    expect(text).toMatch(/✓ TypeScript +supported/);
    expect(text).toMatch(/✓ Dev server runs on Node 22\.22\.2 +supported/);
    expect(text).toContain("Result: works here.");
    expect(text).not.toContain(STATEMENT);
  });

  it("supports a dev server on Bun", async () => {
    const root = makeRepo({
      "apps/web/package.json": {
        name: "web",
        scripts: { dev: "bun --bun next dev -p 3000 --turbopack" },
        dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*" },
      },
    });
    const { code, text } = await check(root);
    expect(code).toBe(0);
    expect(text).toMatch(/✓ Dev server runs on Bun +supported/);
  });

  it("follows the dev script to the script that runs next dev", async () => {
    const root = makeRepo({
      "apps/web/package.json": {
        name: "web",
        scripts: {
          dev: 'concurrently "npm:next-dev" "npm:stripe"',
          "next-dev": "next dev --webpack",
          stripe: "stripe listen",
        },
        dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*" },
      },
    });
    const { code, text } = await check(root);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ Dev server uses webpack/);
  });
});

describe("loupe check refusing", () => {
  it("refuses webpack in dev, names the fix and writes nothing", async () => {
    const root = makeRepo({
      "apps/web/package.json": {
        name: "web",
        scripts: { dev: "next dev --webpack -p 3000" },
        dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*" },
      },
    });
    const before = snapshot(root);
    const { code, text, questions } = await check(root, ["yes"]);
    expect(code).toBe(1);
    expect(questions).toEqual([]);
    expect(text).toMatch(/✗ Dev server uses webpack \(`next dev --webpack`\) +not supported/);
    expect(text).toContain("Loupe needs Turbopack in development");
    expect(text).toContain("Fix: remove `--webpack` from the dev script in apps/web/package.json.");
    expect(text).toContain("Nothing was written.");
    expect(text).toContain(STATEMENT);
    expect(snapshot(root)).toEqual(before);
  });

  it.each([
    ["15.5.0", /✗ Next\.js 15\.5\.0 +not supported/],
    ["17.0.0", /✗ Next\.js 17\.0\.0 +not supported/],
  ])("refuses Next.js %s", async (version, line) => {
    const root = makeRepo({ "apps/web/node_modules/next/package.json": { version } });
    const { code, text } = await check(root);
    expect(code).toBe(1);
    expect(text).toMatch(line);
    expect(text).toContain("Nothing was written.");
  });

  it("refuses an app with only the Pages Router", async () => {
    const root = makeRepo({ "apps/web/app/page.tsx": null, "apps/web/pages/index.tsx": "" });
    const { code, text } = await check(root, [], ["--app", "apps/web"]);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ Pages Router only +not supported/);
  });

  it("refuses an npm workspace", async () => {
    const root = makeRepo({
      "pnpm-workspace.yaml": null,
      "package.json": { name: "root", workspaces: ["apps/*", "packages/*"] },
    });
    const { code, text } = await check(root);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ npm workspace +not supported/);
  });

  it("refuses a pnpm workspace that does not cover packages/*", async () => {
    const root = makeRepo({
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - libs/*\n",
      "packages/design-system/package.json": null,
      "libs/design-system/package.json": {
        name: "@repo/design-system",
        dependencies: { "@base-ui/react": "^1.6.0" },
      },
      "packages/design-system/components.json": null,
      "libs/design-system/components.json": { aliases: { ui: "@repo/design-system/components/ui" } },
      "packages/design-system/components/ui/button.tsx": null,
      "libs/design-system/components/ui/button.tsx": "export function Button() {}\n",
    });
    const { code, text } = await check(root);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ pnpm workspace without packages\/\* +not supported/);
    expect(text).toContain("Fix: add `packages/*` to pnpm-workspace.yaml.");
  });

  it("refuses an app without a tsconfig", async () => {
    const root = makeRepo({ "apps/web/tsconfig.json": null });
    const { code, text } = await check(root);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ No tsconfig\.json in apps\/web +not supported/);
  });

  it("refuses when the app depends on no workspace design system", async () => {
    const root = makeRepo({
      "apps/web/package.json": {
        name: "web",
        scripts: { dev: "next dev" },
        dependencies: { next: "16.3.6" },
      },
    });
    const { code, text } = await check(root);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ No workspace design system +not supported/);
  });
});

describe("loupe check with untested items", () => {
  const node24 = "24.1.0";

  it("asks once for every untested item and remembers the yes", async () => {
    const root = makeRepo({ "apps/web/.babelrc": "{}" });
    const first = await check(root, ["yes"], [], node24);
    expect(first.code).toBe(0);
    expect(first.questions).toHaveLength(1);
    expect(first.text).toMatch(/! Dev server runs on Node 24\.1\.0 +not tested yet/);
    expect(first.text).toMatch(/! Babel config \(apps\/web\/\.babelrc\) +not tested yet/);
    expect(first.text).toContain("Result: works here, with 2 untested items.");

    const ledger = JSON.parse(readFileSync(join(root, LEDGER), "utf8"));
    expect(ledger.formatVersion).toBe(1);
    expect(ledger.untestedAccepted).toEqual([
      expect.objectContaining({ app: "apps/web", item: "bundler", seen: ".babelrc" }),
      expect.objectContaining({ app: "apps/web", item: "runtime", seen: "Node 24.1.0" }),
    ]);

    const rerun = await check(root, [], [], node24);
    expect(rerun.code).toBe(0);
    expect(rerun.questions).toEqual([]);
    expect(rerun.text).toMatch(/! Dev server runs on Node 24\.1\.0 +accepted, not tested/);
    expect(readFileSync(join(root, LEDGER), "utf8")).toBe(JSON.stringify(ledger, null, 2) + "\n");
  });

  it("asks again when the version seen has changed", async () => {
    const root = makeRepo();
    await check(root, ["yes"], [], node24);
    const later = await check(root, ["yes"], [], "24.2.0");
    expect(later.questions).toHaveLength(1);
  });

  it("writes nothing on a no", async () => {
    const root = makeRepo();
    const before = snapshot(root);
    const { code, text } = await check(root, ["no"], [], node24);
    expect(code).toBe(1);
    expect(text).toContain("Nothing was written.");
    expect(existsSync(join(root, LEDGER))).toBe(false);
    expect(snapshot(root)).toEqual(before);
  });

  it("keeps fields it does not own when it records a yes", async () => {
    const root = makeRepo({ [LEDGER]: { formatVersion: 1, app: "apps/web", touchPoints: [] } });
    await check(root, ["yes"], [], node24);
    const ledger = JSON.parse(readFileSync(join(root, LEDGER), "utf8"));
    expect(ledger).toMatchObject({ app: "apps/web", touchPoints: [] });
    expect(ledger.untestedAccepted).toHaveLength(1);
  });

  it.each([
    ["Next.js 16.1", { "apps/web/node_modules/next/package.json": { version: "16.1.0" } }, /! Next\.js 16\.1\.0 +not tested yet/],
    ["App + Pages Router", { "apps/web/pages/index.tsx": "" }, /! App Router and Pages Router +not tested yet/],
    ["React Compiler", { "apps/web/next.config.ts": "export default { reactCompiler: true };\n" }, /! React Compiler +not tested yet/],
    [
      "shadcn on Radix",
      { "packages/design-system/package.json": { name: "@repo/design-system", dependencies: { "radix-ui": "^1.4.0" } } },
      /! Design system @repo\/design-system \(shadcn on Radix\) +not tested yet/,
    ],
  ])("treats %s as untested", async (_name, files, line) => {
    const root = makeRepo(files);
    const { code, text, questions } = await check(root, ["yes"]);
    expect(code).toBe(0);
    expect(questions).toHaveLength(1);
    expect(text).toMatch(line);
  });
});

describe("loupe check choosing", () => {
  const twoApps = {
    "apps/admin/package.json": {
      name: "admin",
      scripts: { dev: "next dev" },
      dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*" },
    },
    "apps/admin/tsconfig.json": {},
    "apps/admin/app/page.tsx": "export default function Page() {}\n",
    "apps/admin/node_modules/next/package.json": { name: "next", version: "16.3.6" },
  };

  it("lists several App Router apps, marks the likeliest and asks", async () => {
    const root = makeRepo(twoApps);
    const { code, text, questions } = await check(root, ["2"]);
    expect(code).toBe(0);
    expect(text).toContain("  1. apps/admin");
    expect(text).toContain("  2. apps/web  (imports @repo/design-system most)");
    expect(questions[0]).toMatch(/Which app/);
    expect(text).toContain("Compatibility check — apps/web");
  });

  it("never guesses when no app is chosen", async () => {
    const root = makeRepo(twoApps);
    const { code, text } = await check(root, []);
    expect(code).toBe(1);
    expect(text).toContain("No app was chosen. Nothing was written.");
  });

  it("takes the app from --app", async () => {
    const root = makeRepo(twoApps);
    const { code, text, questions } = await check(root, [], ["--app", "apps/admin"]);
    expect(code).toBe(0);
    expect(questions).toEqual([]);
    expect(text).toContain("Compatibility check — apps/admin");
  });

  it("asks which design system when two are candidates", async () => {
    const root = makeRepo({
      "apps/web/package.json": {
        name: "web",
        scripts: { dev: "next dev" },
        dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*", "@repo/ui": "workspace:*" },
      },
      "packages/ui/package.json": { name: "@repo/ui", dependencies: { "@base-ui/react": "^1.6.0" } },
      "packages/ui/components.json": { aliases: { ui: "@repo/ui/components" } },
      "packages/ui/components/card.tsx": "export function Card() {}\n",
    });
    const { code, text, questions } = await check(root, ["2"]);
    expect(code).toBe(0);
    expect(questions[0]).toMatch(/Which design system/);
    expect(text).toMatch(/✓ Design system @repo\/ui \(shadcn on Base UI\)/);
  });
});

describe("version recheck for generate", () => {
  it("warns on an untested version and continues without asking", async () => {
    const root = makeRepo({ "apps/web/node_modules/next/package.json": { version: "16.2.0" } });
    const out: string[] = [];
    const result = await checkCompatibility({
      cwd: root,
      app: "apps/web",
      mode: "versions",
      nodeVersion: "22.22.2",
      io: { out: (l) => out.push(l), err: (l) => out.push(l), ask: async () => { throw new Error("asked"); } },
    });
    expect(result.ok).toBe(true);
    expect(out.join("\n")).toMatch(/! Next\.js 16\.2\.0 +not tested yet/);
    expect(out.join("\n")).not.toContain("pnpm workspace");
  });

  it("fails on an unsupported version", async () => {
    const root = makeRepo({ "apps/web/node_modules/next/package.json": { version: "17.0.0" } });
    const out: string[] = [];
    const result = await checkCompatibility({
      cwd: root,
      app: "apps/web",
      mode: "versions",
      nodeVersion: "22.22.2",
      io: { out: (l) => out.push(l), err: (l) => out.push(l), ask: async () => "" },
    });
    expect(result.ok).toBe(false);
    expect(out.join("\n")).toContain("Nothing was written.");
  });
});
