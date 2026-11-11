#!/usr/bin/env node
// What installing or removing Loupe did to pnpm-lock.yaml beyond Loupe's own
// entries (the plugin README says why), and putting back a peer-only residue.
//
//   node lockfile.mjs report  [--base <ref>|auto]   writes nothing
//   node lockfile.mjs restore [--base <ref>|auto]   writes <ref>'s lockfile only when every difference is a
//                                                   peer re-resolution, and keeps it only if pnpm accepts it frozen
//
// `auto`: the commit before the one that added the ledger, if HEAD has one; else HEAD.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEDGER, LOUPE_PACKAGE, PRODUCT_LAYER, PRODUCT_LAYER_PACKAGE } from "./pin.mjs";
import { findRoot } from "./loupe.mjs";

const LOCKFILE = "pnpm-lock.yaml";
const OWN = new Set([LOUPE_PACKAGE, PRODUCT_LAYER_PACKAGE]);
const LAYER_IMPORTER = PRODUCT_LAYER;

/** `importer \t field \t name` → { specifier, version }, from a v9 lockfile's importers section. */
export function importers(text) {
  const out = new Map();
  let inImporters = false;
  let importer;
  let field;
  let name;
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inImporters = line.startsWith("importers:");
      continue;
    }
    if (!inImporters || line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();
    const key = unquote(body.replace(/:.*$/, ""));
    if (indent === 2) {
      importer = key;
      field = undefined;
    } else if (indent === 4) {
      field = key;
    } else if (indent === 6 && field) {
      name = key;
      out.set(`${importer}\t${field}\t${name}`, {});
    } else if (indent === 8 && field && name) {
      const entry = out.get(`${importer}\t${field}\t${name}`);
      const value = unquote(body.slice(body.indexOf(":") + 1).trim());
      if (body.startsWith("specifier:")) entry.specifier = value;
      else if (body.startsWith("version:")) entry.version = value;
    }
  }
  return out;
}

function unquote(text) {
  return text.replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
}

/** The resolved version without its peer suffix: "0.13.11(typescript@6.0.3)" → "0.13.11". */
function bare(version = "") {
  const at = version.indexOf("(");
  return at === -1 ? version : version.slice(0, at);
}

/** Pure: sorts every importer difference into own, peers, moved, manifest. */
export function classify(beforeText, afterText) {
  const before = importers(beforeText);
  const after = importers(afterText);
  const result = { own: [], peers: [], moved: [], manifest: [] };
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const [importer, field, name] = key.split("\t");
    const was = before.get(key);
    const now = after.get(key);
    if (was && now && was.specifier === now.specifier && was.version === now.version) continue;
    const row = { importer, field, name, was, now };
    if (OWN.has(name) || importer === LAYER_IMPORTER) result.own.push(row);
    else if (!was || !now || was.specifier !== now.specifier) result.manifest.push(row);
    else if (bare(was.version) === bare(now.version)) result.peers.push(row);
    else result.moved.push(row);
  }
  return result;
}

/** The result word the skills branch on: other-changes, loupe-and-peers, loupe-only, peers-only or unchanged. */
export function verdict(c) {
  if (c.moved.length + c.manifest.length > 0) return "other-changes";
  if (c.own.length > 0) return c.peers.length > 0 ? "loupe-and-peers" : "loupe-only";
  if (c.peers.length > 0) return "peers-only";
  return "unchanged";
}

export function render(c, baseLabel) {
  const lines = [`${LOCKFILE} against ${baseLabel}:`];
  const show = (title, rows, fmt) => {
    if (rows.length === 0) return;
    lines.push(`  ${title} (${rows.length})`);
    for (const r of rows.slice(0, 30)) lines.push(`    ${r.importer} ${r.name}: ${fmt(r)}`);
    if (rows.length > 30) lines.push(`    … and ${rows.length - 30} more`);
  };
  const v = (e) => (e ? e.version : "absent");
  show("Loupe's own entries", c.own, (r) => `${v(r.was)} → ${v(r.now)}`);
  show("Peer re-resolved, same version", c.peers, (r) => `${r.was.version} → ${r.now.version}`);
  show("Moved without a package.json change", c.moved, (r) => `${r.was.version} → ${r.now.version} (specifier ${r.now.specifier})`);
  show("Changed in a package.json", c.manifest, (r) => `${r.was?.specifier ?? "absent"} → ${r.now?.specifier ?? "absent"}`);
  if (lines.length === 1) lines.push("  no importer changes");
  lines.push(`Result: ${verdict(c)}`);
  return lines;
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** `auto`: the commit before the ledger was added, if HEAD has one; else HEAD. */
export function resolveBase(root, base) {
  if (base !== "auto") return git(root, ["rev-parse", "--verify", `${base}^{commit}`]);
  const prefix = git(root, ["rev-parse", "--show-prefix"]);
  const ledger = `${prefix}${LEDGER}`;
  try {
    git(root, ["cat-file", "-e", `HEAD:${ledger}`]);
  } catch {
    return git(root, ["rev-parse", "HEAD"]);
  }
  const added = git(root, ["log", "--diff-filter=A", "-1", "--format=%H", "HEAD", "--", ledger]);
  return git(root, ["rev-parse", "--verify", `${added}^`]);
}

function lockfileAt(root, ref) {
  const prefix = git(root, ["rev-parse", "--show-prefix"]);
  return execFileSync("git", ["show", `${ref}:${prefix}${LOCKFILE}`], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
}

function frozenInstall(root) {
  return spawnSync("pnpm", ["install", "--frozen-lockfile"], { cwd: root, stdio: "inherit" }).status === 0;
}

function main(argv) {
  const [command, ...rest] = argv;
  let base = "auto";
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--base") base = rest[++i] ?? "";
    else if (rest[i]?.startsWith("--base=")) base = rest[i].slice("--base=".length);
    else {
      console.error(`Unknown option: ${rest[i]}`);
      return 2;
    }
  }
  if (command !== "report" && command !== "restore") {
    console.error("Usage: lockfile.mjs report|restore [--base <ref>|auto]");
    return 2;
  }
  const root = findRoot(process.cwd());
  if (!root) {
    console.error("No pnpm-workspace.yaml here or above.");
    return 2;
  }
  const ref = resolveBase(root, base);
  const label = `${git(root, ["log", "-1", "--format=%h %s", ref])}`;
  const file = path.join(root, LOCKFILE);
  const current = readFileSync(file, "utf8");
  const baseText = lockfileAt(root, ref);
  const c = classify(baseText, current);
  for (const line of render(c, label)) console.log(line);
  if (command === "report") return 0;

  if (current === baseText) {
    console.log(`${LOCKFILE} already matches ${label}. Nothing was written.`);
    return 0;
  }
  if (verdict(c) !== "peers-only") {
    console.error(
      `Not restoring: only a lockfile whose sole differences are peer re-resolutions is put back. Nothing was written.`,
    );
    return 1;
  }
  writeFileSync(file, baseText);
  console.log(`Wrote ${LOCKFILE} from ${label}; checking it with pnpm install --frozen-lockfile.`);
  if (frozenInstall(root)) {
    console.log(`${LOCKFILE} is back to ${label}, and pnpm accepts it as is.`);
    return 0;
  }
  writeFileSync(file, current);
  // The failed install may have relinked node_modules for the old lockfile.
  frozenInstall(root);
  console.error(`pnpm refused ${label}'s lockfile against today's package.json files, so the previous one is back.`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
