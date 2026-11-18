#!/usr/bin/env node
// Where an upgrade of this repo stands, and the one edit it needs: the app's
// @danarocha/loupe dependency set to the release this plugin pins (`pin.mjs`),
// exact, without `^`. Everything else in an upgrade is `loupe init`'s work.
//
//   node upgrade.mjs status [--app <dir>]   writes nothing
//   node upgrade.mjs bump   [--app <dir>]   writes <app>/package.json, only when status says `upgrade`
//
// `status` ends with a `Result:` word that the upgrade skill branches on (RESULTS).
// Exit codes: 0 done · 1 `bump` refused · 2 bad usage, or a repo this can't read.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCKFILE } from "./lockfile.mjs";
import { appArgument, findRoot, inspectRepo } from "./loupe.mjs";
import { LOUPE_PACKAGE, LOUPE_VERSION } from "./pin.mjs";

/** Where `loupe init` writes the dependency; any other of these that names Loupe is found too. */
const DEPENDENCY_FIELDS = ["devDependencies", "dependencies"];

/** The words `status` can end with, and what the skill does for each is in its step 1. */
export const RESULTS = ["not-installed", "up-to-date", "plugin-behind", "app-pin-not-plain", "upgrade", "resume"];

/** Semver precedence, as the CLI orders versions (`compareVersions` in packages/loupe/src/version.ts). */
export function compareVersions(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i += 1) {
    const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  if (x.pre.length === 0 || y.pre.length === 0) return Math.sign(y.pre.length - x.pre.length);
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i += 1) {
    const d = compareIdentifiers(x.pre[i], y.pre[i]);
    if (d !== 0) return d;
  }
  return Math.sign(x.pre.length - y.pre.length);
}

function parts(version) {
  const bare = version.split("+")[0];
  const dash = bare.indexOf("-");
  const core = dash === -1 ? bare : bare.slice(0, dash);
  return {
    core: core.split(".").map((n) => Number.parseInt(n, 10) || 0),
    pre: dash === -1 ? [] : bare.slice(dash + 1).split("."),
  };
}

function compareIdentifiers(p, q) {
  const pn = /^\d+$/.test(p);
  const qn = /^\d+$/.test(q);
  if (pn && qn) return Math.sign(Number(p) - Number(q));
  if (pn !== qn) return pn ? -1 : 1;
  return p < q ? -1 : p > q ? 1 : 0;
}

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * The version a dependency spec names outright: "0.0.4", "^0.0.4" and "~0.0.4" name 0.0.4. A `catalog:` or
 * `workspace:` spec, a tag, a wider range or nothing at all names none.
 */
export function plainVersion(spec) {
  if (typeof spec !== "string") return undefined;
  const bare = spec.trim().replace(/^[\^~]/, "");
  return VERSION.test(bare) ? bare : undefined;
}

/**
 * Pure: which of RESULTS this repo is in. `ledger` is the version the ledger records, `installed` the copy in the
 * app's node_modules, `appSpec` the spec in the app's package.json; any of them may be undefined.
 *
 * Never an upgrade to anything but `pin`, and never a step back: an install that is ahead of the plugin
 * (in the ledger, the installed copy or the app's pin) is `plugin-behind`.
 */
export function verdict({ pin = LOUPE_VERSION, ledger, installed, appSpec }) {
  if (ledger === undefined) return "not-installed";
  const appVersion = plainVersion(appSpec);
  const ahead = (v) => v !== undefined && compareVersions(v, pin) > 0;
  if (ahead(ledger) || ahead(installed) || ahead(appVersion)) return "plugin-behind";
  if (compareVersions(ledger, pin) === 0) return "up-to-date";
  // The ledger is behind. A plain pin says what is left to do, whatever node_modules holds: a copy that is
  // already the new one (another branch's) is gone after the next install if the pin still asks for the old.
  if (appVersion !== undefined) return compareVersions(appVersion, pin) === 0 ? "resume" : "upgrade";
  // `catalog:`, `workspace:`, a range or nothing: only the installed copy says whether the bump was made.
  return installed !== undefined && compareVersions(installed, pin) === 0 ? "resume" : "app-pin-not-plain";
}

/** The app's package.json and the field naming Loupe in it, if any. */
function readApp(root, app) {
  const file = path.join(root, app, "package.json");
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return { file };
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { file, text };
  }
  const field = DEPENDENCY_FIELDS.find((f) => typeof json?.[f]?.[LOUPE_PACKAGE] === "string");
  return { file, text, json, field, spec: field ? json[field][LOUPE_PACKAGE] : undefined };
}

/** Everything `verdict` and the skill need, read from `root`. `app` is the app's folder; the ledger's when omitted. */
export function upgradeFacts(root, app, pin = LOUPE_VERSION) {
  const seen = inspectRepo(root, app === undefined ? [] : ["--app", app]);
  const manifest = seen.app ? readApp(root, seen.app) : undefined;
  return {
    pin,
    appDir: seen.app,
    ledger: seen.ledgerVersion,
    installed: seen.local?.version,
    appSpec: manifest?.spec,
    field: manifest?.field,
    manifest,
  };
}

