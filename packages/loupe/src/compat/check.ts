import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { designSystemCandidates, grade } from "./grade.js";
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
  /** Asks a question and resolves to the answer; "" when nobody answers. */
  ask: (question: string) => Promise<string>;
};

export type CheckOptions = {
  cwd: string;
  /** The app, relative to the workspace root. Asked for when several exist. */
  app?: string;
  /** `versions` is `generate`'s recheck: version items only, never asks. */
  mode: "full" | "versions";
  nodeVersion: string;
  io: CheckIo;
  now?: () => Date;
};

export type CheckResult = { ok: boolean; root: string; app?: string };

const NOTHING_WRITTEN = "Nothing was written.";
const MARK = { supported: "✓", untested: "!", unsupported: "✗" } as const;

function pick<T>(answer: string, options: T[], name: (t: T) => string): T | undefined {
  const trimmed = answer.trim();
  const n = Number.parseInt(trimmed, 10);
  if (String(n) === trimmed) return options[n - 1];
  return options.find((o) => name(o) === trimmed.replace(/\/$/, ""));
}

async function chooseApp(
  root: string,
  pkgs: Pkg[],
  opts: CheckOptions,
): Promise<Pkg | undefined | "none"> {
  const apps = nextApps(pkgs);
  if (opts.app !== undefined) {
    const want = relative(root, resolve(isAbsolute(opts.app) ? opts.app : join(root, opts.app)))
      .split(sep)
      .join("/");
    const found = apps.find((a) => a.dir === want);
    if (!found) opts.io.err(`${opts.app} is not a Next.js app in this workspace.`);
    return found ?? "none";
  }
  const here = apps.find((a) => a.abs === resolve(opts.cwd));
  if (here) return here;
  const appRouter = apps.filter((a) => routers(a.abs).app);
  const candidates = appRouter.length > 0 ? appRouter : apps;
  if (candidates.length === 0) {
    opts.io.err("No Next.js app found in this workspace.");
    return "none";
  }
  if (candidates.length === 1) return candidates[0];

  // Several apps: list them, mark the one that uses a design system most, ask.
  const dsNames = pkgs.flatMap((p) =>
    designSystemCandidates(p, pkgs).shadcn.flatMap((d) => d.json.name ?? []),
  );
  const counts = candidates.map((a) => filesImporting(a.abs, [...new Set(dsNames)]));
  const most = Math.max(...counts);
  const marked = most > 0 ? counts.indexOf(most) : -1;
  const markedDs = marked >= 0 ? [...new Set(dsNames)].join(", ") : "";
  opts.io.out("This workspace has several App Router apps. Loupe covers one per install:");
  candidates.forEach((a, i) => {
    opts.io.out(`  ${i + 1}. ${a.dir}${i === marked ? `  (imports ${markedDs} most)` : ""}`);
  });
  const answer = await opts.io.ask(`Which app should Loupe cover? (1-${candidates.length})`);
  return pick(answer, candidates, (a) => a.dir);
}

async function chooseDesignSystem(app: Pkg, pkgs: Pkg[], io: CheckIo) {
  const { shadcn, cva } = designSystemCandidates(app, pkgs);
  const list = shadcn.length > 0 ? shadcn : cva;
  const kind = shadcn.length > 0 ? ("shadcn" as const) : ("cva" as const);
  if (list.length <= 1) return { pkg: list[0], kind, chosen: true };
  io.out(`${app.dir} depends on several design systems. Loupe covers one:`);
  list.forEach((d, i) => io.out(`  ${i + 1}. ${d.json.name} (${d.dir})`));
  const answer = await io.ask(`Which design system should Loupe cover? (1-${list.length})`);
  const pkg = pick(answer, list, (d) => d.json.name ?? d.dir);
  return { pkg, kind, chosen: pkg !== undefined };
}

