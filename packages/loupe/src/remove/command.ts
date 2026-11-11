// `loupe remove` (PER-126): undoes what `init` and `generate` wrote, in a fixed
// order: the mount and `withLoupe`, then the Product layer, the Biome exclusion
// and the dependencies. Anything changed since Loupe wrote it is left alone and
// listed. The ledger is only read, and deleted once nothing is left, so a
// second run picks up where the first stopped.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LedgerError } from "../compat/ledger.js";
import { findRoot } from "../compat/repo.js";
import { readHeader } from "../generate/header.js";
import { dirtyPaths, gitTop } from "../init/command.js";
import { type InitLedger, LEDGER_FORMAT_VERSION, LEDGER_PATH, readInitLedger, type TouchPointEntry } from "../init/ledger.js";
import { fileHash, sha256 } from "../init/syntax.js";
import { PRODUCT_LAYER, type TouchPoint, type TouchPointId, touchPoints } from "../init/touch-points.js";
import { version as installedVersion } from "../version.js";
import { undo, undoByHand } from "./undo.js";

export type RemoveOptions = { allowDirty: boolean; help?: boolean };

const NOTHING_WRITTEN = "Nothing was written.";
const LOCKFILE = "pnpm-lock.yaml";

export const removeUsage = `Usage: loupe remove [options]

Undoes loupe init, in this order: the mount and withLoupe, the Product layer
(${PRODUCT_LAYER.path}), the Biome exclusion, then the dependencies, followed by
pnpm install. Anything edited since Loupe wrote it is left alone and listed.
If the mount or withLoupe was edited, it stops before the Product layer, so
the app still builds. Rerun it after undoing what it lists.

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
  /** Runs the package manager at the root; resolves to its exit status. */
  install?: (root: string) => number;
};

/** What happens to one touch point. */
type Verdict =
  | { kind: "absent" }
  | { kind: "undo"; text: string }
  | { kind: "kept"; why: string };

/** The touch points that import the Product layer: while one stays, the layer must stay. */
const IMPORTERS: TouchPointId[] = ["root-layout", "next-config"];
const SUMMARY: Record<TouchPointId, string> = {
  "root-layout": "removed <LoupeMount /> and its import",
  "next-config": "unwrapped the default export and removed the withLoupe import",
  "biome-config": `removed the !${PRODUCT_LAYER.path} exclusion`,
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

  let ledger: InitLedger;
  try {
    ledger = readInitLedger(root);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    return 1;
  }
  if (!existsSync(path.join(root, LEDGER_PATH))) {
    io.out(`Nothing to remove: there is no ${LEDGER_PATH}, so loupe init hasn't run here.`);
    return 0;
  }
  if ((ledger.formatVersion ?? LEDGER_FORMAT_VERSION) > LEDGER_FORMAT_VERSION) {
    io.err(`${LEDGER_PATH} has formatVersion ${ledger.formatVersion}; this Loupe (${installedVersion}) reads ${LEDGER_FORMAT_VERSION}. Upgrade Loupe.`);
    io.out(NOTHING_WRITTEN);
    return 1;
  }

  const entries = ledger.touchPoints ?? [];
  const app = ledger.productLayer?.app ?? appOf(entries);
  const layer = ledger.productLayer?.path ?? PRODUCT_LAYER.path;
  const points = new Map(
    (app === undefined ? [] : touchPoints({ root, app, version: installedVersion, workspaceProtocol: "" })).map((t) => [t.id, t]),
  );
  const verdict = (id: TouchPointId): [TouchPointEntry, Verdict] | undefined => {
    const entry = entries.find((e) => e.id === id);
    return entry ? [entry, judge(root, entry, points.get(id))] : undefined;
  };

  // ── Plan: nothing is written until every step is known and the tree is checked.
  const plan = new Plan();
  const importers = IMPORTERS.map(verdict).filter((v) => v !== undefined);
  for (const [entry, v] of importers) plan.touchPoint(entry, v);
  const holding = importers.filter(([, v]) => v.kind === "kept").map(([e]) => e.file);

  let layerFiles: LayerFile[] = [];
  if (holding.length === 0) {
    layerFiles = productLayerFiles(root, layer, ledger);
    for (const f of layerFiles) if (f.delete) plan.deletes.push(f.path);
    const keptFiles = layerFiles.filter((f) => !f.delete);

    const biome = verdict("biome-config");
    if (biome) {
      const [entry, v] = biome;
      plan.touchPoint(
        entry,
        keptFiles.length > 0 && v.kind === "undo"
          ? { kind: "kept", why: `${layer} still has files, so its exclusion stays` }
          : v,
      );
    }
    const deps = verdict("package-json");
    if (deps) plan.touchPoint(...deps);
  }
  const clear = holding.length === 0 && plan.kept.length === 0 && layerFiles.every((f) => f.delete);
  const installs = plan.writes.some((w) => w.id === "package-json");

  // ── The dirty-tree rule: only the files this run would change.
  const guarded = [
    ...plan.writes.map((w) => w.file),
    ...plan.deletes,
    ...(installs ? [LOCKFILE] : []),
    ...(clear ? [LEDGER_PATH] : []),
  ];
  const dirty = dirtyPaths(root, git, guarded);
  if (dirty.blocking.length > 0) {
    io.err(options.allowDirty ? "Proceeding with uncommitted changes (--allow-dirty) in:" : "These files have uncommitted changes, and loupe remove would change them:");
    for (const f of dirty.blocking.slice(0, 20)) io.err(`  ${f}`);
    if (dirty.blocking.length > 20) io.err(`  … and ${dirty.blocking.length - 20} more`);
    if (!options.allowDirty) {
      io.err("Commit or stash them, or rerun with --allow-dirty.");
      io.out(NOTHING_WRITTEN);
      return 1;
    }
  }

  // ── Execute, in order.
  const line = (mark: string, id: string, what: string) => io.out(`  ${mark} ${id.padEnd(13)}${what}`);
  const report = (id: TouchPointId) => {
    const w = plan.writes.find((x) => x.id === id);
    if (w) {
      writeFileSync(path.join(root, w.file), w.text);
      line("-", id, `${w.file}: ${SUMMARY[id]}`);
      return;
    }
    const k = plan.kept.find((x) => x.id === id);
    if (k) {
      line("✗", id, `${k.file}: ${k.why}; left as is`);
      io.out(`      Undo your edit, or ${undoByHand[id]}; then rerun loupe remove.`);
    }
  };

  io.out("Mount and wrapper");
  for (const id of IMPORTERS) report(id);
  if (!importers.some(([, v]) => v.kind !== "absent")) io.out("  Nothing left to remove.");

  let problems = plan.kept.length;
  if (holding.length > 0) {
    io.out("");
    io.err(`Stopped before the Product layer, the Biome exclusion and the dependencies: ${holding.join(" and ")} still import${holding.length === 1 ? "s" : ""} ${PRODUCT_LAYER.name}, so they stay and the app still builds.`);
  } else {
    io.out("");
    io.out(`Product layer ${layer} (${PRODUCT_LAYER.name})`);
    for (const f of plan.deletes) rmSync(path.join(root, f), { force: true });
    pruneEmptyDirs(path.join(root, layer));
    const deleted = plan.deletes.length;
    if (deleted > 0) io.out(`  - ${deleted} file${deleted === 1 ? "" : "s"} removed`);
    for (const f of layerFiles.filter((x) => !x.delete)) {
      problems += 1;
      io.out(`  ✗ ${f.path}: ${f.why}; left as is`);
    }
    const kept = layerFiles.filter((f) => !f.delete).length;
    if (kept > 0) {
      const them = kept === 1 ? "it" : "them";
      io.out(`      Delete or move ${them} once you have what you need from ${them}, then rerun loupe remove.`);
    }
    if (deleted === 0 && layerFiles.length === 0) io.out("  Nothing left to remove.");

    io.out("");
    io.out("Biome exclusion and dependencies");
    report("biome-config");
    report("package-json");
    if (!plan.writes.some((w) => w.id === "biome-config" || w.id === "package-json") &&
      !plan.kept.some((k) => k.id === "biome-config" || k.id === "package-json")) {
      io.out("  Nothing left to remove.");
    }
  }

  let installFailed = false;
  if (installs) {
    io.out("");
    io.out("Running pnpm install, which updates the lockfile…");
    const status = (io.install ?? pnpmInstall)(root);
    if (status !== 0) {
      installFailed = true;
      io.err(`pnpm install exited with ${status}. Run it yourself to update ${LOCKFILE}; ${LEDGER_PATH} stays until then.`);
    }
  }

  if (clear && problems === 0 && !installFailed) {
    rmSync(path.join(root, LEDGER_PATH), { force: true });
    // What is left is only what git ignores, such as the layer's node_modules.
    rmSync(path.join(root, layer), { recursive: true, force: true });
  }

  io.out("");
  if (plan.writes.some((w) => IMPORTERS.includes(w.id))) {
    io.out("Restart the dev server: a running next dev still has Loupe loaded. .next is left alone.");
  }
  if (problems > 0) {
    io.err(`${problems} item${problems === 1 ? " was" : "s were"} left as is; loupe remove never overwrites a hand edit. Undo ${problems === 1 ? "it" : "them"}, then rerun loupe remove.`);
    return 1;
  }
  if (installFailed) return 1;
  io.out(clear ? `Loupe is removed, ${LEDGER_PATH} included.` : "Nothing to remove.");
  return 0;
}

