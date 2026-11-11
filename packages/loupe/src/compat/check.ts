import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { type DesignSystem, designSystemCandidates, grade } from "./grade.js";
import { isAccepted, LEDGER_PATH, LedgerError, readLedger, recordAccepted } from "./ledger.js";
import {
  filesImporting,
  findRoot,
  nextApps,
  type Pkg,
  readWorkspace,
  routers,
  workspacePackages,
} from "./repo.js";
import { type Item, STATEMENT } from "./statement.js";

export type CheckIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  /** Resolves to the answer; "" when nobody answers. */
  ask: (question: string) => Promise<string>;
};

export type CheckOptions = {
  cwd: string;
  /** Relative to the workspace root. Asked for when several exist and `mode` is `full`. */
  app?: string;
  /**
   * `versions` is `generate`'s recheck: Next.js and the runtime only, and it never asks.
   * `report` is `doctor`'s: every item, and it never asks and never writes.
   */
  mode: "full" | "versions" | "report";
  /** The design system's directory, relative to the root; picks one when several are candidates. */
  designSystem?: string;
  nodeVersion: string;
  io: CheckIo;
  now?: () => Date;
};

export type CheckResult = {
  ok: boolean;
  root: string;
  app?: string;
  /** The design system package directory, relative to the root; `full` mode only. */
  designSystem?: string;
};

const NOTHING_WRITTEN = "Nothing was written.";

const STATUS = {
  supported: { mark: "✓", text: "supported" },
  untested: { mark: "!", text: "not tested yet" },
  unsupported: { mark: "✗", text: "not supported" },
} as const;

// `unanswered`: nobody picked, which is not a compatibility refusal, so no statement.
type Choice<T> = { chosen: T } | { refused: string; unanswered?: true };

function pickByNumberOrName<T>(answer: string, options: T[], name: (t: T) => string): T | undefined {
  const trimmed = answer.trim();
  const n = Number.parseInt(trimmed, 10);
  if (String(n) === trimmed) return options[n - 1];
  return options.find((o) => name(o) === trimmed.replace(/\/$/, ""));
}

function isInside(dir: string, parent: string): boolean {
  return dir === parent || dir.startsWith(parent + sep);
}

async function chooseApp(root: string, pkgs: Pkg[], opts: CheckOptions): Promise<Choice<Pkg>> {
  const apps = nextApps(pkgs);
  if (opts.app !== undefined) {
    const want = relative(root, resolve(isAbsolute(opts.app) ? opts.app : join(root, opts.app)))
      .split(sep)
      .join("/");
    const found = apps.find((a) => a.dir === want);
    return found ? { chosen: found } : { refused: `${opts.app} is not a Next.js app in this workspace.` };
  }
  const here = apps.find((a) => isInside(resolve(opts.cwd), a.abs));
  if (here) return { chosen: here };
  const appRouter = apps.filter((a) => routers(a.abs).app);
  const candidates = appRouter.length > 0 ? appRouter : apps;
  const [only] = candidates;
  if (!only) return { refused: "No Next.js app found in this workspace." };
  if (candidates.length === 1) return { chosen: only };
  if (opts.mode !== "full") return { refused: "Several App Router apps; pass the app to check." };

  // Mark the app that uses its design system in the most files, then ask.
  const imports = candidates.map((a) => {
    const names = designSystemCandidates(a, pkgs).flatMap((d) => d.pkg.json.name ?? []);
    return { names, files: filesImporting(a.abs, names) };
  });
  const most = Math.max(...imports.map((i) => i.files));
  const marked = most > 0 ? imports.findIndex((i) => i.files === most) : -1;
  opts.io.out("This workspace has several App Router apps. Loupe covers one per install:");
  candidates.forEach((a, i) => {
    const note = i === marked ? `  (imports ${imports[i]?.names.join(", ")} most)` : "";
    opts.io.out(`  ${i + 1}. ${a.dir}${note}`);
  });
  const answer = await opts.io.ask(`Which app should Loupe cover? (1-${candidates.length})`);
  const chosen = pickByNumberOrName(answer, candidates, (a) => a.dir);
  return chosen ? { chosen } : { refused: "No app was chosen.", unanswered: true };
}

async function chooseDesignSystem(app: Pkg, pkgs: Pkg[], opts: CheckOptions): Promise<Choice<DesignSystem | undefined>> {
  const { io } = opts;
  const candidates = designSystemCandidates(app, pkgs);
  if (candidates.length <= 1) return { chosen: candidates[0] };
  const named = candidates.find((d) => d.pkg.dir === opts.designSystem);
  if (named) return { chosen: named };
  if (opts.designSystem !== undefined) return { refused: `${opts.designSystem} isn't a design system ${app.dir} depends on.` };
  if (opts.mode !== "full") return { refused: "Several design systems; pass the one to check." };
  io.out(`${app.dir} depends on several design systems. Loupe covers one:`);
  candidates.forEach((d, i) => io.out(`  ${i + 1}. ${d.pkg.json.name} (${d.pkg.dir})`));
  const answer = await io.ask(`Which design system should Loupe cover? (1-${candidates.length})`);
  const chosen = pickByNumberOrName(answer, candidates, (d) => d.pkg.json.name ?? d.pkg.dir);
  return chosen ? { chosen } : { refused: "No design system was chosen.", unanswered: true };
}

