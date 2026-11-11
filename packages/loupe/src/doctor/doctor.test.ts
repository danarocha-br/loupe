import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { run } from "../cli.js";
import { type Files, makeRepo, snapshot, supportedRepo } from "../compat/repo.fixture.js";
import { version } from "../version.js";
import type { BuildRunner } from "./build.js";
import { runDoctor } from "./command.js";

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

const repoFiles: Files = {
  ...supportedRepo,
  ".gitignore": "node_modules\n.next\n",
  "apps/web/package.json": {
    name: "web",
    scripts: { dev: "next dev -p 3000" },
    dependencies: { "@repo/design-system": "workspace:*", next: "16.3.6", react: "19.2.4" },
  },
  "apps/web/tsconfig.json": { compilerOptions: { jsx: "preserve", strict: true } },
  "apps/web/next.config.ts": 'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n',
  "apps/web/app/layout.tsx": layout,
  "packages/design-system/tsconfig.json": { compilerOptions: { jsx: "preserve", strict: true } },
  "packages/design-system/components/ui/button.tsx":
    'export function Button(props: { variant?: "default" | "ghost" }) {\n  return <button data-variant={props.variant} />;\n}\n',
  "biome.jsonc": '{\n  "files": {\n    "includes": ["**/*"]\n  }\n}\n',
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};

const git = (root: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

type Output = { code: number; text: string; questions: string[] };

async function cli(root: string, argv: string[]): Promise<Output> {
  const out: string[] = [];
  const questions: string[] = [];
  const code = await run(argv, {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    ask: async (q) => {
      questions.push(q);
      return "";
    },
    cwd: root,
    nodeVersion: "22.22.2",
  });
  return { code, text: out.join("\n"), questions };
}

const doctor = (root: string, ...argv: string[]) => cli(root, ["doctor", ...argv]);

/** What `pnpm install` would link after `init`. */
function link(root: string, loupeVersion = version): void {
  const pkg = (dir: string, json: object) => {
    mkdirSync(path.join(root, dir), { recursive: true });
    writeFileSync(path.join(root, dir, "package.json"), JSON.stringify(json));
  };
  pkg("apps/web/node_modules/@danarocha/loupe", { name: "@danarocha/loupe", version: loupeVersion });
  pkg("apps/web/node_modules/@repo/loupe", { name: "@repo/loupe" });
  for (const name of ["@danarocha/loupe", "@repo/design-system", "next", "react"]) {
    pkg(`packages/loupe/node_modules/${name}`, { name });
  }
}

/** A committed repo with Loupe installed and linked. */
async function installed(files: Files = {}): Promise<string> {
  const root = makeRepo({ ...repoFiles, ...files });
  temps.push(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "start");
  const { code, text } = await cli(root, ["init"]);
  expect(text).toContain("Recorded in");
  expect(code).toBe(0);
  link(root);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "install");
  return root;
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");
const edit = (root: string, file: string, change: (text: string) => string) =>
  writeFileSync(path.join(root, file), change(read(root, file)));

describe("loupe doctor on a healthy install", () => {
  it("passes every check and changes no file", async () => {
    const root = await installed();
    const before = snapshot(root);
    const { code, text, questions } = await doctor(root);
    expect(text).toContain("Loupe doctor — apps/web");
    expect(text).toContain("Result: works here.");
    expect(text).toContain(`✓ Loupe ${version} in apps/web/package.json, the ledger, apps/web/node_modules, this CLI`);
    expect(text).toContain("✓ Ledger formatVersion 1, adapt-list formatVersion 1");
    for (const id of ["biome-config", "next-config", "package-json", "root-layout"]) expect(text).toMatch(new RegExp(`✓ ${id} `));
    expect(text).toContain("✓ 4 files from loupe init match the ledger");
    expect(text).toMatch(/✓ \d+ files from loupe generate, none edited by hand/);
    expect(text).toContain("✓ packages/loupe resolves @danarocha/loupe, @repo/design-system, next, react");
    expect(text).toContain("✓ apps/web resolves @danarocha/loupe, @repo/loupe");
    expect(text).toContain("Result: healthy. loupe doctor changed nothing.");
    expect(code).toBe(0);
    expect(questions).toEqual([]);
    expect(snapshot(root)).toEqual(before);
    expect(git(root, "status", "--porcelain")).toBe("");
  });

  it("lists a dev server on Bun as supported", async () => {
    const root = await installed({
      "apps/web/package.json": {
        name: "web",
        scripts: { dev: "bun --bun next dev -p 3000" },
        dependencies: { "@repo/design-system": "workspace:*", next: "16.3.6", react: "19.2.4" },
      },
    });
    const { code, text } = await doctor(root);
    expect(text).toMatch(/✓ Dev server runs on Bun +supported/);
    expect(code).toBe(0);
  });

  it("lists a manual touch point as such", async () => {
    const fnConfig = 'import type { NextConfig } from "next";\n\nexport default (phase: string): NextConfig => ({});\n';
    const root = makeRepo({ ...repoFiles, "apps/web/next.config.ts": fnConfig });
    temps.push(root);
    git(root, "init", "-q", "-b", "main");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "start");
    expect((await cli(root, ["init"])).code).toBe(2);

    const pending = await doctor(root);
    expect(pending.code).toBe(1);
    expect(pending.text).toMatch(/✗ next-config +apps\/web\/next\.config\.ts: manual step not recorded yet/);

    writeFileSync(
      path.join(root, "apps/web/next.config.ts"),
      'import { withLoupe } from "@repo/loupe/next";\nimport type { NextConfig } from "next";\n\nexport default withLoupe((phase: string): NextConfig => ({}));\n',
    );
    expect((await cli(root, ["init", "--adopt"])).code).toBe(0);
    link(root);
    const adopted = await doctor(root);
    expect(adopted.text).toMatch(/✓ next-config +apps\/web\/next\.config\.ts \(manual\)/);
    expect(adopted.code).toBe(0);
  });
});

