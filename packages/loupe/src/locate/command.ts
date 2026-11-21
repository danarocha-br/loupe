// `loupe locate` (ADR 0002): the command a coding agent runs on a copied Proposal,
// before it edits, to find each call site, and after, with `--check`, to see that
// each Apply change is in the code. It writes nothing. The Proposal's rules name it,
// with the app folder and `--out` it needs (`command-line.ts`).

import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { layerFromFlags } from "../compat/repo.js";
import { loaderContext } from "../loader-runtime.js";
import { PRODUCT_LAYER } from "../names.js";
import { ACTION_WORDS, ordinal, propInWords, reachInWords } from "../proposal/words.js";
import { plural } from "../toolbar/format.js";
import { readProposal } from "./input.js";
import { applied, type ChangeReport, type LocateReport, locateProposal, type PropStatus, type SiteReport } from "./locate.js";

export type LocateCommandOptions = {
  /** The copied Proposal; standard input when absent. */
  file?: string;
  check: boolean;
  out?: string;
  root?: string;
  help?: boolean;
};

export type LocateIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  cwd: string;
  /** Everything piped to standard input; absent when nothing is. */
  read?: () => Promise<string>;
};

export const locateUsage = `Usage: loupe locate [file] [options]

Reads a Proposal copied from the Loupe panel, from the file or piped on standard
input, and finds each call site it names by the anchors the dev server uses. Says
where each one is now, whether the code around it changed, and how each prop is
written there. Writes nothing.

Options:
  --check        also exit 1 while an Apply change isn't in the code yet
  --out <dir>    Product layer directory (default: ${PRODUCT_LAYER.path})
  --root <dir>   repo root (default: found as loupe generate finds it)

Exit codes: 0 every call site found · 1 unreadable, gone or changed (with --check, also an Apply change not in the code)`;

export function parseLocateArgs(argv: readonly string[]): LocateCommandOptions | string {
  const options: LocateCommandOptions = { check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--check") options.check = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--out" || arg === "--root") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return `Missing value for ${arg}`;
      options[arg === "--out" ? "out" : "root"] = value;
      i += 1;
    } else if (arg === "-") continue;
    else if (arg.startsWith("-")) return `Unknown option: ${arg}`;
    else if (options.file !== undefined) return `One Proposal at a time: ${options.file} and ${arg}`;
    else options.file = arg;
  }
  return options;
}

const STOP_AND_ASK = "Stop and ask the designer.";

function statusWords(status: PropStatus): string {
  switch (status.kind) {
    case "in-code":
      return "in the code";
    case "to-do":
      return status.written === null ? "to do: not written yet, add it" : `to do: written ${status.written}`;
    case "expression":
      return `written as an expression${status.expression ? `: \`${status.expression}\`` : ""}; decide the code with the designer`;
    case "spread":
      return "not written, but the call site spreads props that may set it; check with the designer";
    case "overridden":
      return `${status.by} sets it at this call site: ${statusWords(status.status)}`;
    case "unreadable":
      return "written in a way Loupe can't compare; check it by hand";
  }
}

function scopeWords(change: ChangeReport): string {
  const reach = reachInWords(change, change.keyPath);
  return change.scope === "page" ? reach : `<${change.component}>, ${reach}`;
}

function siteLines(site: SiteReport): string[] {
  const enclosing = site.enclosing ? ` in ${site.enclosing}` : "";
  if (site.status === "not-found" || site.status === "unreadable") {
    return [`  ${site.path} · ${ordinal(site.nth)} <${site.component}>${enclosing}: ${site.detail ?? ""} ${STOP_AND_ASK}`];
  }
  const head = `  ${site.path}:${site.line}:${site.column} · ${ordinal(site.nth)} of ${site.total}${enclosing}`;
  if (site.status === "code-changed") return [`${head} · ${site.detail ?? ""} ${STOP_AND_ASK}`];
  return [head, ...site.props.map((prop) => `    ${propInWords(prop.name)} → ${prop.proposed} · ${statusWords(prop.status)}`)];
}

/** The report as lines, and whether it passes: every call site found, and with `check`, every Apply change in the code. */
export function reportLines(report: LocateReport, check: boolean): { lines: string[]; ok: boolean } {
  const lines: string[] = [];
  for (const change of report.changes) {
    lines.push(`${change.id} · ${ACTION_WORDS[change.action]} · ${scopeWords(change)}`);
    if (change.sites.length === 0) lines.push("  No call site to find: ask the designer.");
    for (const site of change.sites) lines.push(...siteLines(site));
  }

  const notChanges: string[] = [];
  if (report.context.states > 0) notChanges.push(`${plural(report.context.states, "State shown", "States shown")} (${ACTION_WORDS.context})`);
  if (report.context.flags > 0) notChanges.push(`${plural(report.context.flags, "Flag preview")} (${ACTION_WORDS.context})`);
  if (report.held > 0) notChanges.push(`${report.held} held for review (${ACTION_WORDS.held})`);
  if (notChanges.length > 0) lines.push(`Not code changes: ${notChanges.join(", ")}.`);

  const apply = report.changes.filter((change) => change.action === "apply");
  const done = apply.filter(applied);
  const ask = report.changes.length - apply.length;
  const broken = report.changes.flatMap((change) => change.sites).filter((site) => site.status !== "found").length;
  if (report.changes.length === 0) lines.push("No changes to apply.");
  else {
    lines.push(
      `${ACTION_WORDS.apply}: ${done.length} of ${apply.length} in the code. ${ACTION_WORDS["ask-first"]}: ${ask}.${broken > 0 ? ` Gone or changed: ${plural(broken, "call site")}.` : ""}`,
    );
  }
  const left = apply.filter((change) => !applied(change)).map((change) => change.id);
  if (check) lines.push(left.length === 0 ? "Every Apply change is in the code." : `Not in the code yet: ${left.join(", ")}.`);
  return { lines, ok: broken === 0 && (!check || left.length === 0) };
}

export async function runLocate(options: LocateCommandOptions, io: LocateIo): Promise<number> {
  let text: string;
  try {
    if (options.file !== undefined) text = readFileSync(path.resolve(io.cwd, options.file), "utf8");
    else if (io.read) text = await io.read();
    else {
      io.err("Pass the copied Proposal as a file, or pipe it on standard input: loupe locate < proposal.md");
      return 1;
    }
  } catch (error) {
    io.err(`Can't read ${options.file}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const proposal = readProposal(text);
  if (typeof proposal === "string") {
    io.err(proposal);
    return 1;
  }

  let root: string;
  let adaptList: string;
  try {
    const flags = layerFromFlags(io.cwd, options);
    root = realpathSync(flags.root);
    adaptList = path.join(existsSync(flags.layer) ? realpathSync(flags.layer) : flags.layer, "adapt-list.json");
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (!existsSync(adaptList)) {
    io.err(`No adapt-list.json at ${path.relative(io.cwd, adaptList) || adaptList}: pass --out with the Product layer's directory.`);
    return 1;
  }

  const report = locateProposal(proposal, {
    context: loaderContext({ root, adaptList }),
    readFile: (file) => (existsSync(file) ? readFileSync(file, "utf8") : null),
  });
  const { lines, ok } = reportLines(report, options.check);
  for (const line of lines) io.out(line);
  return ok ? 0 : 1;
}
