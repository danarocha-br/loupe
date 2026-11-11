import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { classify, importers, render, verdict } from "../scripts/lockfile.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/lockfile.mjs", import.meta.url));

/** A v9 lockfile with the importers section only, which is all `classify` reads. */
function lockfile(importerEntries) {
  const lines = ["lockfileVersion: '9.0'", "", "importers:", ""];
  for (const [importer, deps] of Object.entries(importerEntries)) {
    lines.push(`  ${importer}:`);
    lines.push("    devDependencies:");
    for (const [name, [specifier, version]] of Object.entries(deps)) {
      lines.push(`      ${name.startsWith("@") ? `'${name}'` : name}:`);
      lines.push(`        specifier: ${specifier}`);
      lines.push(`        version: ${version}`);
    }
    lines.push("");
  }
  lines.push("packages:", "", "  react@19.2.4:", "    resolution: {integrity: sha512-x}", "");
  return lines.join("\n");
}

const before = lockfile({
  ".": { typescript: ["^5.9.3", "5.9.3"] },
  "apps/app": { next: ["16.3.6", "16.3.6"] },
  "packages/env": { "@t3-oss/env-nextjs": ["^0.13.10", "0.13.11(typescript@5.9.3)(zod@4.4.3)"] },
  "packages/design-system": { "radix-ui": ["latest", "1.6.7"] },
});

describe("lockfile classification", () => {
  it("reads importer entries, unquoting scoped names", () => {
    const map = importers(before);
    assert.deepEqual(map.get("packages/env\tdevDependencies\t@t3-oss/env-nextjs"), {
      specifier: "^0.13.10",
      version: "0.13.11(typescript@5.9.3)(zod@4.4.3)",
    });
    assert.equal(map.size, 4);
  });

  it("files Loupe's own entries apart from a TypeScript peer re-resolution", () => {
    const after = lockfile({
      ".": { typescript: ["^5.9.3", "5.9.3"] },
      "apps/app": {
        "@danarocha/loupe": ["0.0.2", "0.0.2(react@19.2.4)"],
        "@repo/loupe": ["workspace:*", "link:../../packages/loupe"],
        next: ["16.3.6", "16.3.6"],
      },
      "packages/env": { "@t3-oss/env-nextjs": ["^0.13.10", "0.13.11(typescript@6.0.3)(zod@4.4.3)"] },
      "packages/design-system": { "radix-ui": ["latest", "1.6.7"] },
      "packages/loupe": { react: ["19.2.4", "19.2.4"] },
    });
    const c = classify(before, after);
    assert.deepEqual(
      c.own.map((r) => `${r.importer} ${r.name}`),
      ["apps/app @danarocha/loupe", "apps/app @repo/loupe", "packages/loupe react"],
    );
    assert.deepEqual(c.peers.map((r) => r.name), ["@t3-oss/env-nextjs"]);
    assert.equal(verdict(c), "loupe-and-peers");
    assert.equal(render(c, "abc").at(-1), "Result: loupe-and-peers");
    assert.equal(verdict({ ...c, own: [] }), "peers-only");
  });

  it("flags a dependency that moved without a package.json change, like a 'latest' specifier", () => {
    const after = before.replace("version: 1.6.7", "version: 1.7.0");
    const c = classify(before, after);
    assert.deepEqual(c.moved.map((r) => r.name), ["radix-ui"]);
    assert.equal(verdict(c), "other-changes");
  });

  it("flags a specifier change as a package.json change, and an identical file as unchanged", () => {
    const c = classify(before, before.replace("specifier: 16.3.6", "specifier: 16.3.7"));
    assert.deepEqual(c.manifest.map((r) => r.name), ["next"]);
    assert.equal(verdict(classify(before, before)), "unchanged");
  });
});

describe("lockfile restore", () => {
  const work = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-lockfile-")));
  after(() => rmSync(work, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: work, encoding: "utf8" }).trim();
  const bin = path.join(work, ".bin");
  mkdirSync(bin);
  const fakePnpm = (exitCode) => {
    writeFileSync(path.join(bin, "pnpm"), `#!/bin/sh\necho "pnpm $*" >> "${path.join(bin, "calls")}"\nexit ${exitCode}\n`);
    chmodSync(path.join(bin, "pnpm"), 0o755);
  };
  const run = (...args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: work,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
  const lock = path.join(work, "pnpm-lock.yaml");
  const installed = lockfile({
    "apps/app": { "@danarocha/loupe": ["0.0.2", "0.0.2"] },
    "packages/env": { "@t3-oss/env-nextjs": ["^0.13.10", "0.13.11(typescript@6.0.3)(zod@4.4.3)"] },
  });
  const residue = lockfile({
    "packages/env": { "@t3-oss/env-nextjs": ["^0.13.10", "0.13.11(typescript@6.0.3)(zod@4.4.3)"] },
  });
  const original = lockfile({
    "packages/env": { "@t3-oss/env-nextjs": ["^0.13.10", "0.13.11(typescript@5.9.3)(zod@4.4.3)"] },
  });

  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  writeFileSync(path.join(work, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  writeFileSync(path.join(work, ".gitignore"), ".bin/\n");
  writeFileSync(lock, original);
  git("add", ".");
  git("commit", "-qm", "before");
  mkdirSync(path.join(work, "packages/loupe"), { recursive: true });
  writeFileSync(path.join(work, "packages/loupe/loupe.ledger.json"), "{}\n");
  writeFileSync(lock, installed);
  git("add", ".");
  git("commit", "-qm", "install loupe");

  it("reports against the commit before the ledger was added", () => {
    writeFileSync(lock, residue);
    const out = run("report");
    assert.equal(out.status, 0);
    assert.match(out.stdout, /against [0-9a-f]+ before:/);
    assert.match(out.stdout, /Result: peers-only/);
  });

  it("puts the lockfile back when pnpm accepts it frozen", () => {
    fakePnpm(0);
    writeFileSync(lock, residue);
    const out = run("restore", "--base", "auto");
    assert.equal(out.status, 0, out.stderr);
    assert.equal(readFileSync(lock, "utf8"), original);
    assert.match(readFileSync(path.join(bin, "calls"), "utf8"), /pnpm install --frozen-lockfile/);
  });

  it("keeps the current lockfile when pnpm refuses the old one", () => {
    fakePnpm(1);
    writeFileSync(lock, residue);
    const out = run("restore", "--base", "auto");
    assert.equal(out.status, 1);
    assert.equal(readFileSync(lock, "utf8"), residue);
  });

  it("refuses to restore over anything but peer re-resolutions", () => {
    fakePnpm(0);
    writeFileSync(lock, installed);
    const out = run("restore");
    assert.equal(out.status, 1);
    assert.match(out.stderr, /Not restoring/);
    assert.equal(readFileSync(lock, "utf8"), installed);
  });
});
