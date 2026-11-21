import { createInterface } from "node:readline";

/**
 * Standard input, through a single readline interface: two readers can't share
 * stdin, and the CLI makes one at start-up for whichever command runs.
 *
 * `ask` reads answers one line at a time, so piped answers ("printf '2\nyes\n' |
 * loupe check") reach successive questions, and resolves "" once input ends.
 * `readAll` drains what is left: the Proposal piped to `loupe locate`.
 */
export function stdinPrompt(): { ask: (question: string) => Promise<string>; readAll: () => Promise<string>; close: () => void } {
  const rl = createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  return {
    ask: async (question) => {
      process.stdout.write(`${question} `);
      const next = await lines.next();
      const answer = next.done ? "" : String(next.value);
      if (!process.stdin.isTTY) process.stdout.write(`${answer}\n`);
      return answer;
    },
    readAll: async () => {
      const all: string[] = [];
      for (let next = await lines.next(); !next.done; next = await lines.next()) all.push(String(next.value));
      return all.join("\n");
    },
    close: () => rl.close(),
  };
}
