// `loupe remove` (PER-126): undoes what `init` and `generate` wrote, in a fixed
// order: the mount and `withLoupe`, then the Product layer, the Biome exclusion
// and the dependencies. Anything changed since Loupe wrote it is left alone and
// listed. The ledger is only read, and deleted with the layer's node_modules
// once nothing is left, so a second run picks up where the first stopped.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findRoot } from "../compat/repo.js";
import { LOCKFILE, NOTHING_WRITTEN, openGuard } from "../dirty-tree.js";
import {
  formatTooNew,
  judgeLayerFile,
  judgeTouchPoint,
  LEDGER_PATH,
  type Ledger,
  LedgerError,
  readLedger,
  type TouchPointEntry,
} from "../init/ledger.js";
import { PRODUCT_LAYER, type Role, type TouchPoint, type TouchPointId } from "../init/touch-points.js";
import { touchPoints } from "../init/touch-points/list.js";
import { version as installedVersion } from "../version.js";

export type RemoveOptions = { allowDirty: boolean; help?: boolean };

export const removeUsage = `Usage: loupe remove [options]

Undoes loupe init, in this order: the mount and withLoupe, the Product layer
(${PRODUCT_LAYER.path}), the Biome exclusion, then the dependencies, followed by
pnpm install. Anything changed since Loupe wrote it is left alone and listed.
If the mount or withLoupe stays, it stops before the Product layer, so the app
still builds. Rerun it after undoing what it lists. Works only inside git.

Options:
  --allow-dirty    proceed although a file remove would change has uncommitted changes

Exit codes: 0 everything removed · 1 refused, or something was left for you to undo`;

export function parseRemoveArgs(argv: readonly string[]): RemoveOptions | string {
  const options: RemoveOptions = { allowDirty: false };
  for (const arg of argv) {
    if (arg === "--allow-dirty") options.allowDirty = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else return `Unknown option: ${arg}`;
  }
  return options;
}

export type RemoveIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  cwd: string;
  /** Runs the package manager at the root; returns its exit status. */
  install?: (root: string) => number;
};

/** What `remove` does with one touch point. */
type Removal = { kind: "absent" } | { kind: "revert"; text: string; summary: string } | { kind: "kept"; why: string };

type Placed = { id: TouchPointId; role: Role; file: string };
/** `before`: the file as it is now, to put back if the install after it fails. */
type Revert = Placed & { kind: "revert"; text: string; summary: string; before: string };
/** `byHand`: how to take Loupe's edit out by hand. */
type Kept = Placed & { kind: "kept"; why: string; byHand: string };
type Step = Revert | Kept;
type LayerFile = { path: string; delete: boolean; why?: string };

/** Everything a run will do, worked out before anything is written. */
type Plan = {
  /** One per recorded touch point with something left to do, in the order they run. */
  steps: Step[];
  /** Touch points left that import the Product layer: everything after them waits. */
  holding: string[];
  layer: LayerFile[];
  /** Nothing is left to keep the ledger for. */
  clear: boolean;
};

const LAYER = PRODUCT_LAYER.path;
const isRevert = (s: Step): s is Revert => s.kind === "revert";
const isKept = (s: Step): s is Kept => s.kind === "kept";

export async function runRemove(options: RemoveOptions, io: RemoveIo): Promise<number> {
  const root = findRoot(path.resolve(io.cwd));
  const guard = openGuard("remove", root, options.allowDirty, io);
  if (!guard) return 1;
  if (!existsSync(path.join(root, LEDGER_PATH))) {
    io.out(`Nothing to remove: there is no ${LEDGER_PATH}, so loupe init hasn't run here.`);
    return 0;
  }
  let plan: Plan;
  try {
    plan = planRemoval(root, readRemovableLedger(root));
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    io.out(NOTHING_WRITTEN);
    return 1;
  }
  const reverts = plan.steps.filter(isRevert);
  const installs = reverts.some((s) => s.role === "adds-dependencies");

  // The dirty-tree rule, for the files this run would change only, so a second
  // run isn't stopped by what the first one left uncommitted.
  const guarded = [
    ...reverts.map((s) => s.file),
    ...plan.layer.filter((f) => f.delete).map((f) => f.path),
    ...(installs ? [LOCKFILE] : []),
    ...(plan.clear ? [LEDGER_PATH] : []),
  ];
  if (guard.refuses(guarded)) return 1;

  return execute(root, plan, io);
}

/** Reads the ledger and refuses one `remove` can't trust with deletes, or whose touch points it can't place. */
function readRemovableLedger(root: string): Ledger {
  const ledger = readLedger(root);
  const tooNew = formatTooNew(ledger, installedVersion);
  if (tooNew) throw new LedgerError(tooNew);
  const layer = ledger.productLayer?.path;
  // init records the app before any touch point, and the app says where each touch point is.
  const unplaced = (ledger.touchPoints?.length ?? 0) > 0 && typeof ledger.productLayer?.app !== "string";
  if ((layer !== undefined && layer !== LAYER) || !arrayOrMissing(ledger.touchPoints) || !arrayOrMissing(ledger.files) || unplaced) {
    throw notInits();
  }
  return ledger;
}

