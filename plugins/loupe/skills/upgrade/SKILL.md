---
name: upgrade
description: Upgrade Loupe in this repo to the release this plugin installs - check where the upgrade stands, bump @danarocha/loupe to that exact version, run pnpm install, commit the bump on a yes, rerun loupe init, install again, then run loupe doctor and tell the designer to restart next dev.
---

# Loupe: upgrade

An upgrade moves an install to the one Loupe release this plugin installs, never to "latest" and never to a version
the designer names. The `loupe` CLI does the real work: rerun with the newer version installed, `loupe init`
reconciles the Product layer and the four edits item by item and records the new version last. This skill bumps the
one dependency, installs, commits that bump on a yes, runs `init` and relays what it prints. **You never edit
`packages/loupe` yourself, by any tool** (a hook refuses Edit and Write there), you never run `npx …@latest`,
`pnpm add`, `pnpm update` or change `pnpm.overrides`, and the only commit you make is the version bump in step 6,
on a clear yes. Loupe never moves an install to an older version.

Run every command from the repo root (the folder with `pnpm-workspace.yaml`). `LOUPE` below means
`node "${CLAUDE_PLUGIN_ROOT}/scripts/loupe.mjs"`, which runs the app's own Loupe copy once it is installed.
`UPGRADE` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/upgrade.mjs"`. `<app>` is the app's folder that `status`
prints, `<old>` is the Loupe version the ledger records and `<new>` the one this plugin installs. When a command
refuses for a reason no step below covers, relay what it printed word for word and stop; never work around it.

## 1. Where the upgrade stands

