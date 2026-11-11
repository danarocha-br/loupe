#!/usr/bin/env node
import { run } from "./cli.js";
import { stdinPrompt } from "./prompt.js";

const prompt = stdinPrompt();
run(process.argv.slice(2), {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  ask: prompt.ask,
})
  .then((code) => {
    process.exitCode = code;
  })
  .finally(prompt.close);
