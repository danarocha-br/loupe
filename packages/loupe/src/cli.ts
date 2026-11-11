import { metaUsage, parseMetaArgs, runMeta, summarise } from "./meta/command.js";
import { version } from "./version.js";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
};

const usage = `Usage: loupe <command>

Commands:
  meta           Read prop metadata from the TypeScript checker and cva (headless)

Options:
  -v, --version  Print the installed Loupe version`;

export function run(argv: readonly string[], io: Io): number {
  const [first] = argv;

  if (first === undefined || first === "-h" || first === "--help") {
    io.out(usage);
    return 0;
  }

  if (first === "-v" || first === "--version") {
    io.out(version);
    return 0;
  }

  if (first === "meta") {
    const options = parseMetaArgs(argv.slice(1));
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