function notInits(): LedgerError {
  return new LedgerError(`${LEDGER_PATH} isn't one loupe init wrote. Fix or restore it with git, then rerun.`);
}

function arrayOrMissing(value: unknown): boolean {
  return value === undefined || Array.isArray(value);
}

/**
 * Works out the whole run: the touch points a role at a time (those that import the Product layer, then
 * the layer, then the one that excludes it, then the dependencies), each role in the reverse of init's order.
 * Throws a LedgerError for a recorded touch point it can't place.
 */
function planRemoval(root: string, ledger: Ledger): Plan {
  const entries = ledger.touchPoints ?? [];
  const app = ledger.productLayer?.app;
  const listed = app === undefined ? [] : touchPoints({ root, app, version: installedVersion, workspaceProtocol: "" });
  // A root touch point goes unlisted when the repo has no file for it, and its edit went with the file.
  // A recorded file that is still there although nothing lists it means the ledger was edited.
  for (const entry of entries) {
    if (!listed.some((t) => t.id === entry.id) && existsSync(path.join(root, entry.file))) throw notInits();
  }
  const plan: Plan = { steps: [], holding: [], layer: [], clear: false };
  const add = (role: Role, override: (v: Removal) => Removal = (v) => v) => {
    for (const tp of listed.filter((t) => t.role === role).reverse()) {
      const entry = entries.find((e) => e.id === tp.id);
      if (!entry) continue;
      const v = override(judge(root, ledger, entry, tp));
      const placed: Placed = { id: tp.id, role, file: entry.file };
      if (v.kind === "revert") {
        const before = readFileSync(path.join(root, entry.file), "utf8");
        plan.steps.push({ ...placed, kind: "revert", text: v.text, summary: v.summary, before });
      } else if (v.kind === "kept") {
        plan.steps.push({ ...placed, kind: "kept", why: v.why, byHand: tp.revertByHand });
      }
    }
  };

  add("imports-layer");
  plan.holding = plan.steps.filter(isKept).map((k) => k.file);
  if (plan.holding.length === 0) {
    plan.layer = layerInventory(root, ledger);
    const layerStays = plan.layer.some((f) => !f.delete);
    add("excludes-layer", (v) =>
      layerStays && v.kind === "revert" ? { kind: "kept", why: `${LAYER} still has files, so its exclusion stays` } : v,
    );
    add("adds-dependencies");
  }
  plan.clear = plan.holding.length === 0 && !plan.steps.some(isKept) && plan.layer.every((f) => f.delete);
  return plan;
}

function judge(root: string, ledger: Ledger, entry: TouchPointEntry, tp: TouchPoint): Removal {
  // A touch point now drawn from another file doesn't answer for this entry.
  const point = tp.file === entry.file ? tp : undefined;
  const verdict = judgeTouchPoint(root, ledger, entry, point);
  switch (verdict.kind) {
    case "unrecognised":
      return { kind: "kept", why: `loupe remove doesn't recognise ${entry.file} as this touch point any more` };
    // Deleted by hand, or nothing of Loupe's is left in it.
    case "missing":
      return { kind: "absent" };
    case "pending":
      return verdict.claim ? { kind: "kept", why: "a manual step loupe init never recorded (no --adopt)" } : { kind: "absent" };
    case "drift":
      return { kind: "kept", why: "changed since loupe init recorded it" };
    case "intact": {
      if (!point) throw new Error(`${entry.id}: judged intact without its touch point`);
      const reverted = point.revert(verdict.text);
      return "manual" in reverted ? { kind: "kept", why: reverted.manual } : { kind: "revert", ...reverted };
    }
    case "unclaimed":
    case "not-loupes":
      throw new Error(`${entry.id}: a ledger entry judged as unrecorded`);
  }
}

