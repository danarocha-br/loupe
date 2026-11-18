import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { committedRepo, git, makeRepo } from "./compat/repo.fixture.js";
import { type GuardCommand, type Hints, NOTHING_WRITTEN, openGuard } from "./dirty-tree.js";
import { LEDGER_PATH } from "./init/ledger.js";

function write(root: string, files: Record<string, string>): void {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
}

/** A directory holding `files` only; the repo fixture's supported-repo files are left out. */
function tempDir(files: Record<string, string> = {}): string {
  return makeRepo(files, {});
}

/** A committed git repo holding `files`. */
function repo(files: Record<string, string>): string {
  return committedRepo(files, {});
}

/** One run of a command at `root`: what the guard said, and whether it stopped. */
function run(command: GuardCommand, root: string, guarded: string[], hints?: Hints, allowDirty = false) {
  const out: string[] = [];
  const err: string[] = [];
  const guard = openGuard(command, root, allowDirty, { out: (l) => out.push(l), err: (l) => err.push(l) });
  const refused = guard ? guard.refuses(guarded, hints) : undefined;
  return { opened: guard !== undefined, refused, out, err, said: [...err, ...out] };
}

describe("outside a git repository", () => {
  it("refuses, in each command's words, even with --allow-dirty", () => {
    const root = tempDir();
    const init = run("init", root, [], undefined, true);
    expect(init.opened).toBe(false);
    expect(init.err).toEqual([`${root} isn't inside a git repository. Loupe edits only files git can restore.`]);
    expect(init.out).toEqual([NOTHING_WRITTEN]);

    const remove = run("remove", root, [], undefined, true);
    expect(remove.opened).toBe(false);
    expect(remove.err).toEqual([`${root} isn't inside a git repository. Loupe removes only what git can restore.`]);
    expect(remove.out).toEqual([NOTHING_WRITTEN]);
  });
});

describe("a clean tree", () => {
  it("lets the run go on without a word", () => {
    const root = repo({ "a.txt": "a\n" });
    for (const command of ["init", "remove"] as const) {
      const result = run(command, root, ["a.txt"]);
      expect(result.refused).toBe(false);
      expect(result.said).toEqual([]);
    }
  });
});

describe("uncommitted changes in a guarded file", () => {
  const files = { "a.txt": "a\n", "b.txt": "b\n" };

  it("refuses and says whose rule it is: init may write the file, remove would change it", () => {
    const root = repo(files);
    write(root, { "a.txt": "changed\n" });

    const init = run("init", root, ["a.txt"]);
    expect(init.refused).toBe(true);
    expect(init.err).toEqual([
      "These files have uncommitted changes, and loupe init may write them:",
      "  a.txt",
      "Commit or stash them, or rerun with --allow-dirty.",
    ]);
    expect(init.out).toEqual([NOTHING_WRITTEN]);

    const remove = run("remove", root, ["a.txt"]);
    expect(remove.refused).toBe(true);
    expect(remove.err).toEqual([
      "These files have uncommitted changes, and loupe remove would change them:",
      "  a.txt",
      "Commit or stash them, or rerun with --allow-dirty.",
    ]);
    expect(remove.out).toEqual([NOTHING_WRITTEN]);
  });

  it("counts a new file, which git lists untracked", () => {
    const root = repo(files);
    write(root, { "new/c.txt": "c\n" });
    expect(run("init", root, ["new/"]).err).toContain("  new/c.txt");
  });

  it("goes on with --allow-dirty, listing the files and not claiming nothing was written", () => {
    const root = repo(files);
    write(root, { "a.txt": "changed\n" });
    for (const command of ["init", "remove"] as const) {
      const result = run(command, root, ["a.txt"], undefined, true);
      expect(result.refused).toBe(false);
      expect(result.err).toEqual(["Proceeding with uncommitted changes (--allow-dirty) in:", "  a.txt"]);
      expect(result.out).toEqual([]);
    }
  });

  it("lists twenty files and counts the rest", () => {
    const root = repo({ "keep.txt": "x\n" });
    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`layer/f${String(i).padStart(2, "0")}.txt`, "x\n"]));
    write(root, many);
    const { err } = run("init", root, ["layer/"]);
    expect(err.filter((l) => l.startsWith("  layer/"))).toHaveLength(20);
    expect(err).toContain("  layer/f19.txt");
    expect(err).not.toContain("  layer/f20.txt");
    expect(err).toContain("  … and 5 more");
  });

  it("counts a rename by its source too", () => {
    const root = repo({ "layer/old.txt": "x\n" });
    git(root, "mv", "layer/old.txt", "elsewhere.txt");
    expect(run("init", root, ["layer/"]).err).toContain("  layer/old.txt");
  });
});

