import { checkCompatibility } from "./compat/check.js";
import { metaUsage, parseMetaArgs, runMeta, summarise } from "./meta/command.js";
import { version } from "./version.js";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
  /** Asks a question and resolves to the answer; "" when nobody answers. */
  ask?: (question: string) => Promise<string>;
  cwd?: string;
  /** The Node that runs the dev server; the one running this CLI by default. */
  nodeVersion?: string;
};

const usage = `Usage: loupe <command>

Commands:
  check [--app <dir>]  Check this repo against Loupe's compatibility statement
  meta                 Read prop metadata from the TypeScript checker and cva (headless)

Options:
  -v, --version  Print the installed Loupe version`;

async function check(args: readonly string[], io: Io): Promise<number> {
  let app: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--app" && args[i + 1] !== undefined) app = args[++i];
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
