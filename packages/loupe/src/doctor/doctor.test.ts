import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  biome,
  cli,
  committedRepo,
  editLedger,
  type Files,
  git,
  installable,
  installedRepo,
  link,
  makeRepo,
  snapshot,
} from "../compat/repo.fixture.js";
import { version } from "../version.js";
import type { BuildRunner } from "./build.js";
import { runDoctor } from "./command.js";

const doctor = (root: string, ...argv: string[]) => cli(root, ["doctor", ...argv]);

/** A committed repo with Loupe installed and linked. */
async function installed(files: Files = {}): Promise<string> {
  const { root } = await installedRepo({ files, link: true });
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
    expect(text).toContain(`✓ packages/loupe resolves Loupe ${version}, the version its peerDependencies pin`);
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
    const root = committedRepo({ "apps/web/next.config.ts": fnConfig });
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

  it("reads a package.json hash Loupe 0.0.4 recorded, with the version in it, as intact", async () => {
    const { root } = await installedRepo({ oldHash: true, link: true });
    const { code, text } = await doctor(root);
    expect(text).toMatch(/✓ package-json /);
    expect(code).toBe(0);
  });

  it("reports an automatic touch point recorded without a hash as drift, not as a manual step", async () => {
    // init records `auto` with no hash when a touch point can't find the edit it just made.
    const root = await installed();
    editLedger(root, (ledger) => {
      for (const entry of ledger.touchPoints) if (entry.id === "root-layout") entry.sha256 = null;
    });
    const { code, text } = await doctor(root);
    expect(text).toMatch(/✗ root-layout +apps\/web\/app\/layout\.tsx: drift, changed by hand since loupe init recorded it/);
    expect(text).not.toContain("manual step not recorded yet");
    expect(code).toBe(1);
  });

  it("reports a touch point whose Loupe edit is gone", async () => {
    const root = await installed();
    edit(root, "biome.jsonc", () => biome);
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
    const root = makeRepo({}, installable);
    const { code, text } = await doctor(root);
    expect(text).toContain("Loupe isn't installed here");
    expect(code).toBe(1);
  });

  it("reports versions that differ", async () => {
    const root = await installed();
    link(root, { app: "9.9.9", layer: "9.9.9" });
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ Loupe versions differ");
    expect(text).toContain("apps/web/node_modules: 9.9.9");
    expect(code).toBe(1);
  });

  it("points to loupe init when only the ledger is behind, as an unfinished upgrade leaves it", async () => {
    const root = await installed();
    editLedger(root, (ledger) => {
      ledger.loupe = { package: "@danarocha/loupe", version: "0.0.1" };
    });
    const { code, text } = await doctor(root);
    expect(text).toContain("✗ Loupe versions differ");
    expect(text).toContain("the ledger: 0.0.1");
    expect(text).toContain(`Run loupe init to finish upgrading to ${version}.`);
    expect(text).not.toContain("exact-pinned");
    expect(code).toBe(1);
  });

  it("reports a ledger format it can't read", async () => {
    const root = await installed();
    editLedger(root, (ledger) => {
      ledger.formatVersion = 2;
    });
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
