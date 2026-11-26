// `pnpm visual`: is the working tree drawn exactly as its base is?
//
// 1. The base is `git merge-base HEAD main` (or `--base <ref>`): on main, its tip; on a
//    branch, where it left main. It is checked out in `.visual/base` (a git worktree,
//    ignored), installed offline and built, and recorded once: the recording is kept under
//    the base's commit and a hash of this recorder, and reused until either changes.
// 2. The working tree, uncommitted changes and all, is built and recorded.
// 3. The two are diffed (`compare.ts`); `.visual/report.md` lists every difference, and the
//    command fails if there is one.
//
// Both are recorded on this machine, with the same browser and the same system fonts, so a
// difference is the code's. Nothing is committed: a baseline made on one OS would fail on
// another, since the tokens draw in the system's sans.
//
// Options: `--base <ref>`, `--only <scene prefix>` (`ui/`, `ui/chip-group`, `patterns/`,
// `patterns/sheet`, `toolbar/dark`, `overlay/`), `--update` to record the base again (`pnpm visual:update`).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { compare, empty, failures, markdown } from "./compare.ts";
import { record } from "./record.ts";
import { assertFixtureFree, stopAll } from "./servers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../..");
const WORK = join(REPO, ".visual");
const BASE_TREE = join(WORK, "base");

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    only: { type: "string" },
    update: { type: "boolean", default: false },
  },
});

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-30).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}:\n${output}`);
  }
  return result.stdout.trim();
}
const git = (args: string[], cwd = REPO) => run("git", args, cwd);
const step = (text: string) => process.stdout.write(`\n▸ ${text}\n`);

/** What makes a recording: the recorder's source and Playwright's version. A change to either records the base again; the diff and this file don't. */
function recorderHash(): string {
  const hash = createHash("sha256");
  for (const file of ["files.ts", "record.ts", "servers.ts", "snapshot.ts"]) hash.update(file).update(readFileSync(join(HERE, file)));
  hash.update(readFileSync(join(HERE, "../package.json")));
  return hash.digest("hex").slice(0, 8);
}

/** `main`, or `origin/main` in a checkout that has no local `main`; a `--base` is taken as given. */
function baseRef(): string {
  if (values.base) return values.base;
  const has = (ref: string) => spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: REPO }).status === 0;
  if (has("main")) return "main";
  if (has("origin/main")) return "origin/main";
  throw new Error("no main or origin/main to compare against: pass --base <ref>");
}

/** `.visual/base` at `sha`, installed and with Loupe built. */
function prepareBase(sha: string): void {
  const registered = git(["worktree", "list", "--porcelain"]).split("\n").some((line) => line === `worktree ${BASE_TREE}`);
  // A `.visual` deleted by hand leaves git's registration of the worktree behind: prune it and start again.
  if (!registered || !existsSync(join(BASE_TREE, ".git"))) {
    git(["worktree", "prune"]);
    rmSync(BASE_TREE, { recursive: true, force: true });
    mkdirSync(WORK, { recursive: true });
    git(["worktree", "add", "--detach", BASE_TREE, sha]);
  } else if (git(["rev-parse", "HEAD"], BASE_TREE) !== sha) {
    git(["checkout", "--detach", "--force", sha], BASE_TREE);
    git(["clean", "-fd"], BASE_TREE);
    // Another commit's dev cache is no use, and a stale one is a risk.
    rmSync(join(BASE_TREE, "fixture/app/.next"), { recursive: true, force: true });
  }
  run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], BASE_TREE);
  run("pnpm", ["--filter", "@danarocha/loupe", "build"], BASE_TREE);
}

/**
 * Throws when Loupe's watch (`pnpm --filter @danarocha/loupe watch`) runs on `root`: it writes
 * into the `dist` the check builds, and the build's own test would only say so once `dist` is
 * rewritten. Its pid file is `packages/loupe/watch.ts`' `PID_FILE`.
 */
function assertWatchStopped(root: string): void {
  const file = join(root, "packages/loupe/node_modules/.cache/loupe-watch/pid");
  if (!existsSync(file)) return;
  const pid = Number(readFileSync(file, "utf8"));
  try {
    process.kill(pid, 0);
  } catch {
    return; // A stale pid: that watch has stopped.
  }
  throw new Error(`Loupe's watch is running in ${root} (pid ${pid}). Stop it first: the check builds Loupe.`);
}

