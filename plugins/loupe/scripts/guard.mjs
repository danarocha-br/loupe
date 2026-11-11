#!/usr/bin/env node
// PreToolUse guard: Claude never edits Loupe's Product layer by hand. `loupe init`
// and `loupe generate` write it and record each file's hash, so a hand edit reads
// as drift and `loupe remove` leaves it behind. An Edit or Write inside the layer
// is denied, and the reason points at `generate`. Anything else: exit 0, print nothing.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEDGER_FILE = "loupe.ledger.json";
const LAYER_NAME = "@repo/loupe";

/** The real path of `file`, or of its nearest existing ancestor joined with the rest. */
function realish(file) {
  let dir = file;
  const rest = [];
  while (!existsSync(dir)) {
    const up = path.dirname(dir);
    if (up === dir) return file;
    rest.unshift(path.basename(dir));
    dir = up;
  }
  return path.join(realpathSync(dir), ...rest);
}

/** A Product layer is a directory holding the ledger, or the package named @repo/loupe. */
function isLayer(dir) {
  if (existsSync(path.join(dir, LEDGER_FILE))) return true;
  try {
    return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).name === LAYER_NAME;
  } catch {
    return false;
  }
}

/** The Product layer that contains `file` (absolute), if any. */
export function productLayerOf(file) {
  let dir = path.dirname(realish(file));
  for (;;) {
    if (isLayer(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

/** The PreToolUse answer for one hook input, or undefined to allow. */
export function decide(input) {
  const toolInput = input?.tool_input ?? {};
  let file = toolInput.file_path ?? toolInput.notebook_path;
  if (typeof file !== "string" || file === "") return undefined;
  if (!path.isAbsolute(file)) file = path.join(String(input.cwd ?? process.cwd()), file);
  const layer = productLayerOf(file);
  if (!layer) return undefined;
  const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "loupe.mjs");
  const reason =
    `${file} is in Loupe's Product layer (${layer}). loupe init and loupe generate write it and record each ` +
    "file's hash, so a hand edit reads as drift and loupe remove leaves it behind. Don't edit it: change the " +
    `component's source instead, then run \`node "${runner}" generate\` from the repo root to rewrite the ` +
    "layer. To check what is stale or drifted first, run the loupe doctor skill.";
  return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  };
}

async function main() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const answer = decide(JSON.parse(text));
  if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The guard never blocks anything by crashing.
  main()
    .catch(() => {})
    .finally(() => {
      process.exitCode = 0;
    });
}