function render(items: Item[], react: string | undefined, accepted: (i: Item) => boolean): string[] {
  // Next.js, its router and its bundler share one line when all three are supported.
  const [next, router, bundler, ...rest] = items;
  const rows: Item[] =
    next && router && bundler && [next, router, bundler].every((i) => i.grade === "supported")
      ? [{ ...next, label: `${next.label}, ${router.label}, ${bundler.label}` }, ...rest]
      : items;
  const width = Math.max(...rows.map((r) => r.label.length)) + 3;
  const lines: string[] = [];
  for (const row of rows) {
    const status =
      row.grade === "supported" ? "supported" : row.grade === "unsupported" ? "not supported" : accepted(row) ? "accepted, not tested" : "not tested yet";
    lines.push(`  ${MARK[row.grade]} ${row.label.padEnd(width)}${status}`);
    if (row.key === "next" && react) lines.push(`    React ${react} (bundled by Next)`);
    if (row.detail) lines.push(`    ${row.detail}`);
    if (row.fix) lines.push(`    Fix: ${row.fix}`);
  }
  return lines;
}

function plural(n: number): string {
  return `${n} untested item${n === 1 ? "" : "s"}`;
}

function refuse(io: CheckIo, root: string, app?: string): CheckResult {
  io.out("");
  io.out(NOTHING_WRITTEN);
  io.out("");
  io.out(STATEMENT);
  return { ok: false, root, app };
}

/**
 * The compatibility check (PER-98). Grades each item Supported, Untested or
 * Unsupported. One Unsupported item refuses and nothing is written; Untested
 * items need one yes, which the ledger remembers. The only write it ever makes
 * is that yes.
 */
export async function checkCompatibility(opts: CheckOptions): Promise<CheckResult> {
  const { io } = opts;
  const root = findRoot(resolve(opts.cwd));
  const workspace = readWorkspace(root);
  const pkgs = workspacePackages(root, workspace);

  const app = await chooseApp(root, pkgs, opts);
  if (app === "none") return refuse(io, root);
  if (!app) {
    io.out(`No app was chosen. ${NOTHING_WRITTEN}`);
    return { ok: false, root };
  }

  const ds = opts.mode === "full" ? await chooseDesignSystem(app, pkgs, io) : undefined;
  if (ds && !ds.chosen) {
    io.out(`No design system was chosen. ${NOTHING_WRITTEN}`);
    return { ok: false, root, app: app.dir };
  }

  let ledger: ReturnType<typeof readLedger>;
  try {
    ledger = readLedger(root);
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error;
    io.err(error.message);
    return { ok: false, root, app: app.dir };
  }

  const { items, react } = grade({ app, workspace, designSystem: ds, nodeVersion: opts.nodeVersion, mode: opts.mode });
  const accepted = (i: Item) => isAccepted(ledger, app.dir, i.key, i.seen);

  io.out(`Compatibility check — ${app.dir}`);
  io.out("");
  for (const line of render(items, react, accepted)) io.out(line);
  io.out("");

  if (items.some((i) => i.grade === "unsupported")) {
    io.out("Result: Loupe can't be installed here.");
    return refuse(io, root, app.dir);
  }

  const untested = items.filter((i) => i.grade === "untested");
  if (untested.length === 0) {
    io.out("Result: works here.");
    return { ok: true, root, app: app.dir };
  }
  if (opts.mode === "versions" || untested.every(accepted)) {
    const before = opts.mode === "full" ? ", accepted before" : "";
    io.out(`Result: works here, with ${plural(untested.length)}${before}.`);
    return { ok: true, root, app: app.dir };
  }

  io.out(`Result: works here, with ${plural(untested.length)}.`);
  const answer = await io.ask("Continue? (yes/no)");
  if (!/^y(es)?$/i.test(answer.trim())) {
    io.out(NOTHING_WRITTEN);
    return { ok: false, root, app: app.dir };
  }
  recordAccepted(
    root,
    untested.map((i) => ({ app: app.dir, item: i.key, seen: i.seen })),
    (opts.now ?? (() => new Date()))(),
  );
  io.out(`Recorded your yes in ${LEDGER_PATH}.`);
  return { ok: true, root, app: app.dir };
}