/** Every file in the Product layer, with whether it is still Loupe's own to delete. */
function layerInventory(root: string, ledger: Ledger): LayerFile[] {
  const list = (...args: string[]) =>
    execFileSync("git", ["ls-files", "-z", ...args, "--exclude-standard", "--", LAYER], { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  const out: LayerFile[] = [];
  for (const file of [...new Set(list("--cached", "--others"))].sort()) {
    // The ledger goes last.
    if (file === LEDGER_PATH) continue;
    const entry = ledger.files?.find((f) => f.path === path.posix.relative(LAYER, file));
    const verdict = judgeLayerFile(root, file, entry);
    // A file deleted by hand but still tracked needs nothing.
    if (verdict.kind === "missing") continue;
    if (verdict.kind === "intact") out.push({ path: file, delete: true });
    else if (verdict.kind === "drift") out.push({ path: file, delete: false, why: `edited since loupe ${verdict.by} wrote it` });
    else out.push({ path: file, delete: false, why: "not written by Loupe" });
  }
  // Ignored files carry no hash to check, so only pnpm's node_modules may go.
  const nodeModules = `${LAYER}/node_modules/`;
  for (const file of list("--others", "--ignored").sort()) {
    if (!file.startsWith(nodeModules)) out.push({ path: file, delete: false, why: "ignored by git, so Loupe can't tell who wrote it" });
  }
  return out;
}

function execute(root: string, plan: Plan, io: RemoveIo): number {
  const line = (mark: string, label: string, what: string) => io.out(`  ${mark} ${label.padEnd(13)}${what}`);
  /** Runs the steps under a heading, or says there is nothing left. */
  const report = (steps: Step[]) => {
    for (const s of steps) {
      if (isRevert(s)) {
        writeFileSync(path.join(root, s.file), s.text);
        line("-", s.id, `${s.file}: ${s.summary}`);
      } else {
        line("✗", s.id, `${s.file}: ${s.why}; left as is`);
        io.out(`      Undo your edit, or ${s.byHand}; then rerun loupe remove.`);
      }
    }
    if (steps.length === 0) io.out("  Nothing left to remove.");
  };
  const importers = plan.steps.filter((s) => s.role === "imports-layer");

  io.out("Mount and wrapper");
  report(importers);
  io.out("");

  let installFailed = false;
  if (plan.holding.length > 0) {
    const s = plan.holding.length === 1 ? "s" : "";
    io.err(
      `Stopped before the Product layer, the Biome exclusion and the dependencies: ${plan.holding.join(" and ")} still import${s} ${PRODUCT_LAYER.name}, so they stay and the app still builds.`,
    );
  } else {
    io.out(`Product layer ${LAYER} (${PRODUCT_LAYER.name})`);
    const deletes = plan.layer.filter((f) => f.delete);
    const kept = plan.layer.filter((f) => !f.delete);
    for (const f of deletes) rmSync(path.join(root, f.path), { force: true });
    pruneEmptyDirs(path.join(root, LAYER));
    if (deletes.length > 0) io.out(`  - ${deletes.length} file${deletes.length === 1 ? "" : "s"} removed`);
    for (const f of kept) io.out(`  ✗ ${f.path}: ${f.why}; left as is`);
    if (kept.length > 0) {
      const them = kept.length === 1 ? "it" : "them";
      io.out(`      Delete or move ${them} once you have what you need from ${them}, then rerun loupe remove.`);
    }
    if (plan.layer.length === 0) io.out("  Nothing left to remove.");
    io.out("");

    io.out("Biome exclusion and dependencies");
    report(plan.steps.filter((s) => s.role !== "imports-layer"));

    const dependencies = plan.steps.filter(isRevert).filter((s) => s.role === "adds-dependencies");
    if (dependencies.length > 0) {
      io.out("");
      io.out("Running pnpm install, which updates the lockfile…");
      const status = (io.install ?? pnpmInstall)(root);
      if (status !== 0) {
        installFailed = true;
        // Put the dependencies back, so the next run retries the install instead of skipping it.
        for (const s of dependencies) writeFileSync(path.join(root, s.file), s.before);
        const files = dependencies.map((s) => s.file).join(" and ");
        io.err(`pnpm install exited with ${status}, so ${files} keep${dependencies.length === 1 ? "s" : ""} the Loupe dependencies. Fix pnpm, then rerun loupe remove.`);
      }
    }
  }

  if (plan.clear && !installFailed) {
    rmSync(path.join(root, LEDGER_PATH), { force: true });
    rmSync(path.join(root, LAYER, "node_modules"), { recursive: true, force: true });
    pruneEmptyDirs(path.join(root, LAYER));
  }

  io.out("");
  if (importers.some(isRevert)) {
    io.out("Restart the dev server: a running next dev still has Loupe loaded. .next is left alone.");
  }
  const problems = plan.steps.filter(isKept).length + plan.layer.filter((f) => !f.delete).length;
  if (problems > 0) {
    io.err(`${problems} item${problems === 1 ? " was" : "s were"} left as is; loupe remove never overwrites a hand edit. Undo ${problems === 1 ? "it" : "them"}, then rerun loupe remove.`);
    return 1;
  }
  if (installFailed) return 1;
  io.out(plan.clear ? `Loupe is removed, ${LEDGER_PATH} included.` : "Nothing to remove.");
  return 0;
}

/** Removes directories left empty, deepest first; a directory holding anything stays. */
function pruneEmptyDirs(dir: string): boolean {
  if (!existsSync(dir)) return true;
  let empty = true;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && pruneEmptyDirs(path.join(dir, entry.name))) continue;
    empty = false;
  }
  if (empty) rmdirSync(dir);
  return empty;
}

function pnpmInstall(root: string): number {
  // pnpm defaults to a frozen lockfile under CI, which would refuse the change it exists to make.
  const result = spawnSync("pnpm", ["install", "--no-frozen-lockfile"], { cwd: root, stdio: "inherit" });
  return result.status ?? 1;
}
