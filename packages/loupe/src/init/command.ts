// `loupe init` (PER-124): the compatibility check, then the Product layer,
// the four touch points and `generate`, each init-written file recorded in the
// ledger before it is written. It never runs the package manager, so it never writes the lockfile.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type CheckIo, checkCompatibility } from "../compat/check.js";
import { findRoot, type PackageJson, readJson } from "../compat/repo.js";
import { runGenerate } from "../generate/command.js";
import { compareVersions, version as installedVersion } from "../version.js";
import {
  claimOf,
  type FileEntry,
  formatTooNew,
  judgeLayerFile,
  judgeTouchPoint,
  LEDGER_FORMAT_VERSION,
  LEDGER_PATH,
  type Ledger,
  LedgerError,
  readLedger,
  saveLedger,
  type TouchPointEntry,
} from "./ledger.js";
import { productLayerFiles } from "./product-layer.js";
import { fileHash, sha256 } from "./syntax.js";
import { NPM_PACKAGE, PRODUCT_LAYER, type TouchPoint, touchPoints } from "./touch-points.js";

export type InitOptions = { app?: string; allowDirty: boolean; adopt: boolean; help?: boolean };

/** A touch point needs a hand edit, then `loupe init --adopt`. */
export const EXIT_MANUAL = 2;

export const NOTHING_WRITTEN = "Nothing was written.";
export const LOCKFILE = "pnpm-lock.yaml";

export const initUsage = `Usage: loupe init [options]

Runs the compatibility check, creates the Product layer (${PRODUCT_LAYER.path}),
makes four edits (the app's package.json, next.config.ts, the root layout and the
Biome config), then runs loupe generate. Each edit is recorded in ${LEDGER_PATH}.
A rerun writes only what is missing; with a newer Loupe installed, it upgrades
the install. Loupe never writes the lockfile.

Options:
  --app <dir>      the app to install into (asked when there are several)
  --adopt          record touch points you edited by hand after a "manual step" message,
                   then run generate; edits nothing else
  --allow-dirty    proceed although a touch point, the lockfile or the Product layer has uncommitted changes

Exit codes: 0 done · 1 refused or something needs attention · ${EXIT_MANUAL} a manual step is needed`;

export function parseInitArgs(argv: readonly string[]): InitOptions | string {
  const options: InitOptions = { allowDirty: false, adopt: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--allow-dirty") options.allowDirty = true;
    else if (arg === "--adopt") options.adopt = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--app") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return "--app needs a directory, such as --app apps/app.";
      options.app = value;
      i += 1;
    } else if (arg.startsWith("--app=")) options.app = arg.slice("--app=".length);
    else return `Unknown option: ${arg}`;
  }
  return options;
}

export type InitIo = CheckIo & { cwd: string; nodeVersion: string; version?: string };

