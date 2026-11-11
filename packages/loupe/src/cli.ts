import { checkCompatibility } from "./compat/check.js";
import { generateUsage, parseGenerateArgs, runGenerate } from "./generate/command.js";
import { initUsage, parseInitArgs, runInit } from "./init/command.js";
import { metaUsage, parseMetaArgs, runMeta, summarise } from "./meta/command.js";
import { parseRemoveArgs, removeUsage, runRemove } from "./remove/command.js";
import { version } from "./version.js";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
  /** Asks a question and resolves to the answer; "" when nobody answers. */
  ask?: (question: string) => Promise<string>;
  cwd?: string;
  /** The Node that runs the dev server; the one running this CLI by default. */
  nodeVersion?: string;
  /** Runs `pnpm install` for `loupe remove`; the real one by default. */
  install?: (root: string) => number;
};

const usage = `Usage: loupe <command>

Commands:
  check [--app <dir>]  Check this repo against Loupe's compatibility statement
  generate [--check]   Write Adapters, meta/ and adapt-list.json into the Product layer
  init [--adopt]       Install Loupe into an app: the Product layer and four edits, recorded in a ledger
  remove               Undo loupe init, never overwriting a hand edit
  meta                 Read prop metadata from the TypeScript checker and cva (headless)

Options:
  -v, --version  Print the installed Loupe version`;

async function check(args: readonly string[], io: Io): Promise<number> {
  let app: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--app") {
      app = args[++i];
      if (app === undefined) {
        io.err("--app needs a directory, such as --app apps/app.");
        return 1;
      }
    }
    else if (arg.startsWith("--app=")) app = arg.slice("--app=".length);
    else {
      io.err(`Unknown option: ${arg}`);
      io.err(usage);
      return 1;
    }
  }
  const result = await checkCompatibility({
    cwd: io.cwd ?? process.cwd(),
    app,
    mode: "full",
    nodeVersion: io.nodeVersion ?? process.versions.node,
    io: { out: io.out, err: io.err, ask: io.ask ?? (async () => "") },
  });
  return result.ok ? 0 : 1;
}

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const [first, ...rest] = argv;

  if (first === undefined || first === "-h" || first === "--help") {
    io.out(usage);
    return 0;
  }

  if (first === "-v" || first === "--version") {
    io.out(version);
    return 0;
  }

  if (first === "check") return check(rest, io);

  if (first === "generate") {
    const options = parseGenerateArgs(rest);
    if (typeof options === "string") {
      io.err(options);
      io.err(generateUsage);
      return 1;
    }
    if (options.help) {
      io.out(generateUsage);
      return 0;
    }
    try {
      const result = runGenerate(options, io.cwd ?? process.cwd());
      for (const line of result.lines) (result.ok ? io.out : io.err)(line);
      return result.ok ? 0 : 1;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (first === "init") {
    const options = parseInitArgs(rest);
    if (typeof options === "string") {
      io.err(options);
      io.err(initUsage);
      return 1;
    }
    if (options.help) {
      io.out(initUsage);
      return 0;
    }
    return runInit(options, {
      out: io.out,
      err: io.err,
      ask: io.ask ?? (async () => ""),
      cwd: io.cwd ?? process.cwd(),
      nodeVersion: io.nodeVersion ?? process.versions.node,
    });
  }

  if (first === "remove") {
    const options = parseRemoveArgs(rest);
    if (typeof options === "string") {
      io.err(options);
      io.err(removeUsage);
      return 1;
    }
    if (options.help) {
      io.out(removeUsage);
      return 0;
    }
    return runRemove(options, { out: io.out, err: io.err, cwd: io.cwd ?? process.cwd(), install: io.install });
  }

  if (first === "meta") {
    const options = parseMetaArgs(rest);
    if (typeof options === "string") {
      io.err(options);
      io.err(metaUsage);
      return 1;
    }
    try {
      for (const line of summarise(runMeta(options))) io.out(line);
      return 0;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  io.err(`Unknown command: ${first}`);
  io.err(usage);
  return 1;
}