describe("what a guarded path covers", () => {
  it("is exactly the file, or everything under a directory ending in a slash", () => {
    const root = repo({ "pnpm-lock.yaml": "x\n", "layer/a.txt": "x\n", "layer-two/b.txt": "x\n" });
    write(root, { "pnpm-lock.yaml": "y\n", "pnpm-lock.yaml.bak": "y\n", "layer/a.txt": "y\n", "layer-two/b.txt": "y\n" });
    const { err } = run("init", root, ["pnpm-lock.yaml", "layer/"]);
    expect(err.filter((l) => l.startsWith("  "))).toEqual(["  layer/a.txt", "  pnpm-lock.yaml"]);
  });
});

describe("changes to files outside the guarded ones", () => {
  it("only init notes them, and only when nothing blocks", () => {
    const root = repo({ "a.txt": "a\n" });
    write(root, { "notes.md": "x\n", "more.md": "x\n" });

    const init = run("init", root, ["a.txt"]);
    expect(init.refused).toBe(false);
    expect(init.out).toEqual(["Note: 2 other file(s) have uncommitted changes; Loupe won't touch them."]);

    const remove = run("remove", root, ["a.txt"]);
    expect(remove.refused).toBe(false);
    expect(remove.said).toEqual([]);

    write(root, { "a.txt": "changed\n" });
    expect(run("init", root, ["a.txt"]).said.some((l) => l.startsWith("Note:"))).toBe(false);
  });
});

describe("a root below the top of the git repository", () => {
  /** `outer/` is the git repo; Loupe's root is `outer/mono/`. */
  function nested(): { outer: string; mono: string } {
    const outer = repo({
      "README.md": "x\n",
      "mono/a.txt": "a\n",
      "mono/pkg/b.txt": "b\n",
      "mono-other/c.txt": "c\n",
    });
    return { outer, mono: path.join(outer, "mono") };
  }

  it("ignores changes outside the root, even in a sibling that shares its name's start", () => {
    const { outer, mono } = nested();
    write(outer, { "README.md": "changed\n", "mono-other/c.txt": "changed\n", "stray.txt": "x\n" });
    const result = run("init", mono, ["a.txt", "pkg/"]);
    expect(result.refused).toBe(false);
    expect(result.said).toEqual([]);
  });

  it("names the files it finds from the root, not from the top", () => {
    const { outer, mono } = nested();
    write(outer, { "mono/a.txt": "changed\n", "mono/pkg/b.txt": "changed\n", "mono/other.md": "x\n", "README.md": "changed\n" });
    const result = run("init", mono, ["a.txt", "pkg/"]);
    expect(result.refused).toBe(true);
    expect(result.err.filter((l) => l.startsWith("  "))).toEqual(["  a.txt", "  pkg/b.txt"]);
  });

  it("counts the other changes under the root only", () => {
    const { outer, mono } = nested();
    write(outer, { "mono/other.md": "x\n", "README.md": "changed\n" });
    expect(run("init", mono, ["a.txt"]).out).toEqual(["Note: 1 other file(s) have uncommitted changes; Loupe won't touch them."]);
  });

  it("follows a symlinked root to the same place git does", () => {
    const { outer, mono } = nested();
    const link = path.join(tempDir(), "link");
    symlinkSync(mono, link);
    write(outer, { "mono/a.txt": "changed\n" });
    expect(run("remove", link, ["a.txt"]).refused).toBe(true);
  });
});