export async function runInit(options: InitOptions, io: InitIo): Promise<number> {
  const version = io.version ?? installedVersion;
  const root = findRoot(path.resolve(io.cwd));
  const git = gitTop(root);
  if (!git) {
    io.err(`${root} isn't inside a git repository. Loupe edits only files git can restore.`);
    io.out(NOTHING_WRITTEN);
    return 1;
  }

  let ledger: Ledger;
  try {
    ledger = readLedger(root);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    return 1;
  }
  const tooNew = formatTooNew(ledger, version);
  if (tooNew) {
    io.err(tooNew);
    io.out(NOTHING_WRITTEN);
    return 1;
  }
  // A newer Loupe is an upgrade: init reconciles every item, then moves the recorded version (ADR 0001).
  const recorded = ledger.loupe?.version;
  const order = recorded === undefined ? 0 : compareVersions(version, recorded);
  if (order < 0) {
    io.err(`${LEDGER_PATH} was written by Loupe ${recorded}; this is ${version}.`);
    io.err(`Install ${NPM_PACKAGE}@${recorded}.`);
    io.out(NOTHING_WRITTEN);
    return 1;
  }
  const upgrade: Upgrade | undefined = recorded !== undefined && order > 0 ? { from: recorded, to: version } : undefined;

  const knownApp = options.app ?? ledger.productLayer?.app;
  // The bump comes first: a newer Loupe run through `pnpm dlx` must not move an app still pinned to the old one.
  // Only a plain version is checked; a `catalog:` or `workspace:` pin is the person's own way to name it.
  if (upgrade && knownApp !== undefined) {
    const pin = dependency(readJson<PackageJson>(path.join(root, knownApp, "package.json")) ?? {}, NPM_PACKAGE);
    if (pin === undefined || (/^\d/.test(pin) && pin !== version)) {
      io.err(`${knownApp}/package.json has ${NPM_PACKAGE} ${pin ?? "missing"}, and this is Loupe ${version}.`);
      io.err(`To upgrade, set it to ${version}, run pnpm install, commit, then rerun loupe init.`);
      io.out(NOTHING_WRITTEN);
      return 1;
    }
  }
  // Before the check, so a refusal records nothing, and again once the app is known.
  // `--adopt` writes only the ledger and generate's output, so it skips this.
  const guard = !options.adopt;
  const bump = upgrade && knownApp !== undefined ? { ...upgrade, files: [LOCKFILE, `${knownApp}/package.json`] } : undefined;
  if (guard && refuseDirty(dirtyPaths(root, git, protectedPaths(root, knownApp, version)), options, io, ledger, bump)) {
    return 1;
  }

  const check = await checkCompatibility({
    cwd: root,
    app: knownApp,
    mode: "full",
    nodeVersion: io.nodeVersion,
    io,
  });
  if (!check.ok || !check.app) return 1;
  const app = check.app;
  // The check may have just recorded a yes in the ledger.
  ledger = readLedger(root);
  if (guard && knownApp === undefined) {
    // The ledger was clean before the check, which may have just written its yes there.
    const dirty = dirtyPaths(root, git, protectedPaths(root, app, version));
    dirty.blocking = dirty.blocking.filter((f) => f !== LEDGER_PATH);
    if (refuseDirty(dirty, options, io, ledger)) return 1;
  }
  if (!check.designSystem) {
    io.err(`Couldn't tell which design system ${app} uses.`);
    io.out(NOTHING_WRITTEN);
    return 1;
  }
  io.out("");

  const appJson = readJson<PackageJson>(path.join(root, app, "package.json")) ?? {};
  const protocol = workspaceProtocol(appJson);
  const dsName = readJson<PackageJson>(path.join(root, check.designSystem, "package.json"))?.name;
  const react = dependency(appJson, "react");
  const next = dependency(appJson, "next");
  if (!dsName || !react || !next) {
    io.err(`${app}/package.json must list react and next, and ${check.designSystem}/package.json must have a name.`);
    io.out(NOTHING_WRITTEN);
    return 1;
  }

  const run = new Run(root, ledger, io, upgrade, options.adopt);
  run.ledger.formatVersion ??= LEDGER_FORMAT_VERSION;
  // A first install records its version up front; an upgrade moves it last (Run.finish).
  run.ledger.loupe ??= { package: NPM_PACKAGE, version };
  run.ledger.productLayer = { app, name: PRODUCT_LAYER.name, path: PRODUCT_LAYER.path };
  const points = touchPoints({ root, app, version, workspaceProtocol: protocol });

  if (options.adopt) {
    io.out("Touch points");
    for (const tp of points) run.adopt(tp);
    if (!run.wrote && run.manual === 0) io.out("  Nothing to adopt.");
  } else {
    io.out(`Product layer ${PRODUCT_LAYER.path} (${PRODUCT_LAYER.name})`);
    const files = productLayerFiles({ version, designSystem: dsName, workspaceProtocol: protocol, react, next });
    for (const [file, content] of files) run.productFile(file, content);
    if (run.problems > 0) return run.finish();

    io.out("");
    io.out("Touch points");
    for (const tp of points) run.touchPoint(tp);
  }
  io.out("");

  // Last: its meta hashes the app's sources, the edited touch points included.
  const generated = runGenerate(
    {
      out: PRODUCT_LAYER.path,
      designSystem: check.designSystem,
      app,
      specifier: PRODUCT_LAYER.name,
      root,
      check: false,
      verbose: false,
    },
    root,
  );
  for (const line of generated.lines) (generated.ok ? io.out : io.err)(line);
  if (!generated.ok) run.problems += 1;
  if (generated.changes.length > 0) run.wrote = true;

  return run.finish();
}

