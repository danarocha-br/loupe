import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseAdaptList } from "../adapt-list.js";
import { extract } from "../meta/command.js";
import { collectSources, compare } from "../meta/sources.js";
import type { ModuleMeta } from "../meta/types.js";
import { apply, type Change, diff, type Refusal } from "./apply.js";
import { type CoverageEntry, plan } from "./plan.js";

export type GenerateOptions = {
  /** Product layer directory (default `packages/loupe` under the repo root). */
  out?: string;
  /** Design-system package root; read from the existing adapt-list.json when omitted. */
  designSystem?: string;
  /** App root; read from the existing adapt-list.json when omitted. */
  app?: string;
  /** Import specifier of the Product layer; its package.json `name` when omitted. */
  specifier?: string;
  /** Repo root; the nearest directory holding `.git` when omitted. */
  root?: string;
  check: boolean;
  verbose: boolean;
};

export type GenerateResult = {
  ok: boolean;
  changes: Change[];
  refusals: Refusal[];
  unchanged: number;
  coverage: CoverageEntry[];
  lines: string[];
};

export const generateUsage = `Usage: loupe generate [options]

Writes Adapters, meta/ and adapt-list.json into the Product layer. Writes only
files whose bytes differ, and nothing at all when a generated file was edited by hand.

Options:
  --out <dir>             Product layer directory (default: packages/loupe)
  --design-system <dir>   design-system package root (default: from adapt-list.json)
  --app <dir>             app root (default: from adapt-list.json)
  --specifier <name>      import specifier of the Product layer (default: its package.json name)
  --root <dir>            repo root (default: the nearest directory holding .git)
  --check                 write nothing; exit 1 when output would change or a file was edited
  --verbose               list every component and what it became`;

export function parseGenerateArgs(argv: readonly string[]): GenerateOptions | string {
  const options: GenerateOptions = { check: false, verbose: false };
  const valued = { "--out": "out", "--design-system": "designSystem", "--app": "app", "--specifier": "specifier", "--root": "root" } as const;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--check") options.check = true;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg in valued) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return `Missing value for ${arg}`;
      options[valued[arg as keyof typeof valued]] = value;
      i += 1;
    } else return `Unknown option: ${arg}`;
  }
  return options;
}

export function runGenerate(options: GenerateOptions, cwd: string): GenerateResult {
  const repoRoot = path.resolve(cwd, options.root ?? findRepoRoot(cwd));
  const toRepo = (absolute: string) => path.relative(repoRoot, absolute).split(path.sep).join("/");
  const outAbs = path.resolve(cwd, options.out ?? path.join(repoRoot, "packages/loupe"));
  const outDir = toRepo(outAbs);
  if (outDir.startsWith("..")) throw new Error(`--out ${options.out} is outside the repo at ${repoRoot}`);

  const previous = readPreviousRoots(path.join(outAbs, "adapt-list.json"));
  const dsRoot = rootFlag(options.designSystem, cwd, toRepo) ?? previous?.designSystem;
  const appRoot = rootFlag(options.app, cwd, toRepo) ?? previous?.app;
  if (!dsRoot || !appRoot) {
    throw new Error("Name the design system and the app the first time: --design-system <dir> --app <dir>");
  }
  const specifier = options.specifier ?? previous?.specifier ?? packageName(outAbs);
  if (!specifier) throw new Error(`${outDir}/package.json has no name; pass --specifier <name>`);

  const dsAbs = path.join(repoRoot, dsRoot);
  const appAbs = path.join(repoRoot, appRoot);
  const modules = [
    ...readModules(path.join(dsAbs, "tsconfig.json"), ["components"], [], repoRoot),
    ...readModules(path.join(appAbs, "tsconfig.json"), ["."], [outAbs], repoRoot),
  ];
  const dsPackage = readPackage(dsAbs);
  const { files, coverage } = plan({
    outDir,
    specifier,
    designSystem: { root: dsRoot, packageName: dsPackage && !dsPackage.exports ? dsPackage.name : undefined },
    app: { root: appRoot },
    modules,
  });

  const { changes, refusals, unchanged } = diff(outAbs, files);
  const lines: string[] = [];
  if (options.verbose) lines.push(...coverageList(coverage));
  lines.push(...summary(coverage));

  if (refusals.length > 0) {
    for (const refusal of refusals) lines.push(refusalLine(outDir, refusal));
    lines.push(`Nothing written: ${refusals.length} file${refusals.length === 1 ? "" : "s"} in the way.`);
    return { ok: false, changes, refusals, unchanged, coverage, lines };
  }
  if (options.check) {
    for (const change of changes) lines.push(`${outDir}/${change.file}: ${checkReason(change)}. Run loupe generate.`);
    lines.push(
      changes.length === 0
        ? `Up to date: ${unchanged} files.`
        : `${changes.length} file${changes.length === 1 ? "" : "s"} out of date; nothing written.`,
    );
    return { ok: changes.length === 0, changes, refusals, unchanged, coverage, lines };
  }
  apply(outAbs, files, changes);
  const written = changes.filter((c) => c.action === "write").length;
  lines.push(`${written} written · ${changes.length - written} deleted · ${unchanged} unchanged in ${outDir}`);
  return { ok: true, changes, refusals, unchanged, coverage, lines };
}