describe("loupe doctor reporting drift", () => {
  it("reports a hand edit to a touch point and leaves it", async () => {
    const root = await installed();
    edit(root, "apps/web/app/layout.tsx", (t) => t.replace("<LoupeMount />", "<LoupeMount debug />"));
    const before = snapshot(root);
    const { code, text } = await doctor(root);
    expect(text).toMatch(/✗ root-layout +apps\/web\/app\/layout\.tsx: drift, changed by hand since loupe init recorded it/);
    expect(text).toContain("Result: 1 problem. loupe doctor changed nothing.");
    expect(code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });

  it("doesn't count a formatting-only change to a touch point", async () => {
    const root = await installed();
    edit(root, "apps/web/next.config.ts", (t) => t.replace('"@repo/loupe/next"', "'@repo/loupe/next'"));
    const { code, text } = await doctor(root);
    expect(text).toMatch(/✓ next-config /);
    expect(code).toBe(0);
  });

  it("reports a touch point whose Loupe edit is gone", async () => {
    const root = await installed();
    edit(root, "biome.jsonc", () => repoFiles["biome.jsonc"] as string);
    const { code, text } = await doctor(root);
    expect(text).toMatch(/✗ biome-config +biome\.jsonc: Loupe's edit is missing/);
    expect(code).toBe(1);
  });

  it("reports a hand edit to a generated file and to one of init's files", async () => {
    const root = await installed();
    const adapter = "packages/loupe/adapters/ds/ui/button.tsx";
    edit(root, adapter, (t) => `${t}// mine\n`);
    edit(root, "packages/loupe/mount.tsx", (t) => `${t}// mine\n`);
    const before = snapshot(root);
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ 1 generated file edited by hand (drift)");
    expect(text).toContain("    adapters/ds/ui/button.tsx");
    expect(text).toContain("✗ 1 of loupe init's files changed by hand (drift)");
    expect(text).toContain("    mount.tsx");
    expect(code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });

  it("reports a generated file whose header was removed by hand", async () => {
    const root = await installed();
    edit(root, "packages/loupe/adapters/ds/ui/button.tsx", (t) => t.split("\n").slice(1).join("\n"));
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ 1 file without loupe generate's header where it needs to write (drift)");
    expect(code).toBe(1);
  });

  it("fails, rather than calls stale, a generated file from a newer format", async () => {
    const root = await installed();
    edit(root, "packages/loupe/adapters/ds/ui/button.tsx", (t) => {
      const body = t.split("\n").slice(1).join("\n");
      const hash = createHash("sha256").update(`2\n${body}`, "utf8").digest("hex");
      return `// @generated by loupe generate, do not edit (formatVersion 2, sha256:${hash})\n${body}`;
    });
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ 1 generated file written by a newer Loupe");
    expect(text).not.toContain("out of date with the sources");
    expect(code).toBe(1);
  });

  it("says to run generate when adapt-list.json is missing", async () => {
    const root = await installed();
    rmSync(path.join(root, "packages/loupe/adapt-list.json"));
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ adapt-list.json is missing");
    expect(code).toBe(1);
  });

  it("reports a missing generated file", async () => {
    const root = await installed();
    rmSync(path.join(root, "packages/loupe/adapters/ds/ui/button.tsx"));
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ 1 generated file missing");
    expect(code).toBe(1);
  });

  it("warns, without failing, when a source changed since generate", async () => {
    const root = await installed();
    edit(root, "packages/design-system/components/ui/button.tsx", (t) => t.replace('"ghost"', '"ghost" | "link"'));
    const before = snapshot(root);
    const { code, text } = await doctor(root);
    expect(text).toMatch(/! \d+ generated files? out of date with the sources/);
    expect(text).toContain("Run loupe generate.");
    expect(text).toMatch(/Result: healthy, with 1 warning/);
    expect(code).toBe(0);
    expect(snapshot(root)).toEqual(before);
  });
});

describe("loupe doctor on a broken install", () => {
  it("says Loupe isn't installed when there is no ledger", async () => {
    const root = makeRepo(repoFiles);
    temps.push(root);
    const { code, text } = await doctor(root);
    expect(text).toContain("Loupe isn't installed here");
    expect(code).toBe(1);
  });

  it("reports versions that differ", async () => {
    const root = await installed();
    link(root, "9.9.9");
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ Loupe versions differ");
    expect(text).toContain("apps/web/node_modules: 9.9.9");
    expect(code).toBe(1);
  });

  it("reports a ledger format it can't read", async () => {
    const root = await installed();
    edit(root, LEDGER, (t) => t.replace('"formatVersion": 1', '"formatVersion": 2'));
    const { code, text } = await doctor(root);
    expect(text).toContain("formatVersion 2, this Loupe reads 1");
    expect(code).toBe(1);
  });

  it("reports packages that don't resolve, before pnpm install", async () => {
    const root = await installed();
    rmSync(path.join(root, "packages/loupe/node_modules"), { recursive: true });
    rmSync(path.join(root, "apps/web/node_modules/@repo"), { recursive: true });
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ packages/loupe can't resolve @danarocha/loupe, @repo/design-system, next, react");
    expect(text).toContain("✗ apps/web can't resolve @repo/loupe");
    expect(code).toBe(1);
  });

  it("reports an app Adapter whose relative import no longer resolves", async () => {
    const root = await installed();
    const file = path.join(root, "packages/loupe/adapters/app/row.tsx");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      'import "../../../../apps/web/styles";\nexport { Row } from "../../../../apps/web/components/row";\nexport { Row as Dir } from "../../../../apps/web/app";\n',
    );
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ 3 relative imports of app Adapters don't resolve");
    expect(text).toContain("adapters/app/row.tsx imports ../../../../apps/web/styles");
    expect(text).toContain("adapters/app/row.tsx imports ../../../../apps/web/components/row");
    expect(text).toContain("adapters/app/row.tsx imports ../../../../apps/web/app");
    expect(code).toBe(1);
  });

  it("reruns the compatibility check without asking about a new untested item", async () => {
    const root = await installed();
    writeFileSync(path.join(root, "apps/web/.babelrc"), "{}\n");
    const before = snapshot(root);
    const { code, text, questions } = await doctor(root);
    expect(text).toContain("1 not accepted yet");
    expect(questions).toEqual([]);
    expect(code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });
});

describe("loupe doctor --build", () => {
  /** A build that writes `files` into the app's .next. */
  const fakeBuild =
    (files: Record<string, string>, code = 0): BuildRunner =>
    async (appAbs) => {
      for (const [file, content] of Object.entries(files)) {
        const full = path.join(appAbs, ".next", file);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
      return { code, describe: "fake" };
    };

  async function withBuild(root: string, build: BuildRunner) {
    const out: string[] = [];
    const code = await runDoctor(
      { build: true },
      { out: (l) => out.push(l), err: (l) => out.push(l), cwd: root, nodeVersion: "22.22.2", build },
    );
    return { code, text: out.join("\n") };
  }

  it("passes a build with no trace of Loupe, ignoring .next/dev, .next/cache and source maps", async () => {
    const root = await installed();
    const { code, text } = await withBuild(
      root,
      fakeBuild({
        "required-server-files.json": '{"config":{"turbopack":{}}}',
        "static/chunks/app.js": "console.log(1)",
        "dev/static/chunks/app.js": 'x["data-ds-anchor"]',
        "cache/tsbuildinfo": "@repo/loupe",
        "server/cache/kept.js": "ok",
        "static/media/loader.cjs": "a dependency's own loader",
        "server/chunks/layout.js.map": '{"sourcesContent":["import { LoupeMount } from \\"@repo/loupe/mount\\";"]}',
      }),
    );
    for (const needle of ["data-ds-anchor", "__loupe", "loupe/dist/loader.cjs", "@repo/loupe", "@danarocha/loupe"]) {
      expect(text).toContain(`✓ No "${needle}" in .next`);
    }
    expect(text).toContain("✓ required-server-files.json names no Loupe loader");
    expect(text).toContain("Scanned 4 files");
    expect(text).toContain("changed nothing but the app's .next");
    expect(code).toBe(0);
  });

  it("fails on any trace, and on a loader in required-server-files.json", async () => {
    const root = await installed();
    const { code, text } = await withBuild(
      root,
      fakeBuild({
        "required-server-files.json": '{"loaders":[{"loader":"/x/@danarocha/loupe/dist/loader.cjs"}]}',
        "server/app/page.js": 'globalThis.__loupeRegistry; require("@repo/loupe/mount")',
        "server/cache/page.js": '<div data-ds-anchor="x">',
      }),
    );
    expect(text).toContain('✗ "data-ds-anchor" found in 1 file');
    expect(text).toContain("    server/cache/page.js");
    expect(text).toContain('✗ "__loupe" found in 1 file');
    expect(text).toContain("    server/app/page.js");
    expect(text).toContain('✗ "@repo/loupe" found in 1 file');
    expect(text).toContain('✗ "loupe/dist/loader.cjs" found in 1 file');
    expect(text).toContain('✗ required-server-files.json names "loupe/dist/loader.cjs", "@danarocha/loupe"');
    expect(code).toBe(1);
  });

  it("fails when the build fails", async () => {
    const root = await installed();
    const { code, text } = await withBuild(root, fakeBuild({}, 1));
    expect(text).toContain("✗ next build failed (fake); exit 1");
    expect(text).toContain("Result: 1 problem. loupe doctor changed nothing but the app's .next.");
    expect(code).toBe(1);
  });

  it("fails when the build left nothing to scan", async () => {
    const root = await installed();
    const { code, text } = await withBuild(root, fakeBuild({ "static/x.js": "" }));
    expect(text).toContain("✗ Can't find a build to scan: no apps/web/.next/required-server-files.json");
    expect(code).toBe(1);
  });

  it("rejects an unknown option", async () => {
    const { code, text } = await doctor(process.cwd(), "--force");
    expect(text).toContain("Unknown option: --force");
    expect(code).toBe(1);
  });
});
