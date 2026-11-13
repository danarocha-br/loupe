// `loupe doctor` (PER-127): the read-only checks of an install (PER-93), and
// with `--build`, a production build scanned for any trace of Loupe. Plain
// `doctor` writes nothing at all: drift is listed, never repaired.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ADAPT_LIST_FORMAT_VERSION, parseAdaptList } from "../adapt-list.js";
import { checkCompatibility } from "../compat/check.js";
import { findRoot, type PackageJson, readJson } from "../compat/repo.js";
import { runGenerate } from "../generate/command.js";
import { GENERATE_FORMAT_VERSION } from "../generate/header.js";
import {
  judgeLayerFile,
  judgeTouchPoint,
  LEDGER_FORMAT_VERSION,
  LEDGER_PATH,
  type Ledger,
  LedgerError,
  readLedger,
} from "../init/ledger.js";
import { NPM_PACKAGE, PRODUCT_LAYER, touchPoints } from "../init/touch-points.js";
import { compare } from "../meta/sources.js";
import { version as installedVersion } from "../version.js";
import { type BuildRunner, nextBuild, scanBuild } from "./build.js";

export type DoctorOptions = { build: boolean; help?: boolean };

export type DoctorIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  cwd: string;
  nodeVersion: string;
  /** The running CLI's version; the installed one by default. */
  version?: string;
  /** Runs `next build` in the app; tests replace it. */
  build?: BuildRunner;
};

export const doctorUsage = `Usage: loupe doctor [--build]

Checks the install recorded in ${LEDGER_PATH} and writes nothing: the
compatibility check, the Loupe versions, the four touch points, the Product
layer's files, and what the Product layer must resolve. A touch point or a
generated file changed by hand is listed as drift and left as it is.

Options:
  --build   also run \`next build\` in the app, under Node, and scan .next for any
            trace of Loupe. This writes the app's .next, as any build does, and
            Next may also rewrite next-env.d.ts or tsconfig.json.

Exit codes: 0 healthy · 1 something needs attention`;

export function parseDoctorArgs(argv: readonly string[]): DoctorOptions | string {
  const options: DoctorOptions = { build: false };
  for (const arg of argv) {
    if (arg === "--build") options.build = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else return `Unknown option: ${arg}`;
  }
  return options;
}

/** Items listed under a heading; a failure is a problem, a warning is not. */
class Report {
  problems = 0;
  warnings = 0;

  constructor(readonly io: DoctorIo) {}

  heading(text: string): void {
    this.io.out("");
    this.io.out(text);
  }
  ok(text: string): void {
    this.io.out(`  ✓ ${text}`);
  }
  warn(text: string, details: string[] = []): void {
    this.warnings += 1;
    this.io.out(`  ! ${text}`);
    this.list(details);
  }
  fail(text: string, details: string[] = []): void {
    this.problems += 1;
    this.io.out(`  ✗ ${text}`);
    this.list(details);
  }
  note(text: string): void {
    this.io.out(`    ${text}`);
  }
  private list(details: string[]): void {
    for (const d of details.slice(0, 20)) this.note(d);
    if (details.length > 20) this.note(`… and ${details.length - 20} more`);
  }
}

export async function runDoctor(options: DoctorOptions, io: DoctorIo): Promise<number> {
  const version = io.version ?? installedVersion;
  const root = findRoot(path.resolve(io.cwd));
  let ledger: Ledger;
  try {
    ledger = readLedger(root);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    return 1;
  }
  const layer = ledger.productLayer;
  if (!layer) {
    io.err(`Loupe isn't installed here: ${LEDGER_PATH} records no install. Run loupe init.`);
    return 1;
  }
  const report = new Report(io);
  io.out(`Loupe doctor — ${layer.app}`);
  io.out("");

  // 9. The compatibility check, rerun: it never asks or writes in this mode.
  const adaptList = readAdaptList(root, layer.path);
  const check = await checkCompatibility({
    cwd: root,
    app: layer.app,
    designSystem: adaptList?.designSystem[0],
    mode: "report",
    nodeVersion: io.nodeVersion,
    io: { out: io.out, err: io.out, ask: async () => "" },
  });
  if (!check.ok) report.problems += 1;

  versions(report, root, ledger, layer.app, version, adaptList);
  touchPointChecks(report, root, ledger, layer.app, version);
  productLayerChecks(report, root, ledger, layer.path);
  resolution(report, root, layer.path, layer.app);

  if (options.build) await buildCheck(report, root, layer.app, io);

  io.out("");
  if (report.problems > 0) {
    const n = report.problems;
    io.err(`Result: ${n} problem${n === 1 ? "" : "s"}. loupe doctor changed nothing${options.build ? " but the app's .next" : ""}.`);
    return 1;
  }
  const warned = report.warnings > 0 ? `, with ${report.warnings} warning${report.warnings === 1 ? "" : "s"}` : "";
  io.out(`Result: healthy${warned}. loupe doctor changed nothing${options.build ? " but the app's .next" : ""}.`);
  return 0;
}

