"use server";

// The Proposal's project context (PER-99 §5): the repository, its commit, whether
// the working tree had uncommitted changes, and Loupe's version. The browser can't
// read any of it, so this Server Action reads git on the dev server at export time.
//
// Only the Toolbar imports this module, and the Toolbar reaches the page through
// `<LoupeMount />`'s development-only import, so a production build holds neither.

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { ProposalProject } from "../proposal/types.js";

/** A string only this module holds: `loupe doctor --build` looks for it to prove the action stayed out. */
const MARKER = "loupe-proposal-context";

function git(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd: process.cwd(), timeout: 5000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LOUPE_CALLER: MARKER } },
      (error, stdout) => resolve(error ? null : stdout.trim()),
    );
  });
}

/** `orbix-ai` from `git@github.com:me/orbix-ai.git` or `https://…/orbix-ai`. */
function repoName(remote: string | null, top: string | null): string | null {
  const fromRemote = remote?.replace(/\.git$/, "").split(/[/:]/).at(-1);
  if (fromRemote) return fromRemote;
  return top ? path.basename(top) : null;
}

function loupeVersion(): string | null {
  try {
    // Resolved from the app, which depends on Loupe: no bundler path guessing.
    const require = createRequire(path.join(process.cwd(), "package.json"));
    const file = require.resolve("@danarocha/loupe/package.json");
    return (JSON.parse(readFileSync(file, "utf8")) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

export async function readProjectContext(): Promise<ProposalProject> {
  const [commit, status, remote, top] = await Promise.all([
    git(["rev-parse", "HEAD"]),
    git(["status", "--porcelain"]),
    git(["config", "--get", "remote.origin.url"]),
    git(["rev-parse", "--show-toplevel"]),
  ]);
  return {
    repo: repoName(remote, top),
    commit,
    dirty: status === null ? null : status !== "",
    playgroundVersion: loupeVersion(),
  };
}