async function main(): Promise<number> {
  const only = values.only;
  const ref = baseRef();
  // Before anything is built: a build of Loupe under a running `next dev` breaks it, and
  // Loupe's watch would write into the `dist` it builds.
  assertFixtureFree(REPO);
  assertWatchStopped(REPO);
  if (existsSync(BASE_TREE)) assertFixtureFree(BASE_TREE);
  const sha = git(["merge-base", "HEAD", ref]);
  const short = sha.slice(0, 12);
  const key = `${short}-${recorderHash()}`;
  const full = join(WORK, "runs", key);
  const complete = existsSync(join(full, "complete"));

  // A whole recording is kept and reused; one cut down by --only is made apart and never reused.
  let baseDir = full;
  if (complete && !values.update) {
    step(`Base ${short} (merge-base of HEAD and ${ref}): recorded already, in .visual/runs/${key}`);
  } else {
    if (only) baseDir = `${full}~${only.replace(/[^\w-]+/g, "-")}`;
    step(`Base ${short} (merge-base of HEAD and ${ref}): checking out, installing and building in .visual/base`);
    prepareBase(sha);
    step(`Recording the base into ${baseDir.slice(REPO.length + 1)}`);
    rmSync(baseDir, { recursive: true, force: true });
    await record(BASE_TREE, baseDir, only);
    if (!only) writeFileSync(join(baseDir, "complete"), "");
  }

  step("Head: building Loupe from the working tree");
  run("pnpm", ["--filter", "@danarocha/loupe", "build"], REPO);
  const headDir = join(WORK, "runs", "head");
  rmSync(headDir, { recursive: true, force: true });
  step("Recording the head into .visual/runs/head");
  await record(REPO, headDir, only);

  step("Comparing");
  const diffDir = join(WORK, "diff");
  rmSync(diffDir, { recursive: true, force: true });
  mkdirSync(diffDir, { recursive: true });
  const report = await compare(baseDir, headDir, diffDir, only);
  const dirty = git(["status", "--porcelain"]).length > 0;
  const title = `Visual check: ${dirty ? "the working tree" : git(["rev-parse", "--short=12", "HEAD"])} against ${short} (${ref})`;
  const text = markdown(report, title);
  writeFileSync(join(WORK, "report.md"), text);

  if (empty(report)) {
    throw new Error(only ? `--only ${only} selects no scene that both sides have: nothing was compared` : "nothing was compared: neither side recorded a scene");
  }
  const failed = failures(report);
  if (!failed) {
    process.stdout.write(`\n✓ No difference: ${report.compared} scenes, ${report.elements} elements and ${report.images} screenshots, identical to ${short}.\n`);
    if (report.added.length) process.stdout.write(`  New scenes, not compared: ${report.added.join(", ")}\n`);
    return 0;
  }
  process.stdout.write(`\n✗ ${failed} scene(s) differ from ${short}. Every difference: .visual/report.md; the pixels, red: .visual/diff/\n\n`);
  for (const s of report.scenes) {
    process.stdout.write(`  ${s.scene}\n`);
    for (const line of [...s.pixels, ...s.differences].slice(0, 8)) process.stdout.write(`    ${line}\n`);
    const more = s.pixels.length + s.differences.length - 8;
    if (more > 0) process.stdout.write(`    … and ${more} more\n`);
  }
  for (const s of report.removed) process.stdout.write(`  ${s}: only in the base\n`);
  return 1;
}

// The servers run in process groups of their own, so Ctrl+C reaches only this process: stop them on the way out.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    process.stderr.write(`\n✗ ${signal}: stopping the servers\n`);
    void stopAll().finally(() => process.exit(2));
  });
}

// 0: no difference. 1: a difference, the report says which. 2: the check couldn't run.
main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  },
);