type AdaptListRoots = { designSystem: string[]; app: string[]; formatVersion?: number };

function readAdaptList(root: string, layerPath: string): AdaptListRoots | undefined {
  const file = path.join(root, layerPath, "adapt-list.json");
  if (!existsSync(file)) return undefined;
  const text = readFileSync(file, "utf8");
  try {
    return parseAdaptList(text, `${layerPath}/adapt-list.json`);
  } catch {
    // A newer format fails to parse; its formatVersion is still worth reporting.
    try {
      const raw = JSON.parse(text) as Partial<AdaptListRoots>;
      return { designSystem: raw.designSystem ?? [], app: raw.app ?? [], formatVersion: raw.formatVersion };
    } catch {
      return undefined;
    }
  }
}

// 1 and 2. One Loupe version everywhere, and formats this CLI can read.
function versions(
  report: Report,
  root: string,
  ledger: Ledger,
  app: string,
  cli: string,
  adaptList: AdaptListRoots | undefined,
): void {
  report.heading("Versions");
  const appJson = readJson<PackageJson>(path.join(root, app, "package.json")) ?? {};
  const installed = packageDir(path.join(root, app), NPM_PACKAGE);
  const seen: [string, string | undefined][] = [
    [`${app}/package.json`, appJson.devDependencies?.[NPM_PACKAGE] ?? appJson.dependencies?.[NPM_PACKAGE]],
    ["the ledger", ledger.loupe?.version],
    [`${app}/node_modules`, installed && readJson<PackageJson & { version?: string }>(path.join(installed, "package.json"))?.version],
    ["this CLI", cli],
  ];
  const values = new Set(seen.map(([, v]) => v));
  if (values.size === 1 && !values.has(undefined)) {
    report.ok(`Loupe ${cli} in ${seen.map(([where]) => where).join(", ")}`);
  } else {
    report.fail(
      `Loupe versions differ`,
      seen.map(([where, v]) => `${where}: ${v ?? "missing"}`).concat(`Install ${NPM_PACKAGE} exact-pinned, run pnpm install, and run the CLI from that copy.`),
    );
  }

  const ledgerFormat = ledger.formatVersion;
  const listFormat = adaptList?.formatVersion ?? (adaptList ? ADAPT_LIST_FORMAT_VERSION : undefined);
  const formats: string[] = [];
  if (ledgerFormat === undefined || ledgerFormat > LEDGER_FORMAT_VERSION) {
    formats.push(`${LEDGER_PATH}: formatVersion ${ledgerFormat ?? "missing"}, this Loupe reads ${LEDGER_FORMAT_VERSION}`);
  }
  if (listFormat !== undefined && listFormat > ADAPT_LIST_FORMAT_VERSION) {
    formats.push(`adapt-list.json: formatVersion ${listFormat}, this Loupe reads ${ADAPT_LIST_FORMAT_VERSION}`);
  }
  if (formats.length > 0) report.fail("A format this Loupe can't read", formats.concat("Upgrade Loupe."));
  else report.ok(`Ledger formatVersion ${ledgerFormat}${listFormat === undefined ? "" : `, adapt-list formatVersion ${listFormat}`}`);
}

// 3 and 8. Each touch point present with the hash init recorded; the Biome exclusion is one of them.
function touchPointChecks(report: Report, root: string, ledger: Ledger, app: string, version: string): void {
  report.heading("Touch points");
  const points = touchPoints({ root, app, version, workspaceProtocol: "" });
  const recorded = ledger.touchPoints ?? [];
  const ids = new Set(points.map((t) => t.id));
  for (const tp of points) {
    const entry = recorded.find((t) => t.id === tp.id);
    const label = `${tp.id.padEnd(13)}${tp.file}`;
    const verdict = judgeTouchPoint(root, entry, tp);
    switch (verdict.kind) {
      case "unclaimed":
      case "not-loupes":
        report.fail(`${label}: not in the ledger`, ["Run loupe init."]);
        break;
      case "pending":
        report.fail(`${label}: manual step not recorded yet`, ["Make the edit loupe init printed, then run loupe init --adopt."]);
        break;
      case "missing":
      case "unrecognised":
        report.fail(`${label}: Loupe's edit is missing`, ["Run loupe init to reapply it."]);
        break;
      case "drift":
        report.fail(`${label}: drift, changed by hand since loupe init recorded it`, [
          "Left as it is. Undo the change, or remove and reinstall Loupe.",
        ]);
        break;
      case "intact":
        report.ok(`${label}${entry?.mode === "manual" ? " (manual)" : ""}`);
        break;
    }
  }
  if (!ids.has("biome-config")) report.ok("No root Biome config, so no Biome exclusion is needed");
  // A ledger entry for a file that no longer exists, such as a deleted biome.jsonc.
  for (const entry of recorded) {
    if (!ids.has(entry.id)) report.fail(`${entry.id.padEnd(13)}${entry.file}: the file is gone`, ["Restore it, or run loupe init."]);
  }
}

