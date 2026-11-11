import { createRequire } from "node:module";
import path from "node:path";
import type * as Docgen from "react-docgen-typescript";
import type * as tsm from "ts-morph";
import type * as TypeScript from "typescript";
import { extractWithDocgen } from "./docgen-engine.js";
import { collectSources, type SourceSet } from "./sources.js";
import { extractWithTsMorph } from "./ts-morph-engine.js";
import type { ModuleMeta } from "./types.js";
import { writeMeta } from "./write.js";

export type Engine = "auto" | "ts-morph" | "docgen";

export type MetaOptions = {
  tsconfig: string;
  include: string[];
  outDir: string;
  engine: Engine;
};

export type MetaResult = {
  engine: ModuleMeta["engine"];
  modules: ModuleMeta[];
  written: string[];
  /** Set when `auto` fell back to react-docgen-typescript. */
  fallbackReason?: string;
  ms: number;
};

// Loaded on demand so `loupe --version` never pays for a TypeScript program.
const load = createRequire(import.meta.url);

/** Extracts prop metadata and writes `meta/<source path>.json`. Headless. */
export function runMeta(options: MetaOptions): MetaResult {
  const started = performance.now();
  const sources = collectSources(options.tsconfig, options.include);
  const { modules, fallbackReason } = extract(sources, options.engine);
  const written = writeMeta(options.outDir, modules);
  return {
    engine: modules[0]?.engine ?? (options.engine === "docgen" ? "react-docgen-typescript" : "ts-morph"),
    modules,
    written,
    fallbackReason,
    ms: Math.round(performance.now() - started),
  };
}

export function extract(sources: SourceSet, engine: Engine): { modules: ModuleMeta[]; fallbackReason?: string } {
  let ns: typeof tsm | undefined;
  let failure: string | undefined;
  try {
    ns = load("ts-morph") as typeof tsm;
    if (engine !== "docgen") return { modules: extractWithTsMorph(ns, sources) };
  } catch (error) {
    if (engine === "ts-morph") throw error;
    failure = error instanceof Error ? error.message.split("\n")[0] : String(error);
  }
  const docgen = load("react-docgen-typescript") as typeof Docgen;
  const ts = load("typescript") as typeof TypeScript;
  return { modules: extractWithDocgen(docgen, ts, ns, sources), fallbackReason: failure };
}

export const metaUsage = `Usage: loupe meta [options]

Reads prop metadata with the TypeScript checker and writes meta/<source path>.json.

Options:
  --tsconfig <path>   tsconfig of the package to read (default: ./tsconfig.json)
  --include <dir>     directory to read, relative to the tsconfig; repeatable (default: all)
  --out <dir>         where meta/ files go (default: ./meta)
  --engine <name>     auto | ts-morph | docgen (default: auto)`;

export function parseMetaArgs(argv: readonly string[]): MetaOptions | string {
  const options: MetaOptions = { tsconfig: "tsconfig.json", include: [], outDir: "meta", engine: "auto" };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--tsconfig" || flag === "--include" || flag === "--out" || flag === "--engine") {
      if (value === undefined || value.startsWith("--")) return `Missing value for ${flag}`;
      i += 1;
      if (flag === "--tsconfig") options.tsconfig = value;
      else if (flag === "--include") options.include.push(value);
      else if (flag === "--out") options.outDir = value;
      else if (value === "auto" || value === "ts-morph" || value === "docgen") options.engine = value;
      else return `Unknown engine: ${value}`;
    } else {
      return `Unknown option: ${flag}`;
    }
  }
  options.outDir = path.resolve(options.outDir);
  return options;
}

/** One line per fact; the Coverage summary proper belongs to `generate`. */
export function summarise(result: MetaResult): string[] {
  let components = 0;
  let editable = 0;
  let inspectOnly = 0;
  for (const module of result.modules) {
    for (const entry of Object.values(module.exports)) {
      if (entry.kind !== "component") continue;
      components += 1;
      for (const prop of Object.values(entry.props)) {
        if (prop.editable) editable += 1;
        else inspectOnly += 1;
      }
    }
  }
  const lines = [
    `${result.modules.length} modules · ${components} components · ${editable} editable props · ${inspectOnly} inspect only`,
    `${result.written.length} files written · ${result.engine} · ${(result.ms / 1000).toFixed(2)} s`,
  ];
  if (result.fallbackReason) lines.unshift(`ts-morph failed (${result.fallbackReason}); used react-docgen-typescript`);
  return lines;
}