class Plan {
  writes: { id: TouchPointId; file: string; text: string }[] = [];
  deletes: string[] = [];
  kept: { id: TouchPointId; file: string; why: string }[] = [];

  touchPoint(entry: TouchPointEntry, v: Verdict): void {
    if (v.kind === "undo") this.writes.push({ id: entry.id, file: entry.file, text: v.text });
    else if (v.kind === "kept") this.kept.push({ id: entry.id, file: entry.file, why: v.why });
  }
}

function judge(root: string, entry: TouchPointEntry, tp: TouchPoint | undefined): Verdict {
  if (!tp || tp.file !== entry.file) return { kind: "kept", why: `loupe remove can't find this touch point at ${entry.file} any more` };
  const abs = path.join(root, entry.file);
  const text = existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
  const found = text === undefined ? undefined : tp.find(text);
  if (text === undefined || !found) return { kind: "absent" };
  if (!entry.sha256) return { kind: "kept", why: "a manual step loupe init never recorded (no --adopt)" };
  if (sha256(found.canonical) !== entry.sha256) return { kind: "kept", why: "changed since loupe init recorded it" };
  const u = undo(tp, text);
  return "manual" in u ? { kind: "kept", why: u.manual } : { kind: "undo", text: u.text };
}

type LayerFile = { path: string; delete: boolean; why?: string };

/** Every file in the Product layer git doesn't ignore, with whether it is still Loupe's own. */
function productLayerFiles(root: string, layer: string, ledger: InitLedger): LayerFile[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", layer], {
    cwd: root,
    encoding: "utf8",
  });
  const files = [...new Set(listed.split("\0").filter(Boolean))].filter((f) => f !== LEDGER_PATH).sort();
  const out: LayerFile[] = [];
  for (const file of files) {
    const abs = path.join(root, file);
    // Deleted by hand but still tracked: nothing to do.
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    const rel = path.posix.relative(layer, file);
    const entry = ledger.files?.find((f) => f.path === rel);
    if (entry) {
      const same = fileHash(content) === entry.sha256;
      out.push({ path: file, delete: same, ...(same ? {} : { why: "edited since loupe init wrote it" }) });
      continue;
    }
    const header = readHeader(content);
    if (header.kind === "intact") out.push({ path: file, delete: true });
    else if (header.kind === "edited") out.push({ path: file, delete: false, why: "edited since loupe generate wrote it" });
    else out.push({ path: file, delete: false, why: "not written by Loupe" });
  }
  return out;
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
  const result = spawnSync("pnpm", ["install"], { cwd: root, stdio: "inherit" });
  return result.status ?? 1;
}
