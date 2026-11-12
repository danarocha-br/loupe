// What the Toolbar warns about in the Product layer (PER-133), read from disk on
// the dev server: components whose source changed since `loupe generate` hashed
// it (PER-100 §5), the names it has read, so a component it hasn't is "not
// generated yet" (PER-179), and a `formatVersion` this Loupe doesn't write (PER-85).
// Read-only: regeneration stays explicit, so nothing here writes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ADAPT_LIST_FORMAT_VERSION } from "./adapt-list.js";
import type { FormatNotice } from "./format-notice.js";
import { GENERATE_FORMAT_VERSION, readHeader } from "./generate/header.js";
import { compare, hashFile } from "./meta/sources.js";

export type StaleModule = {
  /** Repo-relative path of the module `generate` read. */
  source: string;
  /** Its exported components. The Toolbar flags them by name, so a same-named component elsewhere is flagged too. */
  components: string[];
  /** Repo-relative files whose hash no longer matches, or that are gone. */
  changed: string[];
};

export type LayerStatus = {
  /** The command that rewrites the Product layer, run from the repo root. */
  command: string;
  /** Null when the Product layer's format is the one this Loupe reads. */
  format: FormatNotice | null;
  /** Empty while `format` is set: an older or newer `meta/` can't be trusted. */
  stale: StaleModule[];
  /**
   * Every export name `meta/` holds, of any kind, sorted. A component on the page
   * that isn't here is new since the last `generate`. Null while `format` is set.
   */
  generated: string[] | null;
};

export type LayerPaths = {
  /** Absolute repo root; every path in `meta/` is relative to it. */
  root: string;
  /** Absolute path of the Product layer's adapt-list.json. */
  adaptList: string;
  /** Absolute app directory, where `@danarocha/loupe` is installed. */
  app: string;
};

const toPosix = (file: string) => file.split(path.sep).join("/");

/** `generate`'s default `--out`, as `init`'s PRODUCT_LAYER.path; not imported, since that module loads TypeScript. */
const DEFAULT_LAYER = "packages/loupe";

/** `pnpm -C apps/app exec loupe generate`, with `--out` only when the layer isn't the default `packages/loupe`. */
export function generateCommand({ root, adaptList, app }: LayerPaths): string {
  const layer = path.dirname(adaptList);
  const appRel = toPosix(path.relative(root, app));
  const out = path.resolve(root, DEFAULT_LAYER) === layer ? "" : ` --out ${toPosix(path.relative(app, layer)) || "."}`;
  return `${appRel === "" ? "pnpm" : `pnpm -C ${appRel}`} exec loupe generate${out}`;
}

export function readLayerStatus(paths: LayerPaths): LayerStatus {
  const command = generateCommand(paths);
  const format = formatOf(readFileSync(paths.adaptList, "utf8"));
  if (format !== null) return { command, format, stale: [], generated: null };
  const stale: StaleModule[] = [];
  const generated = new Set<string>();
  for (const file of metaFiles(path.join(path.dirname(paths.adaptList), "meta"))) {
    const meta = readMeta(file);
    if (meta === null) continue;
    for (const name of meta.exports) generated.add(name);
    const changed = Object.entries(meta.files)
      .filter(([relative, hash]) => hashOf(path.join(paths.root, relative)) !== hash)
      .map(([relative]) => relative);
    if (changed.length > 0) stale.push({ source: meta.source, components: meta.components, changed });
  }
  stale.sort((a, b) => compare(a.source, b.source));
  return { command, format: null, stale, generated: [...generated].sort(compare) };
}

/**
 * The header carries `generate`'s format and the `formatVersion` field the loader's;
 * each is compared with its own runtime version. A hand-edited or headerless file
 * is drift, which `loupe doctor` reports.
 */
export function formatOf(text: string): FormatNotice | null {
  const header = readHeader(text);
  if (header.kind === "intact" && header.formatVersion !== GENERATE_FORMAT_VERSION) {
    const runtime = GENERATE_FORMAT_VERSION;
    return { layer: header.formatVersion, runtime, newer: header.formatVersion > runtime };
  }
  let field: unknown;
  try {
    field = (JSON.parse(text) as { formatVersion?: unknown }).formatVersion;
  } catch {
    return null;
  }
  if (typeof field !== "number" || field === ADAPT_LIST_FORMAT_VERSION) return null;
  return { layer: field, runtime: ADAPT_LIST_FORMAT_VERSION, newer: field > ADAPT_LIST_FORMAT_VERSION };
}

function metaFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) found.push(full);
    }
  };
  walk(dir);
  return found;
}

type Meta = { source: string; files: Record<string, string>; components: string[]; exports: string[] };

// Keyed by path and stat, so a check after the first reads and hashes only what changed.
// Never evicted: they live as long as one dev server.
const metaCache = new Map<string, { stamp: string; meta: Meta | null }>();
const hashCache = new Map<string, { stamp: string; hash: string }>();

const stampOf = (file: string): string | null => {
  const stats = statSync(file, { throwIfNoEntry: false });
  return stats?.isFile() ? `${stats.mtimeMs}:${stats.size}` : null;
};

function readMeta(file: string): Meta | null {
  const stamp = stampOf(file);
  if (stamp === null) return null;
  const cached = metaCache.get(file);
  if (cached?.stamp === stamp) return cached.meta;
  let meta: Meta | null = null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      source?: unknown;
      files?: Record<string, unknown>;
      exports?: Record<string, { kind?: unknown }>;
    };
    if (typeof raw.source === "string" && raw.files && typeof raw.files === "object") {
      meta = {
        source: raw.source,
        files: Object.fromEntries(Object.entries(raw.files).filter((e): e is [string, string] => typeof e[1] === "string")),
        components: Object.entries(raw.exports ?? {})
          .filter(([, entry]) => entry?.kind === "component")
          .map(([name]) => name)
          .sort(),
        exports: Object.keys(raw.exports ?? {}),
      };
    }
  } catch {
    meta = null;
  }
  metaCache.set(file, { stamp, meta });
  return meta;
}

/** What `generate` stored for the file, or null for a file that is gone. */
function hashOf(file: string): string | null {
  const stamp = stampOf(file);
  if (stamp === null) return null;
  const cached = hashCache.get(file);
  if (cached?.stamp === stamp) return cached.hash;
  const hash = hashFile(file);
  hashCache.set(file, { stamp, hash });
  return hash;
}
