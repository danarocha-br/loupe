// What the Toolbar warns about in the Product layer (PER-133), read from disk on
// the dev server: components whose source changed since `loupe generate` hashed
// it (PER-100 §5), and a `formatVersion` this Loupe doesn't write (PER-85).
// Read-only: regeneration stays explicit, so nothing here writes.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ADAPT_LIST_FORMAT_VERSION } from "./adapt-list.js";
import type { FormatNotice } from "./format-notice.js";
import { GENERATE_FORMAT_VERSION, readHeader } from "./generate/header.js";

export type StaleModule = {
  /** Repo-relative path of the module `generate` read. */
  source: string;
  /** Its exported components, which the Toolbar flags by name. */
  components: string[];
  /** Repo-relative files whose hash no longer matches, or that are gone. */
  changed: string[];
};

/** `layer`: from adapt-list.json's header or its field. `newer`: regenerating with this Loupe would downgrade it. */
export type FormatMismatch = FormatNotice;

export type LayerStatus = {
  /** The command that rewrites the Product layer, run from the repo root. */
  command: string;
  /** Null when the Product layer's format is the one this Loupe reads. */
  format: FormatMismatch | null;
  /** Empty while `format` is set: an older or newer `meta/` can't be trusted. */
  stale: StaleModule[];
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

/** `pnpm -C apps/app exec loupe generate`, with `--out` only when the layer isn't the default `packages/loupe`. */
export function generateCommand({ root, adaptList, app }: LayerPaths): string {
  const layer = path.dirname(adaptList);
  const appRel = toPosix(path.relative(root, app));
  const out = path.resolve(root, "packages/loupe") === layer ? "" : ` --out ${toPosix(path.relative(app, layer)) || "."}`;
  return `${appRel === "" ? "pnpm" : `pnpm -C ${appRel}`} exec loupe generate${out}`;
}

export function readLayerStatus(paths: LayerPaths): LayerStatus {
  const command = generateCommand(paths);
  const format = formatOf(readFileSync(paths.adaptList, "utf8"));
  if (format !== null) return { command, format, stale: [] };
  const stale: StaleModule[] = [];
  for (const file of metaFiles(path.join(path.dirname(paths.adaptList), "meta"))) {
    const meta = readMeta(file);
    if (meta === null) continue;
    const changed = Object.entries(meta.files)
      .filter(([relative, hash]) => hashOf(path.join(paths.root, relative)) !== hash)
      .map(([relative]) => relative);
    if (changed.length > 0) stale.push({ source: meta.source, components: meta.components, changed });
  }
  stale.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
  return { command, format: null, stale };
}

/**
 * The header carries `generate`'s format and the `formatVersion` field the loader's.
 * A hand-edited or headerless file is drift, which `loupe doctor` reports, not a format.
 */
export function formatOf(text: string): FormatMismatch | null {
  const header = readHeader(text);
  let field: unknown;
  try {
    field = (JSON.parse(text) as { formatVersion?: unknown }).formatVersion;
  } catch {
    field = undefined;
  }
  const headerVersion = header.kind === "intact" ? header.formatVersion : GENERATE_FORMAT_VERSION;
  const fieldVersion = typeof field === "number" ? field : ADAPT_LIST_FORMAT_VERSION;
  if (headerVersion === GENERATE_FORMAT_VERSION && fieldVersion === ADAPT_LIST_FORMAT_VERSION) return null;
  const off = headerVersion !== GENERATE_FORMAT_VERSION ? headerVersion : fieldVersion;
  const newer = headerVersion > GENERATE_FORMAT_VERSION || fieldVersion > ADAPT_LIST_FORMAT_VERSION;
  return { layer: off, runtime: GENERATE_FORMAT_VERSION, newer };
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

type Meta = { source: string; files: Record<string, string>; components: string[] };

// Keyed by path and stat, so a check after the first reads and hashes only what changed.
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
      };
    }
  } catch {
    meta = null;
  }
  metaCache.set(file, { stamp, meta });
  return meta;
}

/** `sha256:<hex>` as `generate` writes it, or null for a file that is gone. */
function hashOf(file: string): string | null {
  const stamp = stampOf(file);
  if (stamp === null) return null;
  const cached = hashCache.get(file);
  if (cached?.stamp === stamp) return cached.hash;
  const hash = `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
  hashCache.set(file, { stamp, hash });
  return hash;
}