describe("the hints a command gives", () => {
  const files = { "apps/web/package.json": "{}\n", "pnpm-lock.yaml": "x\n", "apps/web/next.config.ts": "x\n", [LEDGER_PATH]: "{}\n" };
  const upgrade = { from: "0.0.4", to: "0.0.5", bumped: ["pnpm-lock.yaml", "apps/web/package.json"] };

  it("tells an upgrade to commit its version bump when the bump is what is dirty", () => {
    for (const bumped of ["apps/web/package.json", "pnpm-lock.yaml"]) {
      const root = repo(files);
      write(root, { [bumped]: "changed\n" });
      const result = run("init", root, ["apps/web/next.config.ts", ...upgrade.bumped], { upgrade });
      expect(result.refused).toBe(true);
      expect(result.err).toEqual([
        "These files have uncommitted changes, and loupe init may write them:",
        `  ${bumped}`,
        `${LEDGER_PATH} records Loupe 0.0.4, and 0.0.5 is installed: commit the version bump, then rerun loupe init.`,
      ]);
      expect(result.out).toEqual([NOTHING_WRITTEN]);
    }
  });

  it("gives the plain advice when something else is dirty during an upgrade", () => {
    const root = repo(files);
    write(root, { "apps/web/next.config.ts": "changed\n" });
    const result = run("init", root, ["apps/web/next.config.ts", ...upgrade.bumped], { upgrade });
    expect(result.err).toContain("Commit or stash them, or rerun with --allow-dirty.");
    expect(result.err.join("\n")).not.toContain("commit the version bump");
  });

  it("points a dirty manual step at --adopt", () => {
    const root = repo(files);
    write(root, { "apps/web/next.config.ts": "changed\n" });
    const guarded = ["apps/web/next.config.ts", "pnpm-lock.yaml"];

    const pending = run("init", root, guarded, { pending: ["apps/web/next.config.ts"] });
    expect(pending.err).toEqual([
      "These files have uncommitted changes, and loupe init may write them:",
      "  apps/web/next.config.ts",
      "Commit or stash them, or rerun with --allow-dirty.",
      "If that is a manual step you just made, record it with loupe init --adopt.",
    ]);

    expect(run("init", root, guarded, { pending: ["apps/web/package.json"] }).said.join("\n")).not.toContain("--adopt");
  });

  it("says neither when --allow-dirty went ahead", () => {
    const root = repo(files);
    write(root, { "apps/web/package.json": "changed\n", "apps/web/next.config.ts": "changed\n" });
    const result = run("init", root, ["apps/web/next.config.ts", "apps/web/package.json"], { upgrade, pending: ["apps/web/next.config.ts"] }, true);
    expect(result.err).toEqual(["Proceeding with uncommitted changes (--allow-dirty) in:", "  apps/web/next.config.ts", "  apps/web/package.json"]);
  });

  it("leaves out a file this run wrote itself, and does not count it as another", () => {
    const root = repo(files);
    write(root, { [LEDGER_PATH]: '{"changed":true}\n' });
    const alone = run("init", root, ["packages/loupe/"], { except: [LEDGER_PATH] });
    expect(alone.refused).toBe(false);
    expect(alone.said).toEqual([]);

    write(root, { "packages/loupe/other.txt": "x\n" });
    const withOther = run("init", root, ["packages/loupe/"], { except: [LEDGER_PATH] });
    expect(withOther.refused).toBe(true);
    expect(withOther.err).toContain("  packages/loupe/other.txt");
    expect(withOther.err).not.toContain(`  ${LEDGER_PATH}`);
  });
});