/** Reads modules with the checker and rebases every path on the repo root. */
function readModules(tsconfig: string, include: string[], exclude: string[], repoRoot: string): ModuleMeta[] {
  if (!existsSync(tsconfig)) throw new Error(`No tsconfig.json at ${path.relative(repoRoot, tsconfig)}`);
  const sources = collectSources(tsconfig, include, exclude);
  const { modules } = extract(sources, "auto");
  const rebase = (relative: string) =>
    path.relative(repoRoot, path.resolve(sources.root, relative)).split(path.sep).join("/");
  return modules.map((module) => ({
    ...module,
    source: rebase(module.source),
    files: Object.fromEntries(
      Object.entries(module.files)
        .map(([file, hash]) => [rebase(file), hash] as const)
        .sort(([a], [b]) => compare(a, b)),
    ),
  }));
}

function summary(coverage: readonly CoverageEntry[]): string[] {
  const count = (outcome: string) => coverage.filter((entry) => entry.coverage.outcome === outcome);
  const reasons = (entries: CoverageEntry[]) => {
    const tally = new Map<string, number>();
    for (const entry of entries) {
      const reason = "reason" in entry.coverage ? entry.coverage.reason : "";
      tally.set(reason, (tally.get(reason) ?? 0) + 1);
    }
    return [...tally].sort(([a, x], [b, y]) => y - x || compare(a, b)).map(([r, n]) => `${n} ${r}`).join(" · ");
  };
  const adapters = count("adapter");
  const inspectOnly = count("inspect-only");
  const shape = count("skipped-by-shape");
  const lines = [`Coverage: ${adapters.length} Adapters · ${inspectOnly.length} Inspect only · ${shape.length} skipped by shape`];
  if (inspectOnly.length > 0) lines.push(`  Inspect only: ${reasons(inspectOnly)}`);
  if (shape.length > 0) lines.push(`  Skipped by shape: ${reasons(shape)}`);
  return lines;
}

function coverageList(coverage: readonly CoverageEntry[]): string[] {
  return coverage.map(({ source, name, coverage: c }) => {
    const what = c.outcome === "adapter" ? "Adapter" : c.outcome === "inspect-only" ? `Inspect only (${c.reason})` : `Skipped by shape (${c.reason})`;
    return `${source}#${name}: ${what}`;
  });
}

function refusalLine(outDir: string, { file, why }: Refusal): string {
  return why === "edited"
    ? `${outDir}/${file}: edited by hand since loupe generate wrote it. Delete it or git restore it, then rerun loupe generate.`
    : `${outDir}/${file}: not written by loupe generate, and generate needs this path. Move it away, then rerun loupe generate.`;
}

function checkReason(change: Change): string {
  if (change.why === "missing") return "missing";
  if (change.why === "stale") return "no longer generated";
  if (change.why === "formatVersion") return "written by another formatVersion";
  return "out of date";
}

function rootFlag(value: string | undefined, cwd: string, toRepo: (abs: string) => string): string | undefined {
  if (value === undefined) return undefined;
  const absolute = path.resolve(cwd, value);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Not a directory: ${value}`);
  return toRepo(absolute);
}

/** What an earlier run was told: its roots, and the specifier its Adapter paths start with. */
function readPreviousRoots(file: string): { designSystem?: string; app?: string; specifier?: string } | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const list = parseAdaptList(readFileSync(file, "utf8"), file);
    const adapter = Object.values(list.modules)[0]?.adapter;
    const at = adapter?.search(/\/adapters\/(ds|app)\//) ?? -1;
    return { designSystem: list.designSystem[0], app: list.app[0], specifier: at > 0 ? adapter?.slice(0, at) : undefined };
  } catch {
    return undefined;
  }
}

function readPackage(dir: string): { name?: string; exports?: unknown } | undefined {
  const file = path.join(dir, "package.json");
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as { name?: string; exports?: unknown };
}

function packageName(dir: string): string | undefined {
  return readPackage(dir)?.name;
}

function findRepoRoot(from: string): string {
  let dir = path.resolve(from);
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`No git repository above ${from}; pass --root <dir>`);
    dir = parent;
  }
}
