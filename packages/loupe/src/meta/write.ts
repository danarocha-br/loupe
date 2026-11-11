import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compare } from "./sources.js";
import type { ModuleMeta } from "./types.js";

/** 2-space JSON with sorted object keys and a trailing newline; arrays keep their order. */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => compare(a, b));
  return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
}

/** `meta/<source path>.json`, keeping the source extension so `x.ts` and `x.tsx` never collide. */
export function metaPath(outDir: string, source: string): string {
  return path.join(outDir, ...`${source}.json`.split("/"));
}

/** Writes only files whose bytes differ. Returns the paths written. */
export function writeMeta(outDir: string, modules: readonly ModuleMeta[]): string[] {
  const written: string[] = [];
  for (const meta of modules) {
    const file = metaPath(outDir, meta.source);
    const bytes = stableJson(meta);
    let current: string | undefined;
    try {
      current = readFileSync(file, "utf8");
    } catch {
      current = undefined;
    }
    if (current === bytes) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    written.push(file);
  }
  return written;
}