Run `UPGRADE status` (add `--app <dir>` only if the designer names the app; the ledger's app is used otherwise).
It writes nothing. Tell the designer in a line which Loupe this plugin installs, which one the ledger records and
which one the app has. Then by its `Result:` line:

- `not-installed`: Loupe isn't installed here, so there is nothing to upgrade. Offer the **install** skill. Stop.
- `up-to-date`: the ledger already records the release this plugin installs. Say so. If the designer expects a
  newer Loupe, the plugin has to move first, since the plugin decides the version: `claude plugin marketplace
  update loupe`, then `claude plugin update loupe@loupe`, then restart Claude Code and run this skill again. Offer
  the **doctor** skill. Stop.
- `plugin-behind`: the install (its ledger, its copy or its `package.json`) is on a newer Loupe than the one this
  plugin installs, and Loupe never moves back. Give the same plugin update and say to run this skill again after
  it. Stop.
- `app-pin-not-plain`: the app's `package.json` doesn't name `@danarocha/loupe` with a plain version (a `catalog:`
  or `workspace:` pin, a range, or missing), so there is nothing here to bump. Say the version has to be set to the
  one this plugin installs where the designer defines it, followed by `pnpm install`, a commit and this skill
  again. Don't guess where. Stop.
- `upgrade`: go on to step 2.
- `resume`: an earlier run got part of the way, because the app already asks for, or has, the new version. Say so
  and go on to step 2.

## 2. Before anything

Run `git status --short`. `loupe init` refuses to run while the app's `package.json`, `next.config.ts`, root
`layout.tsx`, the root Biome config, `pnpm-lock.yaml` or `packages/loupe/` have uncommitted changes. Never pass
`--allow-dirty` unless the designer asks for it by name, apart from the one case below.

- `upgrade`: if any of those files has changes, list them and ask the designer to commit or stash first. Stop.
  (Otherwise the bump commit would carry their own edits, and `init` would refuse right after.)
- `resume`: changes in `<app>/package.json` and `pnpm-lock.yaml` are expected; step 6 commits them. For the other
  files in that list:
  - If there are none, go on.
  - If they are only in `packages/loupe/` (what an earlier `init` wrote before it stopped), plus the one touch
    point the designer fixed or edited through this skill, name them and ask whether to continue with
    `--allow-dirty`. On a clear yes, pass it in step 7.
  - If anything else has changes, list it and ask the designer to commit or stash it first. Stop.

## 3. Explain what will change, and ask for the yes

Tell the designer that upgrading `<app>` from Loupe `<old>` to `<new>` will:

- set `@danarocha/loupe` in `<app>/package.json` to exactly `<new>`, without `^`;
- run `pnpm install`, which updates `pnpm-lock.yaml`. Loupe's own entries move; pnpm can also re-resolve an optional
  peer, such as `typescript`, in packages that don't depend on it themselves. That changes no code;
- run `loupe init` again with `<new>` installed. It runs the compatibility check again, which can ask once about an
  untested item or which design system; rewrites the files in `packages/loupe` that it wrote and nobody edited;
  reapplies one of its four edits that went missing; regenerates the Adapters and prop metadata; and records
  `<new>` in the ledger last, only if nothing was left blocked. It never overwrites a file edited by hand;
- run `pnpm install` once more, because `init` rewrites the Product layer's own `package.json`, which pins the
  Loupe version in `peerDependencies`, and `init` never runs the package manager itself;
- change nothing in a production build.

Say what git will see: the bump (those two files, nothing else) is committed by you on the current branch, after
you show the diff and the designer says yes again, because `init` won't run while they have uncommitted changes.
Everything after that stays uncommitted, for the designer to review and commit, as after an install: what `init`
wrote, and the lockfile change from the second install.

Ask: "Shall I upgrade Loupe from `<old>` to `<new>`?" Continue only on a clear yes. For `resume`, say where the
last run stopped and ask "Shall I continue upgrading Loupe to `<new>`?"

## 4. Bump, and `pnpm install`

1. For `upgrade` only, run `UPGRADE bump`. It sets that one dependency to `<new>`, exact, keeps the file's
   formatting and writes nothing else. It refuses (exit 1) while `<app>/package.json` or the lockfile has
   uncommitted changes. Relay a refusal and stop.
2. Run `pnpm install` (a plain install, 10-minute timeout). If it fails (`<new>` may not be on npm yet), relay the
   error and stop. Nothing is committed.

"Put the two files back" in the steps below means `git restore -- <app>/package.json pnpm-lock.yaml`, on a clear
yes. It discards every uncommitted change in those two files, so after a `resume` show
`git diff -- <app>/package.json pnpm-lock.yaml` first, since they may hold changes of the designer's own.

## 5. The compatibility check, and the Untested question

`init` runs the compatibility check again with `<new>`, so ask what it will ask now, once. Run
`LOUPE --pinned check --app <app> </dev/null`. It writes nothing. Exit code 3 means the app's copy isn't `<new>`:
relay the line and stop. Then:

- If it lists several design systems and ends with "No design system was chosen.", show the list and ask which one.
  There is no flag for it: rerun with that number on stdin, `printf '<n>\n' | LOUPE --pinned check --app <app>`,
  and keep the number for step 7.
- `Result: Loupe can't be installed here.`: relay the ✗ lines word for word and stop. Nothing was written, and the
  bump isn't committed: offer to put the two files back, then run `pnpm install` again.
- `Result: works here.`, or `… untested item(s), accepted before.`: nothing to ask.
- `Result: works here, with N untested item(s).` (followed by "Continue? (yes/no)" and "Nothing was written."
  because nobody answered): this is the **Untested question, and you ask it once, here**. Show each `!` line and
  its risk sentence word for word, then ask "Loupe hasn't been proven on these yet. Continue anyway?" On no, stop
  and offer to put the two files back, as above. On yes, remember it: you pass it to `init` in step 7.

## 6. The lockfile, and the commit

Skip this step when `<app>/package.json` and `pnpm-lock.yaml` have no uncommitted changes (a `resume` after the
commit was made).

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lockfile.mjs" report --base HEAD`. By its `Result:` line:
   - `loupe-only` or `loupe-and-peers`: as explained in step 3. For `loupe-and-peers`, say in one line which
     packages had their peer re-resolved. Go to 2.
   - `other-changes`: a dependency moved that Loupe didn't ask for. List those lines, say it is a Loupe bug worth
     reporting, and ask whether to commit anyway or put the two files back. After an `upgrade`, putting them back
     loses nothing: both were clean before the bump. On "put them back", do it and stop. On "commit anyway", go
     to 2.
   - `unchanged` or `peers-only`: Loupe's entries didn't move, so the install didn't take. Relay the pnpm output
     and stop.
2. Show `git diff -- <app>/package.json` and `git diff --stat -- pnpm-lock.yaml`. The `package.json` diff should be
   the one `@danarocha/loupe` line. After a `resume`, if it holds anything else, say so and ask whether those
   changes belong in the commit. Then ask: "Commit these two files on branch `<branch>` as `chore: upgrade Loupe to
   <new>`?" (the branch is `git branch --show-current`). On a clear yes, run
   `git commit -m "chore: upgrade Loupe to <new>" -- <app>/package.json pnpm-lock.yaml`, which commits those two
   paths and nothing else. If it fails (a hook, a missing git identity), relay git's message and stop: the files
   stay as they are, and a hook is never skipped. On no, stop: the files stay as they are, `init` won't run until
   they are committed, and this skill resumes from here.

## 7. Run `loupe init`

`init` reruns the check and asks the same questions in the same order, so pipe the designer's answers from step 5,
one per line: the design-system number if it was asked, then `yes` if there were untested items to accept. Add
`--allow-dirty` only as step 2 allows.

- Both: `printf '<n>\nyes\n' | LOUPE --pinned init --app <app>`.
- Only untested items: `printf 'yes\n' | LOUPE --pinned init --app <app>`.
- Neither: `LOUPE --pinned init --app <app> </dev/null`.

Give it a 10-minute timeout; `generate` reads every component. Then by exit code:

- **0**: it ends "Upgraded from Loupe <old> to <new>." Go to step 8. If that line is missing, relay what it
  printed and stop.
- **2, a manual step**: a file had a shape `init` won't guess at. It printed the file and the exact snippet, and
  ended with "needed. After making it, run loupe init --adopt." and "stays at Loupe <old> until the manual steps
  are recorded". Show them, ask whether to apply that snippet, and on yes make exactly that edit (these files are
  outside `packages/loupe`). Run `LOUPE --pinned init --adopt --app <app> </dev/null`, which records the edit and
  ends "Rerun loupe init to finish upgrading to <new>." Then run `init` again as above. The edited file and the
  ledger now have uncommitted changes, so it needs `--allow-dirty` after the same ask as in step 2.
- **1**: something was refused or needs attention. Relay the ✗ lines and what it says to do, word for word. Then:
  - **Drift**: a line saying "changed since loupe init recorded it; left as is" or "edited by hand since loupe
    init wrote it; left as is", or one from `generate`, "edited by hand since loupe generate wrote it". Loupe wrote
    the file, and it was changed by hand since. The run ends "attention; loupe init never overwrites them." and the
    ledger "stays at Loupe <old> until they are resolved". Say plainly that the upgrade can't finish while the file
    differs from what Loupe recorded: `init` never overwrites it, and `--adopt` only records manual steps that are
    pending. For a file in `packages/loupe`, "Restore <file> with git, or move it away, then rerun loupe init."
    says the same.
    - Offer to help restore it. `git log --oneline -- <file>` finds the hand edit, and `git show <commit> --
      <file>` shows it. Restore the file as it was before that commit (`git restore --source=<commit>^ --
      <file>`) only on a clear yes that names the file and the commit, since that discards the hand edit. Then run
      this skill again: it resumes at step 2.
    - If the designer would rather keep the edit, say that the install now sits between versions: the bump is
      committed, the ledger stays at `<old>`, and Loupe never moves back. The way out is to undo the upgrade:
      revert the bump commit, discard what `init` wrote since (list those files from `git status --short` first),
      and run `pnpm install`. Do that only on a clear yes.
  - **Uncommitted files**: "These files have uncommitted changes, and loupe init may write them:" means it wrote
    nothing. Relay it, but its last line offers "Commit or stash them, or rerun with --allow-dirty.": ask the
    designer to commit or stash, and don't take the second option unless step 2 allows it or they ask for it by
    name. When it says "commit the version bump, then rerun loupe init.", the bump isn't committed yet: go back to
    step 6.
  - **Anything else**: relay it and stop. A line ending "To upgrade, set it to <new>, run pnpm install, commit,
    then rerun loupe init." means the app's `package.json` doesn't ask for `<new>`: run this skill again, and
    `UPGRADE status` says what is left.

## 8. Install again, `loupe doctor`, and wrap up

1. `init` rewrote `packages/loupe/package.json`, whose `peerDependencies` pins `@danarocha/loupe` to `<new>`. Until
   pnpm installs that, the Product layer keeps resolving `<old>` and `pnpm install --frozen-lockfile` fails. Run
   `pnpm install` (a plain install, 10-minute timeout). If it fails, relay the error and stop.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lockfile.mjs" report --base HEAD`. `loupe-only` or `loupe-and-peers`
   (the Product layer's entries moved) and `unchanged` need nothing. For `other-changes` or `peers-only`, list the
   lines and say what they are; don't undo them.
3. Run `LOUPE doctor` (5-minute timeout). Exit 0 is healthy (warnings allowed): say so in a line, with the version
   it now records. Exit 1: relay the failing lines and stop.
4. Show `git status --short`. Say that Loupe is upgraded to `<new>`, that the bump is already committed, and that
   what `init` wrote (in `packages/loupe`, and any edit it reapplied) and the lockfile change are theirs to review
   and commit.
5. Tell the designer to restart `next dev`, since a running dev server still has the old Loupe loaded.
6. Offer the browser check: "Want me to check in the browser that an Instance can still be selected?" On yes,
   follow step 7 of the install skill, `${CLAUDE_PLUGIN_ROOT}/skills/install/SKILL.md`, after the restart. On no,
   you're done.