// 4 and 5. init's files match the ledger; generate's match their headers and their sources.
function productLayerChecks(report: Report, root: string, ledger: Ledger, layerPath: string): void {
  report.heading(`Product layer ${layerPath}`);
  const files = ledger.files ?? [];
  const drift: string[] = [];
  const missing: string[] = [];
  for (const entry of files) {
    const verdict = judgeLayerFile(root, path.posix.join(layerPath, entry.path), entry);
    if (verdict.kind === "missing") missing.push(entry.path);
    else if (verdict.kind === "drift") drift.push(entry.path);
  }
  if (files.length === 0) report.fail("The ledger lists none of loupe init's files", ["Run loupe init."]);
  else if (drift.length === 0 && missing.length === 0) report.ok(`${files.length} files from loupe init match the ledger`);
  if (missing.length > 0) report.fail(`${missing.length} of loupe init's files missing`, [...missing, "Run loupe init."]);
  if (drift.length > 0) {
    report.fail(`${drift.length} of loupe init's files changed by hand (drift)`, [...drift, "Left as they are: git restore them."]);
  }

  if (!existsSync(path.join(root, layerPath, "adapt-list.json"))) {
    report.fail("adapt-list.json is missing", ["Run loupe generate."]);
    return;
  }
  let generated: ReturnType<typeof runGenerate>;
  try {
    generated = runGenerate({ out: layerPath, root, check: true, verbose: false }, root);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.fail(`loupe generate's files can't be checked: ${message}`);
    return;
  }
  const edited = generated.refusals.filter((r) => r.why === "edited").map((r) => r.file);
  const foreign = generated.refusals.filter((r) => r.why === "foreign").map((r) => r.file);
  const absent = generated.changes.filter((c) => c.why === "missing").map((c) => c.file);
  const leftover = generated.changes.filter((c) => c.why === "leftover").map((c) => c.file);
  // A file stamped by a newer generate is not stale: this Loupe would overwrite it with an older format.
  const newer = generated.changes
    .filter((c) => c.why === "formatVersion" && headerVersion(path.join(root, layerPath, c.file)) > GENERATE_FORMAT_VERSION)
    .map((c) => c.file);
  const stale = generated.changes.filter(
    (c) => c.why === "changed" || c.why === "stale" || (c.why === "formatVersion" && !newer.includes(c.file)),
  );

  if (edited.length === 0 && foreign.length === 0 && absent.length === 0 && leftover.length === 0 && newer.length === 0) {
    report.ok(`${generated.unchanged + stale.length} files from loupe generate, none edited by hand`);
  }
  if (newer.length > 0) {
    report.fail(`${newer.length} generated file${newer.length === 1 ? "" : "s"} written by a newer Loupe`, [...newer, "Upgrade Loupe."]);
  }
  if (edited.length > 0) {
    report.fail(`${edited.length} generated file${edited.length === 1 ? "" : "s"} edited by hand (drift)`, [
      ...edited,
      "Left as they are. Delete or git restore them, then run loupe generate.",
    ]);
  }
  if (foreign.length > 0) {
    // Also what a generated file looks like once a hand edit removed its header.
    report.fail(`${foreign.length} file${foreign.length === 1 ? "" : "s"} without loupe generate's header where it needs to write (drift)`, [
      ...foreign,
      "Left as they are. Move them away or git restore them, then run loupe generate.",
    ]);
  }
  if (absent.length > 0) report.fail(`${absent.length} generated file${absent.length === 1 ? "" : "s"} missing`, [...absent, "Run loupe generate."]);
  if (leftover.length > 0) {
    report.fail(`${leftover.length} file${leftover.length === 1 ? "" : "s"} left by an interrupted loupe generate`, [...leftover, "Run loupe generate."]);
  }
  if (stale.length > 0) {
    // The app still runs on the older Adapters, so this is a warning, not a failure.
    report.warn(`${stale.length} generated file${stale.length === 1 ? "" : "s"} out of date with the sources`, [
      ...stale.map((c) => (c.why === "stale" ? `${c.file} (its component is gone)` : c.file)),
      "Run loupe generate.",
    ]);
  }
}

