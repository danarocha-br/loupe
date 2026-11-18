import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { verdict } from "../scripts/lockfile.mjs";
import { RESULTS } from "../scripts/upgrade.mjs";

// What the upgrade skill promises about its own text: it quotes the CLI as the CLI prints it, branches on the
// words the scripts print, and makes no commit but the version bump.

const plugin = fileURLToPath(new URL("..", import.meta.url));
const repo = path.resolve(plugin, "../..");
const raw = (skill) => readFileSync(path.join(plugin, "skills", skill, "SKILL.md"), "utf8");
const upgrade = raw("upgrade");
// Lines wrap in the file; a quote is one run of words.
const text = upgrade.replace(/\s+/g, " ");

/** Every non-test source file of the CLI, whichever module holds the message today. */
function cliSource() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(readFileSync(file, "utf8"));
    }
  };
  walk(path.join(repo, "packages/loupe/src"));
  return out.join("\n");
}

/**
 * `say` is the words in the skill, which must be there as written. `src` is the literal pieces of the CLI that print
 * them (a message built from variables is several pieces), which must all still be in its source.
 */
const QUOTED = [
  // The guard builds this from the command ("init" and "may write"), so it is three pieces in the CLI's source.
  {
    say: "These files have uncommitted changes, and loupe init may write them:",
    src: ["These files have uncommitted changes, and loupe ", 'action: "may write"', " them:"],
  },
  { say: "commit the version bump, then rerun loupe init.", src: ["is installed: commit the version bump, then rerun loupe init."] },
  { say: "Commit or stash them, or rerun with --allow-dirty.", src: ["Commit or stash them, or rerun with --allow-dirty."] },
  {
    say: "To upgrade, set it to <new>, run pnpm install, commit, then rerun loupe init.",
    src: ["To upgrade, set it to ", ", run pnpm install, commit, then rerun loupe init."],
  },
  { say: "Upgraded from Loupe <old> to <new>.", src: ["Upgraded from Loupe "] },
  { say: "Rerun loupe init to finish upgrading to <new>.", src: ["Rerun loupe init to finish upgrading to "] },
  { say: "stays at Loupe <old> until they are resolved", src: [" stays at Loupe ", "until they are resolved"] },
  { say: "stays at Loupe <old> until the manual steps are recorded", src: [" stays at Loupe ", "until the manual steps are recorded"] },
  { say: "attention; loupe init never overwrites them.", src: ["attention; loupe init never overwrites them."] },
  { say: "needed. After making it, run loupe init --adopt.", src: [" needed. After making ", ", run loupe init --adopt."] },
  { say: "changed since loupe init recorded it; left as is", src: ["changed since loupe init recorded it; left as is"] },
  { say: "edited by hand since loupe init wrote it; left as is", src: ["edited by hand since loupe init wrote it; left as is"] },
  { say: "edited by hand since loupe generate wrote it", src: ["edited by hand since loupe generate wrote it"] },
  { say: "Restore <file> with git, or move it away, then rerun loupe init.", src: [" with git, or move it away, then rerun loupe init."] },
  { say: "Result: Loupe can't be installed here.", src: ["Result: Loupe can't be installed here."] },
  { say: "No design system was chosen.", src: ["No design system was chosen."] },
  { say: "Continue? (yes/no)", src: ["Continue? (yes/no)"] },
];

describe("the upgrade skill", () => {
  it("quotes the CLI's messages as it prints them, wherever they live in its source", () => {
    const cli = cliSource();
    for (const { say, src } of QUOTED) {
      assert.ok(text.includes(say), `the skill no longer says: ${say}`);
      for (const piece of src) assert.ok(cli.includes(piece), `the CLI no longer prints "${piece}", which the skill quotes as: ${say}`);
    }
  });

  it("branches on exactly the words `upgrade.mjs status` can end with", () => {
    const step1 = upgrade.split(/^## 2\./m)[0];
    const branched = [...step1.matchAll(/^- `([a-z-]+)`:/gm)].map((m) => m[1]);
    assert.deepEqual([...branched].sort(), [...RESULTS].sort());
  });

  it("branches on every verdict `lockfile.mjs report` can give after an upgrade", () => {
    const none = { own: [], peers: [], moved: [], manifest: [] };
    const row = {};
    const words = [
      verdict({ ...none, own: [row] }),
      verdict({ ...none, own: [row], peers: [row] }),
      verdict({ ...none, moved: [row] }),
      verdict(none),
      verdict({ ...none, peers: [row] }),
    ];
    const step6 = upgrade.split(/^## 6\./m)[1].split(/^## 7\./m)[0];
    for (const word of words) assert.ok(step6.includes(`\`${word}\``), `step 6 doesn't branch on ${word}`);
  });

  it("runs the CLI only through the pinned runner, and the two scripts it names", () => {
    for (const run of [
      "UPGRADE status",
      "UPGRADE bump",
      "LOUPE --pinned check --app <app> </dev/null",
      "LOUPE --pinned init --app <app>",
      "LOUPE --pinned init --adopt --app <app> </dev/null",
      "LOUPE doctor",
      'lockfile.mjs" report --base HEAD',
    ]) {
      assert.ok(text.includes(run), `the skill doesn't run: ${run}`);
    }
    assert.ok(text.includes('node "${CLAUDE_PLUGIN_ROOT}/scripts/upgrade.mjs"'));
    assert.ok(text.includes('node "${CLAUDE_PLUGIN_ROOT}/scripts/loupe.mjs"'));
  });

  it("installs again after init, before doctor, because init pins the version in the layer's peerDependencies", () => {
    // The premise, in the CLI: init writes the Product layer's package.json with the version as a peer, and
    // never runs the package manager. If either changes, step 8.1 needs another look.
    const cli = cliSource();
    assert.match(cli, /peerDependencies: \{\s*\[NPM_PACKAGE\]: input\.version/);
    assert.ok(cli.includes("It never runs the package manager"), "init no longer says it never runs the package manager");
    const step8 = upgrade.split(/^## 8\./m)[1];
    assert.ok(step8.includes("peerDependencies"));
    assert.ok(step8.indexOf("`pnpm install`") !== -1 && step8.indexOf("`pnpm install`") < step8.indexOf("`LOUPE doctor`"));
  });

  it("makes one commit, of the two files the bump changes", () => {
    const commits = text.match(/git commit [^`]*/g) ?? [];
    assert.deepEqual(commits, ['git commit -m "chore: upgrade Loupe to <new>" -- <app>/package.json pnpm-lock.yaml']);
  });

  it("points only at steps that exist, in itself and in the install skill", () => {
    const headings = [...upgrade.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
    assert.deepEqual(headings, headings.map((_, i) => i + 1));
    const own = text.replace(/step 7 of the install skill/g, "");
    for (const m of own.matchAll(/\bstep (\d+)/g)) assert.ok(headings.includes(Number(m[1])), `step ${m[1]} doesn't exist`);
    assert.match(raw("install"), /^## 7\. Check in the browser/m);
  });

  it("sends the designer to the plugin update, not an npm lookup, for a newer Loupe", () => {
    assert.ok(text.includes("claude plugin marketplace update loupe"));
    assert.ok(text.includes("claude plugin update loupe@loupe"));
    for (const lookup of ["npm view", "npm outdated", "npm info"]) assert.equal(text.includes(lookup), false, lookup);
  });
});