/** An install moving from the recorded Loupe version to the newer one installed. */
type Upgrade = { from: string; to: string };

/**
 * One `init` run: the ledger in memory, written ahead of every file it describes. During an `upgrade`,
 * the recorded version moves last, and only when nothing was left blocked: no item left as is, no manual
 * step waiting. `--adopt` reconciles nothing else, so it never moves it.
 */
class Run {
  problems = 0;
  manual = 0;
  wrote = false;
  packageJsonChanged = false;

  constructor(
    readonly root: string,
    readonly ledger: Ledger,
    readonly io: InitIo,
    readonly upgrade: Upgrade | undefined,
    readonly adopting: boolean,
  ) {}

  private record(): void {
    if (saveLedger(this.root, this.ledger)) this.wrote = true;
  }

  private write(file: string, content: string): void {
    writeFileSync(path.join(this.root, file), content);
    this.wrote = true;
  }

  private setFile(entry: FileEntry): void {
    const files = (this.ledger.files ??= []);
    const at = files.findIndex((f) => f.path === entry.path);
    if (at === -1) files.push(entry);
    else files[at] = entry;
    this.record();
  }

  private setTouchPoint(entry: TouchPointEntry): void {
    const entries = (this.ledger.touchPoints ??= []);
    const at = entries.findIndex((t) => t.id === entry.id);
    if (at === -1) entries.push(entry);
    else entries[at] = entry;
    this.record();
  }

  productFile(file: string, content: string): void {
    const repoPath = `${PRODUCT_LAYER.path}/${file}`;
    const want = fileHash(content);
    const entry = this.ledger.files?.find((f) => f.path === file);
    const verdict = judgeLayerFile(this.root, repoPath, entry);
    const line = (mark: string, what: string) => this.io.out(`  ${mark} ${file.padEnd(14)}${what}`);

    if (verdict.kind !== "missing" && fileHash(verdict.text) === want) {
      if (entry?.sha256 !== want) {
        this.setFile({ path: file, sha256: want });
        line("✓", "already in place, recorded");
      }
      return;
    }
    // Only a file the ledger records as init's, unedited, may be overwritten.
    if (verdict.kind !== "missing" && !(verdict.kind === "intact" && verdict.by === "init")) {
      this.problems += 1;
      const edited = verdict.kind === "drift" && verdict.by === "init";
      line("✗", edited ? "edited by hand since loupe init wrote it; left as is" : "not written by loupe init; left as is");
      this.io.err(`    Restore ${repoPath} with git, or move it away, then rerun loupe init.`);
      return;
    }
    // Missing, or ours and unedited but out of date: recorded first, then written.
    this.setFile({ path: file, sha256: want });
    this.write(repoPath, content);
    line("+", verdict.kind === "missing" ? (entry ? "restored" : "written") : "updated");
  }

  touchPoint(tp: TouchPoint): void {
    const entry = this.ledger.touchPoints?.find((t) => t.id === tp.id);
    const verdict = judgeTouchPoint(this.root, this.ledger, entry, tp);
    const line = (mark: string, what: string) => this.io.out(`  ${mark} ${tp.id.padEnd(13)}${tp.file}: ${what}`);

    switch (verdict.kind) {
      case "intact":
        // A hash Loupe 0.0.4 or earlier recorded, with the Loupe version in it.
        if (entry && verdict.claim.hash !== entry.sha256) {
          this.setTouchPoint({ ...entry, sha256: verdict.claim.hash });
          line("✓", "recorded again, without Loupe's version in its hash");
        }
        return;
      case "drift":
        this.problems += 1;
        line("✗", "changed since loupe init recorded it; left as is");
        return;
      case "missing":
        this.apply(tp, verdict.text, line, "reapplied");
        return;
      case "pending":
      case "unclaimed": {
        // A pending step with no edit made yet: init makes it.
        if (!verdict.claim) {
          this.apply(tp, verdict.text, line, "");
          return;
        }
        if (verdict.claim.found.exact) {
          // Exactly what init writes. A pending manual step stays `manual`: a person made it.
          this.setTouchPoint({ id: tp.id, file: tp.file, mode: entry ? "manual" : "auto", sha256: verdict.claim.hash });
          line("✓", entry ? "adopted (manual)" : "already in place, recorded");
          return;
        }
        this.setTouchPoint({ id: tp.id, file: tp.file, mode: "manual", sha256: null });
        this.manual += 1;
        line("!", entry ? "edited by hand; check it, then adopt it" : "has a Loupe edit init didn't write");
        this.printManual(tp, "Check it against these instructions, then run loupe init --adopt:");
        return;
      }
      case "not-loupes":
        this.apply(tp, verdict.text, line, "");
        return;
      case "unrecognised":
        throw new Error(`${tp.id}: judged without its touch point`);
    }
  }