function render(items: Item[], react: string | undefined, accepted: (i: Item) => boolean): string[] {
  // Next.js, its router and its bundler share one line when all three are supported.
  const byKey = (key: Item["key"]) => items.find((i) => i.key === key);
  const next = byKey("next");
  const joined = [next, byKey("router"), byKey("bundler")];
  const rows: Item[] =
    next && joined.every((i) => i?.grade === "supported")
      ? [
          { ...next, label: joined.map((i) => i?.label).join(", ") },
          ...items.filter((i) => !joined.includes(i)),
        ]
      : items;
  const width = Math.max(...rows.map((r) => r.label.length)) + 3;
  const lines: string[] = [];
  for (const row of rows) {
    const { mark, text } = STATUS[row.grade];
    const status = row.grade === "untested" && accepted(row) ? "accepted, not tested" : text;
    lines.push(`  ${mark} ${row.label.padEnd(width)}${status}`);
    if (row.key === "next" && row.grade !== "unsupported") {
      lines.push(react ? `    React ${react} (bundled by Next)` : "    React: couldn't find the copy Next bundles");
    }
    if (row.detail) lines.push(`    ${row.detail}`);
    if (row.fix) lines.push(`    Fix: ${row.fix}`);
  }
  return lines;
}

function untestedCount(n: number): string {
  return `${n} untested item${n === 1 ? "" : "s"}`;
}

function refuse(io: CheckIo, root: string, app?: string, mode?: CheckOptions["mode"]): CheckResult {
  io.out("");
  // `report` never writes, so there is nothing to reassure about.
  if (mode !== "report") {
    io.out(NOTHING_WRITTEN);
    io.out("");
  }
  io.out(STATEMENT);
  return { ok: false, root, app };
}

function refuseChoice(
  io: CheckIo,
  choice: { refused: string; unanswered?: true },
  root: string,
  app?: string,
  mode?: CheckOptions["mode"],
): CheckResult {
  if (!choice.unanswered) {
    io.err(choice.refused);
    return refuse(io, root, app, mode);
  }
  io.out(`${choice.refused} ${NOTHING_WRITTEN}`);
  return { ok: false, root, app };
}

/**
 * One Unsupported item refuses and writes nothing. Untested items need one
 * yes, kept in the ledger; that yes is the only thing this ever writes.
 */
export async function checkCompatibility(opts: CheckOptions): Promise<CheckResult> {
  const { io } = opts;
  const root = findRoot(resolve(opts.cwd));
  const workspace = readWorkspace(root);
  const pkgs = workspacePackages(root, workspace);

  const app = await chooseApp(root, pkgs, opts);
  if ("refused" in app) return refuseChoice(io, app, root, undefined, opts.mode);
  const appDir = app.chosen.dir;

  const ds = opts.mode !== "versions" ? await chooseDesignSystem(app.chosen, pkgs, opts) : { chosen: undefined };
  if ("refused" in ds) return refuseChoice(io, ds, root, appDir, opts.mode);

  let ledger: ReturnType<typeof readLedger>;
  try {
    ledger = readLedger(root);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    return { ok: false, root, app: appDir };
  }

  const { items, react } = grade({
    app: app.chosen,
    workspace,
    designSystem: ds.chosen,
    nodeVersion: opts.nodeVersion,
    mode: opts.mode === "versions" ? "versions" : "full",
  });
  const accepted = (i: Item) => isAccepted(ledger, { app: appDir, item: i.key, seen: i.seen });

  io.out(`Compatibility check — ${appDir}`);
  io.out("");
  for (const line of render(items, react, accepted)) io.out(line);
  io.out("");

  if (items.some((i) => i.grade === "unsupported")) {
    io.out("Result: Loupe can't be installed here.");
    return refuse(io, root, appDir, opts.mode);
  }

  const untested = items.filter((i) => i.grade === "untested");
  if (untested.length === 0) {
    io.out("Result: works here.");
    return { ok: true, root, app: appDir, designSystem: ds.chosen?.pkg.dir };
  }
  if (opts.mode === "versions" || untested.every(accepted)) {
    const before = opts.mode !== "versions" ? ", accepted before" : "";
    io.out(`Result: works here, with ${untestedCount(untested.length)}${before}.`);
    return { ok: true, root, app: appDir, designSystem: ds.chosen?.pkg.dir };
  }

  if (opts.mode === "report") {
    const fresh = untested.filter((i) => !accepted(i)).length;
    io.out(`Result: works here, with ${untestedCount(untested.length)}; ${fresh} not accepted yet.`);
    io.out("Run loupe init to review them: it asks once and records the yes.");
    return { ok: false, root, app: appDir, designSystem: ds.chosen?.pkg.dir };
  }
  io.out(`Result: works here, with ${untestedCount(untested.length)}.`);
  const answer = await io.ask("Continue? (yes/no)");
  if (!/^y(es)?$/i.test(answer.trim())) {
    io.out(NOTHING_WRITTEN);
    return { ok: false, root, app: appDir };
  }
  recordAccepted(
    root,
    untested.map((i) => ({ app: appDir, item: i.key, seen: i.seen })),
    (opts.now ?? (() => new Date()))(),
  );
  io.out(`Recorded your yes in ${LEDGER_PATH}.`);
  return { ok: true, root, app: appDir, designSystem: ds.chosen?.pkg.dir };
}
