// The dirty-tree guard (PER-221), shared by `loupe init` and `loupe remove`. Both edit files, and
// Loupe only edits files git can restore, so each opens the guard first: no git repository, or
// uncommitted changes in a file the run would write, and it refuses before writing anything.
// The guard owns git status, the offset between the git top and Loupe's root, what
// `--allow-dirty` does and every word of its refusals; the commands decide which files they guard.
// A command may ask it more than once in a run (`init` asks again once the app is known), so the
// guard says each thing once: the Note, and each file `--allow-dirty` lets through.

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { LEDGER_PATH } from "./init/ledger.js";

export const NOTHING_WRITTEN = "Nothing was written.";
/** The one file both commands guard because a package manager rewrites it. */
export const LOCKFILE = "pnpm-lock.yaml";

/** The most files one list names; the rest are counted. */
const MAX_LISTED = 20;

export type GuardCommand = "init" | "remove";

export type GuardIo = { out: (line: string) => void; err: (line: string) => void };

/** What only `init` can tell the guard, and `remove` never passes; every field is optional. */
export type Hints = {
  /** Files to leave out: ones this run has just written itself. */
  except?: readonly string[];
  /** `init` is upgrading: when a file the version bump rewrites is dirty, the refusal says to commit it. */
  upgrade?: { from: string; to: string; bumped: readonly string[] };
  /** Files with a manual step still to be recorded: when one is dirty, the refusal points at `--adopt`. */
  pending?: readonly string[];
};

export type Guard = {
  /**
   * Whether the run must stop. `guarded` lists the paths the run would write, from the root; one ending in
   * `/` stands for everything under it. It prints as it decides: a refusal gives its reasons and "Nothing
   * was written."; `--allow-dirty` lists the guarded files it lets through and returns false; with none
   * of them dirty, `init` notes any other uncommitted changes. Asked again, it repeats neither the
   * Note nor a file it has already listed.
   */
  refuses(guarded: readonly string[], hints?: Hints): boolean;
};

/** Where the two commands differ: how each says what git is for, how each puts its rule, and whether it remarks on other changes. */
const PER_COMMAND = {
  init: { restores: "edits only files git can restore", action: "may write", notesOthers: true },
  remove: { restores: "removes only what git can restore", action: "would change", notesOthers: false },
} as const;

/** Opens the guard for one run at `root`. Outside a git repository it refuses at once, and returns nothing. */
export function openGuard(command: GuardCommand, root: string, allowDirty: boolean, io: GuardIo): Guard | undefined {
  const git = gitTop(root);
  if (!git) {
    io.err(`${root} isn't inside a git repository. Loupe ${PER_COMMAND[command].restores}.`);
    io.out(NOTHING_WRITTEN);
    return undefined;
  }
  // Where the root sits inside the git top, so a monorepo's other packages stay out of it.
  const prefix = path.relative(realpathSync(git), realpathSync(root)).split(path.sep).join("/");
  // What this run has already said, so a second question doesn't say it again.
  let noted = false;
  const allowed = new Set<string>();

  return {
    refuses(guarded, hints = {}) {
      const dirty = dirtyPaths(root, prefix, guarded);
      const blocking = dirty.blocking.filter((f) => !hints.except?.includes(f));
      if (blocking.length === 0) {
        // `remove` leaves what an earlier run changed unremarked.
        if (PER_COMMAND[command].notesOthers && dirty.other.length > 0 && !noted) {
          noted = true;
          io.out(`Note: ${dirty.other.length} other file(s) have uncommitted changes; Loupe won't touch them.`);
        }
        return false;
      }
      const list = (lead: string, files: readonly string[]) => {
        io.err(lead);
        for (const f of files.slice(0, MAX_LISTED)) io.err(`  ${f}`);
        if (files.length > MAX_LISTED) io.err(`  … and ${files.length - MAX_LISTED} more`);
      };
      if (allowDirty) {
        const fresh = blocking.filter((f) => !allowed.has(f));
        // Only the names the list shows count as said: one it cut off comes up next time.
        for (const f of fresh.slice(0, MAX_LISTED)) allowed.add(f);
        if (fresh.length > 0) list("Proceeding with uncommitted changes (--allow-dirty) in:", fresh);
        return false;
      }
      list(`These files have uncommitted changes, and loupe ${command} ${PER_COMMAND[command].action} them:`, blocking);
      const { upgrade } = hints;
      if (upgrade && blocking.some((f) => upgrade.bumped.includes(f))) {
        io.err(`${LEDGER_PATH} records Loupe ${upgrade.from}, and ${upgrade.to} is installed: commit the version bump, then rerun loupe init.`);
      } else {
        io.err("Commit or stash them, or rerun with --allow-dirty.");
      }
      if (hints.pending?.some((f) => blocking.includes(f))) {
        io.err("If that is a manual step you just made, record it with loupe init --adopt.");
      }
      io.out(NOTHING_WRITTEN);
      return true;
    },
  };
}

function gitTop(root: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

/** The uncommitted paths under the root, relative to it, split by whether `guarded` covers them. */
function dirtyPaths(root: string, prefix: string, guarded: readonly string[]): { blocking: string[]; other: string[] } {
  const out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  });
  const entries = out.split("\0");
  const dirty: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] ?? "";
    if (entry.length < 4) continue;
    const status = entry.slice(0, 2);
    const files = [entry.slice(3)];
    // A rename's source follows as its own entry, and is a change too.
    if (status.startsWith("R") || status.startsWith("C")) files.push(entries[++i] ?? "");
    for (const file of files) {
      if (!prefix) dirty.push(file);
      else if (file.startsWith(`${prefix}/`)) dirty.push(file.slice(prefix.length + 1));
    }
  }
  const blocks = (f: string) => guarded.some((g) => (g.endsWith("/") ? f.startsWith(g) : f === g));
  // A path can come twice: a rename's source that is also a new file.
  const unique = [...new Set(dirty)];
  return { blocking: unique.filter(blocks), other: unique.filter((f) => !blocks(f)) };
}