  /** `--adopt`: records a hand-made Loupe edit; touches no file but the ledger. */
  adopt(tp: TouchPoint): void {
    const entry = this.ledger.touchPoints?.find((t) => t.id === tp.id);
    const verdict = judgeTouchPoint(this.root, this.ledger, entry, tp);
    const pending = entry
      ? entry.mode === "manual" && verdict.kind === "pending"
      : verdict.kind === "unclaimed" && !verdict.claim.found.exact;
    if (!pending) return;
    const line = (mark: string, what: string) => this.io.out(`  ${mark} ${tp.id.padEnd(13)}${tp.file}: ${what}`);
    const claim = claimOf(verdict);
    if (!claim) {
      this.manual += 1;
      line("!", "no Loupe edit found to adopt");
      this.printManual(tp, "Make this edit by hand, then rerun loupe init --adopt:");
      return;
    }
    this.setTouchPoint({ id: tp.id, file: tp.file, mode: "manual", sha256: claim.hash });
    line("✓", "adopted (manual)");
  }

  private apply(tp: TouchPoint, text: string | undefined, line: (m: string, w: string) => void, verb: string): void {
    const edit = tp.edit(text);
    if ("unexpected" in edit) {
      this.setTouchPoint({ id: tp.id, file: tp.file, mode: "manual", sha256: null });
      this.manual += 1;
      line("!", `manual step needed: ${edit.unexpected}`);
      this.printManual(tp, "Make this edit by hand, then run loupe init --adopt:");
      return;
    }
    const found = tp.find(edit.text);
    this.setTouchPoint({ id: tp.id, file: tp.file, mode: "auto", sha256: found ? sha256(found.canonical) : null });
    this.write(tp.file, edit.text);
    if (tp.id === "package-json") this.packageJsonChanged = true;
    line("+", verb ? `${verb}: ${edit.summary}` : edit.summary);
  }

  private printManual(tp: TouchPoint, lead: string): void {
    this.io.out(`    ${lead}`);
    for (const l of tp.snippet) this.io.out(`    ${l}`);
  }

  finish(): number {
    const { io } = this;
    io.out("");
    const { upgrade } = this;
    const unfinished = (why: string) =>
      upgrade && `${LEDGER_PATH} stays at Loupe ${upgrade.from} ${why}. Then rerun loupe init to finish upgrading to ${upgrade.to}.`;
    if (this.problems > 0) {
      io.err(`${this.problems} item${this.problems === 1 ? "" : "s"} need${this.problems === 1 ? "s" : ""} attention; loupe init never overwrites them.`);
      const line = unfinished("until they are resolved");
      if (line) io.err(line);
      return 1;
    }
    const upgraded = upgrade !== undefined && this.manual === 0 && !this.adopting;
    if (upgraded) {
      this.ledger.loupe = { package: NPM_PACKAGE, version: upgrade.to };
      this.record();
    }
    const rerun = upgrade && !upgraded && this.manual === 0 ? `Rerun loupe init to finish upgrading to ${upgrade.to}.` : undefined;
    if (!this.wrote && this.manual === 0) {
      io.out(`Nothing to do: everything matches ${LEDGER_PATH}.`);
      if (rerun) io.out(rerun);
      return 0;
    }
    io.out(`Recorded in ${LEDGER_PATH}.`);
    if (upgraded) io.out(`Upgraded from Loupe ${upgrade.from} to ${upgrade.to}.`);
    if (this.packageJsonChanged) {
      io.out(`Next: run pnpm install to link ${PRODUCT_LAYER.name}. Loupe never writes the lockfile.`);
    }
    if (this.manual > 0) {
      io.out(
        `${this.manual} manual step${this.manual === 1 ? "" : "s"} needed. After making ${this.manual === 1 ? "it" : "them"}, run loupe init --adopt.`,
      );
      const line = unfinished("until the manual steps are recorded");
      if (line) io.out(line);
      return EXIT_MANUAL;
    }
    if (rerun) io.out(rerun);
    return 0;
  }
}

