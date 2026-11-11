// `loupe remove` (PER-126): undoes what `init` and `generate` wrote, in a fixed
// order: the mount and `withLoupe`, then the Product layer, the Biome exclusion
// and the dependencies. Anything changed since Loupe wrote it is left alone and
// listed. The ledger is only read, and deleted with the layer's node_modules
// once nothing is left, so a second run picks up where the first stopped.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LedgerError } from "../compat/ledger.js";
import { findRoot } from "../compat/repo.js";
import { readHeader } from "../generate/header.js";
import { dirtyPaths, gitTop, LOCKFILE, NOTHING_WRITTEN } from "../init/command.js";
import { type InitLedger, LEDGER_FORMAT_VERSION, LEDGER_PATH, readInitLedger, type TouchPointEntry } from "../init/ledger.js";
import { fileHash, sha256 } from "../init/syntax.js";
import {
  biomeConfig,
  EXCLUSION,
  PRODUCT_LAYER,
  type TouchPoint,
  type TouchPointId,
  touchPoints,
} from "../init/touch-points.js";
import { version as installedVersion } from "../version.js";
import { undo, undoByHand } from "./undo.js";

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

/** What happens to one touch point. */
type Verdict = { kind: "absent" } | { kind: "undo"; text: string } | { kind: "kept"; why: string };

type Write = { id: TouchPointId; file: string; text: string; before: string };
type Kept = { id: TouchPointId; file: string; why: string };
type LayerFile = { path: string; delete: boolean; why?: string };

/** Everything a run will do, worked out before anything is written. */
type Plan = {
  writes: Write[];
  kept: Kept[];
  /** Touch points left that import the Product layer: everything after them waits. */
  holding: string[];
  layer: LayerFile[];
  /** Nothing is left to keep the ledger for. */
  clear: boolean;
};

/** The touch points that import the Product layer: while one stays, the layer must stay. */
const IMPORTERS: TouchPointId[] = ["root-layout", "next-config"];
const LAYER = PRODUCT_LAYER.path;
const SUMMARY: Record<TouchPointId, string> = {
  "root-layout": "removed <LoupeMount /> and its import",
  "next-config": "unwrapped the default export and removed the withLoupe import",
  "biome-config": `removed the ${EXCLUSION} exclusion`,
  "package-json": "removed the two Loupe devDependencies",
};

export async function runRemove(options: RemoveOptions, io: RemoveIo): Promise<number> {
  const root = findRoot(path.resolve(io.cwd));
  const git = gitTop(root);
  if (!git) {
    io.err(`${root} isn't inside a git repository. Loupe removes only what git can restore.`);
    io.out(NOTHING_WRITTEN);
    return 1;
  }
  if (!existsSync(path.join(root, LEDGER_PATH))) {
    io.out(`Nothing to remove: there is no ${LEDGER_PATH}, so loupe init hasn't run here.`);
    return 0;
  }
  let ledger: InitLedger;
  try {
    ledger = readRemovableLedger(root);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    io.out(NOTHING_WRITTEN);
    return 1;
  }

  const plan = planRemoval(root, ledger);
  const installs = plan.writes.some((w) => w.id === "package-json");

  // The dirty-tree rule, for the files this run would change only, so a second
  // run isn't stopped by what the first one left uncommitted.
  const guarded = [
    ...plan.writes.map((w) => w.file),
    ...plan.layer.filter((f) => f.delete).map((f) => f.path),
    ...(installs ? [LOCKFILE] : []),
    ...(plan.clear ? [LEDGER_PATH] : []),
  ];
  const dirty = dirtyPaths(root, git, guarded).blocking;
  if (dirty.length > 0) {
    io.err(options.allowDirty ? "Proceeding with uncommitted changes (--allow-dirty) in:" : "These files have uncommitted changes, and loupe remove would change them:");
    for (const f of dirty.slice(0, 20)) io.err(`  ${f}`);
    if (dirty.length > 20) io.err(`  … and ${dirty.length - 20} more`);
    if (!options.allowDirty) {
      io.err("Commit or stash them, or rerun with --allow-dirty.");
      io.out(NOTHING_WRITTEN);
      return 1;
    }
  }

  return execute(root, plan, io);
}

/** Reads the ledger and refuses one `remove` can't trust with deletes. */
function readRemovableLedger(root: string): InitLedger {
  const ledger = readInitLedger(root);
  if ((ledger.formatVersion ?? LEDGER_FORMAT_VERSION) > LEDGER_FORMAT_VERSION) {
    throw new LedgerError(`${LEDGER_PATH} has formatVersion ${ledger.formatVersion}; this Loupe (${installedVersion}) reads ${LEDGER_FORMAT_VERSION}. Upgrade Loupe.`);
  }
  const layer = ledger.productLayer?.path;
  if ((layer !== undefined && layer !== LAYER) || !arrayOrMissing(ledger.touchPoints) || !arrayOrMissing(ledger.files)) {
    throw new LedgerError(`${LEDGER_PATH} isn't one loupe init wrote. Fix or restore it with git, then rerun.`);
  }
  return ledger;
}

function arrayOrMissing(value: unknown): boolean {
  return value === undefined || Array.isArray(value);
}

