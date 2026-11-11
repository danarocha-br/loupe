import { version } from "./version.js";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
};

const usage = `Usage: loupe <command>

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

  io.err(`Unknown command: ${first}`);
  io.err(usage);
  return 1;
}
