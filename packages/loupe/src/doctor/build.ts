// `loupe doctor --build` (PER-127): `next build` under Node, then `.next` scanned
// for anything of Loupe. `withLoupe` returns the config untouched outside
// `next dev`, and the layout's mount is dev-gated; this is the proof that both held.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { nextDir } from "../compat/repo.js";
import { compare } from "../meta/sources.js";

/**
 * What must not appear anywhere in a production build (PER-94, step 6).
 * Not `LoupeMount`: the layout's dev-gated mount is a `'use client'` module, so a
 * production build keeps it as a client reference that renders null. The Toolbar
 * stays out behind its dev-only dynamic import (PER-130); `data-loupe-toolbar`
 * is the attribute only Toolbar code writes, so it finds the Toolbar if it leaks.
 * `loupe-flag-preview` is the flag preview's Server Actions' marker (PER-132).
 */
export const BUILD_NEEDLES = [
  "data-ds-anchor",
  "__loupe",
  "loupe/dist/loader.cjs",
  "@repo/loupe",
  "@danarocha/loupe",
  "data-loupe-toolbar",
  "loupe-flag-preview",
] as const;

/**
 * What `required-server-files.json` must not name: it serialises the config's loader rules.
 * The loader is matched by its path inside Loupe, since other packages ship a `loader.cjs` too.
 */
export const SERVER_FILES_NEEDLES = ["loupe/dist/loader.cjs", "@danarocha/loupe", "adapt-list.json"] as const;

/**
 * Skipped: `cache` holds TypeScript's incremental state, which names every file
 * in the tsconfig, and `dev` is `next dev`'s own output, which a build leaves alone.
 */
const SKIPPED = new Set(["cache", "dev"]);

/**
 * Source maps are skipped too: their `sourcesContent` is the app's own source,
 * so the layout's import line of the mount is in them. Code that runs is in the
 * files they map, and those are scanned.
 */
const SOURCE_MAP = /\.map$/;

export type BuildResult = { code: number; describe: string };
export type BuildRunner = (appAbs: string, io: { out: (line: string) => void }) => Promise<BuildResult>;

/**
 * Runs the app's own `next` under Node, never the app's build script: on
 * orbix-ai that script runs Bun, and Loupe's production claim is about Node.
 */
export const nextBuild: BuildRunner = async (appAbs, io) => {
  const dir = nextDir(appAbs);
  if (!dir) return { code: 1, describe: `Next.js is not installed in ${appAbs}` };
  // Under Bun, `process.execPath` is Bun; fall back to the Node on PATH.
  const node = process.versions.bun ? "node" : process.execPath;
  const describe = `Node ${process.versions.bun ? "from PATH" : process.versions.node}, \`next build\``;
  io.out(`  Running next build under ${node} in ${appAbs} …`);
  const code = await new Promise<number>((resolve) => {
    const child = spawn(node, [path.join(dir, "dist", "bin", "next"), "build"], {
      cwd: appAbs,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", () => resolve(127));
    child.on("close", (status) => resolve(status ?? 1));
  });
  return { code, describe };
};

export type BuildScan = {
  /** False when `.next/required-server-files.json` is missing: no build to scan. */
  found: boolean;
  files: number;
  /** Each needle with the `.next`-relative files it was found in. */
  hits: Map<string, string[]>;
  /** Needles named by `required-server-files.json`. */
  serverFiles: string[];
};

export function scanBuild(dotNext: string): BuildScan {
  const hits = new Map<string, string[]>(BUILD_NEEDLES.map((n) => [n, []]));
  const serverFilesPath = path.join(dotNext, "required-server-files.json");
  if (!existsSync(serverFilesPath)) return { found: false, files: 0, hits, serverFiles: [] };

  const needles = BUILD_NEEDLES.map((n) => [n, Buffer.from(n)] as const);
  let files = 0;
  const walk = (relative: string) => {
    for (const entry of readdirSync(path.join(dotNext, relative), { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!(relative === "" && SKIPPED.has(entry.name))) walk(child);
      } else if (entry.isFile() && !SOURCE_MAP.test(entry.name)) {
        files += 1;
        const bytes = readFileSync(path.join(dotNext, child));
        for (const [needle, buffer] of needles) if (bytes.includes(buffer)) hits.get(needle)?.push(child);
      }
    }
  };
  walk("");
  for (const list of hits.values()) list.sort(compare);

  const serverFiles = readFileSync(serverFilesPath, "utf8");
  return { found: true, files, hits, serverFiles: SERVER_FILES_NEEDLES.filter((n) => serverFiles.includes(n)) };
}