function planRemoval(root: string, ledger: InitLedger): Plan {
  const entries = ledger.touchPoints ?? [];
  const app = ledger.productLayer?.app ?? appOf(entries);
  const points = new Map(
    (app === undefined ? [] : touchPoints({ root, app, version: installedVersion, workspaceProtocol: "" })).map((t) => [t.id, t]),
  );
  const plan: Plan = { writes: [], kept: [], holding: [], layer: [], clear: false };
  const add = (id: TouchPointId, override?: (v: Verdict) => Verdict) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const tp = points.get(id) ?? (id === "biome-config" ? biomeConfig(entry.file) : undefined);
    const v = (override ?? ((x) => x))(judge(root, entry, tp));
    const abs = path.join(root, entry.file);
    if (v.kind === "undo") plan.writes.push({ id, file: entry.file, text: v.text, before: readFileSync(abs, "utf8") });
    else if (v.kind === "kept") plan.kept.push({ id, file: entry.file, why: v.why });
  };

  for (const id of IMPORTERS) add(id);
  plan.holding = plan.kept.map((k) => k.file);
  if (plan.holding.length === 0) {
    plan.layer = layerInventory(root, ledger);
    const layerStays = plan.layer.some((f) => !f.delete);
    add("biome-config", (v) =>
      layerStays && v.kind === "undo" ? { kind: "kept", why: `${LAYER} still has files, so its exclusion stays` } : v,
    );
    add("package-json");
  }
  plan.clear = plan.holding.length === 0 && plan.kept.length === 0 && plan.layer.every((f) => f.delete);
  return plan;
}

function judge(root: string, entry: TouchPointEntry, tp: TouchPoint | undefined): Verdict {
  const abs = path.join(root, entry.file);
  // Deleted by hand: nothing of Loupe's is left in it.
  if (!existsSync(abs)) return { kind: "absent" };
  if (!tp || tp.file !== entry.file) return { kind: "kept", why: `loupe remove doesn't recognise ${entry.file} as this touch point any more` };
  const text = readFileSync(abs, "utf8");
  const found = tp.find(text);
  if (!found) return { kind: "absent" };
  if (!entry.sha256) return { kind: "kept", why: "a manual step loupe init never recorded (no --adopt)" };
  if (sha256(found.canonical) !== entry.sha256) return { kind: "kept", why: "changed since loupe init recorded it" };
  const u = undo(tp, text);
  return "manual" in u ? { kind: "kept", why: u.manual } : { kind: "undo", text: u.text };
}

/** Every file in the Product layer, with whether it is still Loupe's own to delete. */
function layerInventory(root: string, ledger: InitLedger): LayerFile[] {
  const list = (...args: string[]) =>
    execFileSync("git", ["ls-files", "-z", ...args, "--exclude-standard", "--", LAYER], { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  const out: LayerFile[] = [];
  for (const file of [...new Set(list("--cached", "--others"))].sort()) {
    const abs = path.join(root, file);
    // The ledger goes last; a file deleted by hand but still tracked needs nothing.
    if (file === LEDGER_PATH || !existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    const entry = ledger.files?.find((f) => f.path === path.posix.relative(LAYER, file));
    if (entry) {
      const same = fileHash(content) === entry.sha256;
      out.push(same ? { path: file, delete: true } : { path: file, delete: false, why: "edited since loupe init wrote it" });
      continue;
    }
    const header = readHeader(content).kind;
    if (header === "intact") out.push({ path: file, delete: true });
    else out.push({ path: file, delete: false, why: header === "edited" ? "edited since loupe generate wrote it" : "not written by Loupe" });
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
  const report = (id: TouchPointId) => {
    const w = plan.writes.find((x) => x.id === id);
    if (w) {
      writeFileSync(path.join(root, w.file), w.text);
      line("-", id, `${w.file}: ${SUMMARY[id]}`);
    }
    const k = plan.kept.find((x) => x.id === id);
    if (k) {
      line("✗", id, `${k.file}: ${k.why}; left as is`);
      io.out(`      Undo your edit, or ${undoByHand[id]}; then rerun loupe remove.`);
    }
    return Boolean(w || k);
  };

  io.out("Mount and wrapper");
  if (!IMPORTERS.map(report).some(Boolean)) io.out("  Nothing left to remove.");
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
    const biome = report("biome-config");
    const deps = report("package-json");
    if (!biome && !deps) io.out("  Nothing left to remove.");

    const pkg = plan.writes.find((w) => w.id === "package-json");
    if (pkg) {
      io.out("");
      io.out("Running pnpm install, which updates the lockfile…");
      const status = (io.install ?? pnpmInstall)(root);
      if (status !== 0) {
        installFailed = true;
        // Put the dependencies back, so the next run retries the install instead of skipping it.
        writeFileSync(path.join(root, pkg.file), pkg.before);
        io.err(`pnpm install exited with ${status}, so ${pkg.file} keeps the Loupe dependencies. Fix pnpm, then rerun loupe remove.`);
      }
    }
  }

  if (plan.clear && !installFailed) {
    rmSync(path.join(root, LEDGER_PATH), { force: true });
    rmSync(path.join(root, LAYER, "node_modules"), { recursive: true, force: true });
    pruneEmptyDirs(path.join(root, LAYER));
  }

  io.out("");
  if (plan.writes.some((w) => IMPORTERS.includes(w.id))) {
    io.out("Restart the dev server: a running next dev still has Loupe loaded. .next is left alone.");
  }
  const problems = plan.kept.length + plan.layer.filter((f) => !f.delete).length;
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

function appOf(entries: TouchPointEntry[]): string | undefined {
  const pkg = entries.find((e) => e.id === "package-json")?.file;
  return pkg ? path.posix.dirname(pkg) : undefined;
}

function pnpmInstall(root: string): number {
  // pnpm defaults to a frozen lockfile under CI, which would refuse the change it exists to make.
  const result = spawnSync("pnpm", ["install", "--no-frozen-lockfile"], { cwd: root, stdio: "inherit" });
  return result.status ?? 1;
}
