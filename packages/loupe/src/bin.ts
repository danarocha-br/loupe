#!/usr/bin/env node
import { run } from "./cli.js";
import { stdinPrompt } from "./prompt.js";

const prompt = stdinPrompt();
run(process.argv.slice(2), {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  ask: prompt.ask,
  // Only what is piped in: a terminal would wait for an end of input nobody types.
  read: process.stdin.isTTY ? undefined : prompt.readAll,
})
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(prompt.close);
