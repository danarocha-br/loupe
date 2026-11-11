#!/usr/bin/env node
// Runs the right `loupe` CLI for this repo, then exits with its code.
//
//   node loupe.mjs [--pinned] <loupe arguments…>
//
// The product's own copy (<app>/node_modules/@danarocha/loupe) runs whenever it
// is installed, so the CLI that reads the Product layer is the one that wrote it.
// Before `loupe init` there is no copy yet, so `pnpm dlx` runs the exact release
// (never "latest"): the pinned one, or the ledger's when the copy is missing.
// `--pinned` (the install skill) refuses a copy of another version.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEDGER, LOUPE_PACKAGE, LOUPE_VERSION } from "./pin.mjs";

/** Exit code when `--pinned` finds a copy of another version. */
export const EXIT_OTHER_VERSION = 3;

/** The nearest directory, from `start` up, that holds pnpm-workspace.yaml. */
export function findRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** `--app <dir>` or `--app=<dir>` from the arguments passed through to loupe. */
export function appArgument(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--app") return args[i + 1];
    if (args[i]?.startsWith("--app=")) return args[i].slice("--app=".length);
  }
  return undefined;
}

/** What is on disk: the ledger's app and version, and the app's installed copy. */
export function inspectRepo(root, args) {
  const ledger = readJson(path.join(root, LEDGER));
  const app = appArgument(args) ?? ledger?.productLayer?.app;
  let local;
  if (app) {
    const dir = path.join(root, app, "node_modules", ...LOUPE_PACKAGE.split("/"));
    const pkg = readJson(path.join(dir, "package.json"));
    const bin = typeof pkg?.bin === "string" ? pkg.bin : pkg?.bin?.loupe;
    if (pkg?.version && bin) local = { version: pkg.version, bin: path.join(dir, bin) };
  }
  return { app, ledgerVersion: ledger?.loupe?.version, local };
}

/**
 * Pure: which command runs loupe. `{ refuse }` when `--pinned` meets another version.
 */
export function chooseCommand({ args, pinned, app, ledgerVersion, local, pin = LOUPE_VERSION }) {
  if (local) {
    if (pinned && local.version !== pin) {
      return {
        refuse:
          `${app} already has ${LOUPE_PACKAGE} ${local.version}; this plugin installs ${pin}. ` +
          "Nothing was run. The doctor skill checks an existing install.",
      };
    }
    return { command: process.execPath, argv: [local.bin, ...args], label: `${LOUPE_PACKAGE} ${local.version} (${app})` };
  }
  const version = pinned ? pin : (ledgerVersion ?? pin);
  const spec = `${LOUPE_PACKAGE}@${version}`;
  return { command: "pnpm", argv: ["dlx", spec, ...args], label: `${spec} (pnpm dlx)` };
}

function main(argv) {
  const pinned = argv[0] === "--pinned";
  const args = pinned ? argv.slice(1) : argv;
  const root = findRoot(process.cwd());
  if (!root) {
    console.error("No pnpm-workspace.yaml here or above: Loupe installs only into a pnpm workspace.");
    return 1;
  }
  const choice = chooseCommand({ args, pinned, ...inspectRepo(root, args) });
  if ("refuse" in choice) {
    console.error(choice.refuse);
    return EXIT_OTHER_VERSION;
  }
  console.error(`Running loupe ${args.join(" ")} with ${choice.label}`);
  const result = spawnSync(choice.command, choice.argv, { cwd: root, stdio: "inherit" });
  if (result.error) {
    console.error(`Couldn't run ${choice.command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