export function render(facts, result) {
  const rows = [
    ["this plugin installs", `${LOUPE_PACKAGE} ${facts.pin}`],
    ["the ledger records", facts.ledger ?? "no Loupe install"],
    ["the app has installed", facts.installed ?? "no copy"],
    ["its package.json", facts.appSpec === undefined ? "missing" : `${LOUPE_PACKAGE} ${facts.appSpec} (${facts.field})`],
  ];
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  return [
    `Loupe upgrade${facts.appDir ? ` — ${facts.appDir}` : ""}`,
    ...rows.map(([label, value]) => `  ${label.padEnd(width)}${value}`),
    `Result: ${result}`,
  ];
}

/**
 * Pure: `text` with the one `"name": "<spec>"` pair set to `to`, and nothing else touched (no reformatting, same key
 * order). `{ error }` when the name isn't there exactly once, since then it isn't clear which one is meant.
 */
export function setDependency(text, name, to) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const matches = [...text.matchAll(new RegExp(`("${escaped}"\\s*:\\s*)"([^"\\\\]*)"`, "g"))];
  if (matches.length !== 1) {
    return { error: `${name} appears ${matches.length} times in package.json, not once, so it is not clear which to change.` };
  }
  const [whole, lead, from] = matches[0];
  const at = matches[0].index;
  return { text: `${text.slice(0, at)}${lead}"${to}"${text.slice(at + whole.length)}`, from };
}

/** Uncommitted changes under `files` (relative to `root`), as git lists them. Throws when `root` isn't in a git repository. */
export function dirtyFiles(root, files) {
  const out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...files], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split("\0")
    .filter((entry) => entry.length >= 4)
    .map((entry) => entry.slice(3));
}

/**
 * Sets the app's @danarocha/loupe dependency to the pin, in the field that already names it, and writes that file
 * only. Refuses unless `verdict` says `upgrade`, and while the app's package.json or the lockfile has uncommitted
 * changes: the bump is committed on its own, so it must be the only change in those two files.
 */
export function bump(root, app, pin = LOUPE_VERSION) {
  const facts = upgradeFacts(root, app, pin);
  const result = verdict(facts);
  if (result !== "upgrade") {
    return { code: 1, err: [`Not bumping: the upgrade is at "${result}", and only "upgrade" bumps. Run status to see why.`] };
  }
  const { manifest } = facts;
  const rel = `${facts.appDir}/package.json`;
  const dirty = dirtyFiles(root, [rel, LOCKFILE]);
  if (dirty.length > 0) {
    return {
      code: 1,
      err: [
        "Uncommitted changes in:",
        ...dirty.map((f) => `  ${f}`),
        "Commit or stash them first, so the bump is the only change in those two files. Nothing was written.",
      ],
    };
  }
  const edit = setDependency(manifest.text, LOUPE_PACKAGE, pin);
  if (edit.error) return { code: 1, err: [`${rel}: ${edit.error} Nothing was written.`] };
  // Whatever the text edit did, the parsed file may differ from the old one in that one value only.
  const expected = structuredClone(manifest.json);
  expected[manifest.field][LOUPE_PACKAGE] = pin;
  if (JSON.stringify(JSON.parse(edit.text)) !== JSON.stringify(expected)) {
    return { code: 1, err: [`${rel}: the edit would have changed more than ${LOUPE_PACKAGE}. Nothing was written.`] };
  }
  writeFileSync(manifest.file, edit.text);
  return {
    code: 0,
    out: [`${rel}: ${LOUPE_PACKAGE} ${edit.from} → ${pin} (${manifest.field})`, "Next: run pnpm install from the repo root."],
  };
}

function main(argv) {
  const [command, ...rest] = argv;
  const known = (a) => a === "--app" || a.startsWith("--app=");
  const stray = rest.find((a, i) => !known(a) && rest[i - 1] !== "--app");
  if ((command !== "status" && command !== "bump") || stray !== undefined) {
    console.error(stray === undefined ? "Usage: upgrade.mjs status|bump [--app <dir>]" : `Unknown option: ${stray}`);
    return 2;
  }
  const root = findRoot(process.cwd());
  if (!root) {
    console.error("No pnpm-workspace.yaml here or above: Loupe installs only into a pnpm workspace.");
    return 2;
  }
  const app = appArgument(rest);
  if (command === "status") {
    const facts = upgradeFacts(root, app);
    for (const line of render(facts, verdict(facts))) console.log(line);
    return 0;
  }
  const result = bump(root, app);
  for (const line of result.out ?? []) console.log(line);
  for (const line of result.err ?? []) console.error(line);
  return result.code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
