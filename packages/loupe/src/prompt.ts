import { createInterface } from "node:readline";

/**
 * Reads answers from stdin one line at a time, through a single readline
 * interface so piped answers ("printf '2\nyes\n' | loupe check") reach
 * successive questions. Resolves "" once input ends.
 */
export function stdinPrompt(): { ask: (question: string) => Promise<string>; close: () => void } {
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
    close: () => rl.close(),
  };
}