/** The files whose uncommitted changes stop `init`: what it may write, and the lockfile. */
function protectedPaths(root: string, app: string | undefined, version: string): string[] {
  const points = touchPoints({ root, app: app ?? "", version, workspaceProtocol: "" });
  // Without the app, only the root Biome config is known yet.
  const known = app === undefined ? points.filter((t) => t.id === "biome-config") : points;
  return [LOCKFILE, `${PRODUCT_LAYER.path}/`, ...known.map((t) => t.file)];
}

export type Dirty = { blocking: string[]; other: string[] };

export function dirtyPaths(root: string, git: string, guarded: string[]): Dirty {
  const out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  });
  const prefix = path.relative(realpathSync(git), realpathSync(root)).split(path.sep).join("/");
  const entries = out.split("\0");
  const dirty: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] ?? "";
    if (entry.length < 4) continue;
    const status = entry.slice(0, 2);
    const files = [entry.slice(3)];
    // A rename's source follows as its own entry, and is a change too.
    if (status.startsWith("R") || status.startsWith("C")) files.push(entries[++i] ?? "");
    for (const file of files) {
      if (!prefix) dirty.push(file);
      else if (file.startsWith(`${prefix}/`)) dirty.push(file.slice(prefix.length + 1));
    }
  }
  const blocks = (f: string) => guarded.some((g) => (g.endsWith("/") ? f.startsWith(g) : f === g));
  return { blocking: dirty.filter(blocks), other: dirty.filter((f) => !blocks(f)) };
}

/** An upgrade, and the files its version bump changes. */
type Bump = Upgrade & { files: string[] };

function refuseDirty(dirty: Dirty, options: InitOptions, io: InitIo, ledger: Ledger, bump?: Bump): boolean {
  if (dirty.blocking.length === 0) {
    if (dirty.other.length > 0) io.out(`Note: ${dirty.other.length} other file(s) have uncommitted changes; Loupe won't touch them.`);
    return false;
  }
  const list = (lead: string) => {
    io.err(lead);
    for (const f of dirty.blocking.slice(0, 20)) io.err(`  ${f}`);
    if (dirty.blocking.length > 20) io.err(`  … and ${dirty.blocking.length - 20} more`);
  };
  if (options.allowDirty) {
    list("Proceeding with uncommitted changes (--allow-dirty) in:");
    return false;
  }
  list("These files have uncommitted changes, and loupe init may write them:");
  if (bump && dirty.blocking.some((f) => bump.files.includes(f))) {
    io.err(`${LEDGER_PATH} records Loupe ${bump.from}, and ${bump.to} is installed: commit the version bump, then rerun loupe init.`);
  } else {
    io.err("Commit or stash them, or rerun with --allow-dirty.");
  }
  const pending = (ledger.touchPoints ?? []).filter((t) => t.mode === "manual" && !t.sha256);
  if (pending.some((t) => dirty.blocking.includes(t.file))) {
    io.err("If that is a manual step you just made, record it with loupe init --adopt.");
  }
  io.out(NOTHING_WRITTEN);
  return true;
}

export function gitTop(root: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function dependency(json: PackageJson, name: string): string | undefined {
  return json.dependencies?.[name] ?? json.devDependencies?.[name];
}

/** The `workspace:` prefix the app already uses most, `workspace:*` when it uses none. */
function workspaceProtocol(json: PackageJson): string {
  const tally = new Map<string, number>();
  for (const value of [...Object.values(json.dependencies ?? {}), ...Object.values(json.devDependencies ?? {})]) {
    if (value.startsWith("workspace:")) tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  return [...tally].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))[0]?.[0] ?? "workspace:*";
}
