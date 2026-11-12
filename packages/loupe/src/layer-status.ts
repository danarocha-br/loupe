// What the Toolbar warns about in the Product layer (PER-133), read from disk on
// the dev server: components whose source changed since `loupe generate` hashed
// it (PER-100 §5), components it would add if it ran now ("not generated yet",
// PER-179), and a `formatVersion` this Loupe doesn't write (PER-85).
// Read-only: regeneration stays explicit, so nothing here writes.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { ADAPT_LIST_FORMAT_VERSION, parseAdaptList } from "./adapt-list.js";
import type { FormatNotice } from "./format-notice.js";
import { GENERATE_FORMAT_VERSION, readHeader } from "./generate/header.js";
import { compare, DESIGN_SYSTEM_INCLUDE, hashFile, sourceFiles, statStamp } from "./meta/sources.js";

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
   * Component-cased names exported by a file `generate` reads that `meta/` doesn't
   * list, sorted: what the next run would add. Null while `format` is set or the roots can't be read.
   */
  notGenerated: string[] | null;
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
  const text = readFileSync(paths.adaptList, "utf8");
  const format = formatOf(text);
  if (format !== null) return { command, format, stale: [], notGenerated: null };
  const stale: StaleModule[] = [];
  const bySource = new Map<string, Meta>();
  for (const file of metaFiles(path.join(path.dirname(paths.adaptList), "meta"))) {
    const meta = readMeta(file);
    if (meta === null) continue;
    bySource.set(meta.source, meta);
    const changed = Object.entries(meta.files)
      .filter(([relative, hash]) => hashOf(path.join(paths.root, relative)) !== hash)
      .map(([relative]) => relative);
    if (changed.length > 0) stale.push({ source: meta.source, components: meta.components, changed });
  }
  stale.sort((a, b) => compare(a.source, b.source));
  return { command, format: null, stale, notGenerated: notGenerated(paths, text, bySource) };
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

/** Names `generate` would add: exports of an in-scope file with no `meta/`, or new in one whose source changed. */
function notGenerated(paths: LayerPaths, adaptListText: string, bySource: ReadonlyMap<string, Meta>): string[] | null {
  let roots: { designSystem: string[]; app: string[] };
  try {
    roots = parseAdaptList(adaptListText, paths.adaptList);
  } catch {
    return null;
  }
  const layer = path.dirname(paths.adaptList);
  const files = sourceFiles([
    ...roots.designSystem.map((root) => path.join(paths.root, root, DESIGN_SYSTEM_INCLUDE)),
    ...roots.app.map((root) => path.join(paths.root, root)),
  ], [layer]);
  const found = new Set<string>();
  for (const file of files) {
    const relative = toPosix(path.relative(paths.root, file));
    const meta = bySource.get(relative);
    // Unchanged since `generate` read it: nothing new can be exported.
    if (meta && meta.files[relative] === hashOf(file)) continue;
    const known = new Set(meta?.exports ?? []);
    for (const name of exportedNames(file)) if (COMPONENT_CASE.test(name) && !known.has(name)) found.add(name);
  }
  return [...found].sort(compare);
}

/** PascalCase: `buttonVariants`, `useSidebar` or `MAX_ORGS` never names an Instance. */
const COMPONENT_CASE = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/;

// Keyed by path and stat, like the caches below.
const exportCache = new Map<string, { stamp: string; names: string[] }>();

/**
 * A module's named value exports, read with the loader's parser: `export function X`,
 * `export const X`, `export class X` and `export { X }`. Types, re-exports from
 * another module and the default export are left out; an Instance of a default
 * export is named by its import, never "default". A file that doesn't parse has none.
 */
export function exportedNames(file: string): string[] {
  const stamp = statStamp(file);
  if (stamp === null) return [];
  const cached = exportCache.get(file);
  if (cached?.stamp === stamp) return cached.names;
  const names: string[] = [];
  try {
    const program = parse(readFileSync(file, "utf8"), {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    }).program;
    for (const node of program.body) {
      if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type" || node.source) continue;
      const declaration = node.declaration;
      if (declaration?.type === "FunctionDeclaration" || declaration?.type === "ClassDeclaration") {
        if (declaration.id) names.push(declaration.id.name);
      } else if (declaration?.type === "VariableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.id.type === "Identifier") names.push(declarator.id.name);
        }
      }
      for (const specifier of node.specifiers) {
        if (specifier.type !== "ExportSpecifier" || specifier.exportKind === "type") continue;
        const exported = specifier.exported;
        names.push(exported.type === "Identifier" ? exported.name : exported.value);
      }
    }
  } catch {
    names.length = 0;
  }
  exportCache.set(file, { stamp, names });
  return names;
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


function readMeta(file: string): Meta | null {
  const stamp = statStamp(file);
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
  const stamp = statStamp(file);
  if (stamp === null) return null;
  const cached = hashCache.get(file);
  if (cached?.stamp === stamp) return cached.hash;
  const hash = hashFile(file);
  hashCache.set(file, { stamp, hash });
  return hash;
}
