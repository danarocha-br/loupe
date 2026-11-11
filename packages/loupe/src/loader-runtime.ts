// The file-system half of the dev loader: reads `adapt-list.json`, resolves
// modules, and hands everything to the pure `transform`. `loader.cts` is the
// CommonJS shell Turbopack loads; it imports this module.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { type AdaptList, parseAdaptList } from "./adapt-list.js";
import { createResolver } from "./resolve.js";
import { transform } from "./transform.js";

export type LoaderOptions = {
  /** Absolute repo root. */
  root: string;
  /** Absolute path of the Product layer's `adapt-list.json`. */
  adaptList: string;
};

const resolver = createResolver();
let cached: { file: string; mtimeMs: number; list: AdaptList } | null = null;

function readAdaptList(file: string): AdaptList {
  const { mtimeMs } = statSync(file);
  if (cached?.file === file && cached.mtimeMs === mtimeMs) return cached.list;
  const list = parseAdaptList(readFileSync(file, "utf8"), file);
  cached = { file, mtimeMs, list };
  return list;
}

export function runLoader(
  source: string,
  resourcePath: string,
  options: LoaderOptions,
): { code: string; map: string | null; dependencies: string[] } {
  // Turbopack caches each file's output: it must be told which other files that
  // output read, or editing adapt-list.json or a target's 'use client' leaves it stale.
  const dependencies = new Set([options.adaptList]);
  const { code, map } = transform(source, resourcePath, {
    root: options.root,
    adaptList: readAdaptList(options.adaptList),
    layerDir: path.dirname(options.adaptList),
    resolve: resolver.resolve,
    isClientModule: (file) => {
      dependencies.add(file);
      return resolver.isClientModule(file);
    },
  });
  return { code, map, dependencies: [...dependencies] };
}