/** `from "./x"`, `import "./x"` and `import("./x")`. */
const RELATIVE_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
const isFile = (file: string) => statSync(file, { throwIfNoEntry: false })?.isFile() === true;

// 6 and 7. The app Adapters' relative imports, and the packages each side needs.
function resolution(report: Report, root: string, layerPath: string, app: string): void {
  report.heading("Resolution");
  const layerAbs = path.join(root, layerPath);
  const appAdapters = path.join(layerAbs, "adapters", "app");
  const broken: string[] = [];
  let count = 0;
  for (const file of walk(appAdapters)) {
    if (!/\.[jt]sx?$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const [, specifier] of text.matchAll(RELATIVE_IMPORT)) {
      if (specifier === undefined) continue;
      count += 1;
      const target = path.resolve(path.dirname(file), specifier);
      if (!EXTENSIONS.some((ext) => isFile(target + ext))) {
        broken.push(`${path.relative(layerAbs, file).split(path.sep).join("/")} imports ${specifier}`);
      }
    }
  }
  if (broken.length > 0) {
    report.fail(`${broken.length} relative import${broken.length === 1 ? "" : "s"} of app Adapters don't resolve`, [
      ...broken,
      "The component moved: run loupe generate.",
    ]);
  } else report.ok(`${count} relative import${count === 1 ? "" : "s"} of app Adapters resolve`);

  const layerJson = readJson<PackageJson & { peerDependencies?: Record<string, string> }>(path.join(layerAbs, "package.json"));
  const needs: [string, string, string[]][] = [
    [
      layerPath,
      layerAbs,
      [...Object.keys(layerJson?.dependencies ?? {}), ...Object.keys(layerJson?.peerDependencies ?? {})].sort(compare),
    ],
    [app, path.join(root, app), [NPM_PACKAGE, PRODUCT_LAYER.name].sort(compare)],
  ];
  for (const [label, dir, names] of needs) {
    if (names.length === 0) continue;
    const unresolved = names.filter((name) => !packageDir(dir, name));
    if (unresolved.length === 0) report.ok(`${label} resolves ${names.join(", ")}`);
    else report.fail(`${label} can't resolve ${unresolved.join(", ")}`, ["Run pnpm install."]);
  }
}

// 10. Opt-in: a production build, scanned.
async function buildCheck(report: Report, root: string, app: string, io: DoctorIo): Promise<void> {
  report.heading("Production build");
  const appAbs = path.join(root, app);
  const runner = io.build ?? nextBuild;
  const result = await runner(appAbs, io);
  if (result.code !== 0) {
    report.fail(`next build failed (${result.describe}); exit ${result.code}`);
    return;
  }
  report.ok(`next build passed (${result.describe})`);
  const scan = scanBuild(path.join(appAbs, ".next"));
  if (!scan.found) {
    report.fail(`Can't find a build to scan: no ${app}/.next/required-server-files.json`, [
      "doctor --build reads .next; a custom distDir or output: \"export\" isn't supported.",
    ]);
    return;
  }
  report.note(`Scanned ${scan.files} files in ${app}/.next (skipping .next/cache, .next/dev and source maps).`);
  for (const [needle, files] of scan.hits) {
    if (files.length === 0) report.ok(`No "${needle}" in .next`);
    else report.fail(`"${needle}" found in ${files.length} file${files.length === 1 ? "" : "s"}`, files);
  }
  if (scan.serverFiles.length === 0) report.ok("required-server-files.json names no Loupe loader");
  else report.fail(`required-server-files.json names ${scan.serverFiles.map((n) => `"${n}"`).join(", ")}`);
}

/** The formatVersion a generated file's header names, 0 when it names none. */
function headerVersion(file: string): number {
  const match = /formatVersion (\d+), sha256:/.exec(readFileSync(file, "utf8"));
  return match ? Number(match[1]) : 0;
}

/** The directory of `name` as Node resolves it from `from`: the nearest node_modules holding it. */
export function packageDir(from: string, name: string): string | undefined {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name);
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
    if (path.dirname(dir) === dir) return undefined;
  }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort(compare);
}
