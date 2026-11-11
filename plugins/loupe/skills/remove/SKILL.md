---
name: remove
description: Remove Loupe from this repo - run loupe remove, which undoes loupe init in order and never overwrites a hand edit, relay what it kept, and put back the lockfile peers that installing Loupe re-resolved.
---

# Loupe: remove

The `loupe` CLI does the removal; this skill explains, asks, runs it and relays what it prints. **You never edit
`packages/loupe` yourself, by any tool** (a hook refuses Edit and Write there), and you never commit.

Run every command from the repo root (the folder with `pnpm-workspace.yaml`). `LOUPE` below means
`node "${CLAUDE_PLUGIN_ROOT}/scripts/loupe.mjs"`, which runs the app's own Loupe copy, the one that wrote
the Product layer.

## 1. Before anything

1. If `packages/loupe/loupe.ledger.json` doesn't exist, Loupe isn't installed here (or was already removed):
   say so and stop.
2. Run `git status --short`. `loupe remove` refuses when a file it would change has uncommitted changes. If the
   install itself was never committed, those files are exactly the install's: say so, and ask whether to remove
   it anyway, which passes `--allow-dirty`. Otherwise list the files and ask the designer to commit or stash
   first.

## 2. Explain, and ask for the yes

Tell the designer that `loupe remove`:

- takes out the `<LoupeMount />` block and the `withLoupe` wrapper first, and stops there if either was edited
  by hand, so the app still builds;
- then deletes the Product layer files it wrote and can still recognise by hash, removes the Biome exclusion
  and both devDependencies, and runs `pnpm install`;
- leaves anything changed by hand where it is and lists it, with what to undo by hand;
- deletes its ledger last, only when nothing is left.

Ask: "Shall I remove Loupe?" Continue only on a clear yes.

## 3. Run `loupe remove`

Run `LOUPE remove` (add `--allow-dirty` only if the designer agreed in step 1), with a 10-minute timeout.

- **0**: everything Loupe wrote is gone.
- **1**: it refused, or kept something. Relay what it lists and what to undo by hand, word for word. Offer to
  make those undo edits; make them only on a yes (touch-point files are outside `packages/loupe`; for a kept
  file inside it, delete it only if the designer says so). Then run `LOUPE remove` again.

## 4. The lockfile

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lockfile.mjs" report --base auto`. `auto` compares with the commit
before Loupe's ledger was added (with `HEAD` if the install was never committed). By its `Result:` line:

- `unchanged`: the lockfile is as it was before the install.
- `peers-only`: pnpm kept the TypeScript 6 peer it picked while Loupe was installed, because that peer still
  resolves. Offer to put the lockfile back: `node "${CLAUDE_PLUGIN_ROOT}/scripts/lockfile.mjs" restore --base auto`.
  It writes only `pnpm-lock.yaml`, from that commit, and keeps it only if `pnpm install --frozen-lockfile`
  accepts it; otherwise it puts the current one back. Run it only on a yes.
- `other-changes`, `loupe-only` or `loupe-and-peers`: the lockfile changed for other reasons since the install, or Loupe's entries
  are still there. Relay the lines; don't restore.

## 5. Wrap up

Show `git status --short`. Tell the designer to restart `next dev`, since a running dev server still has Loupe
loaded. If `<app>/AGENTS.md` or `<app>/CLAUDE.md` appear as untracked, Next wrote them on its first `next dev`;
they aren't Loupe's, so leave them and mention it. The changes are theirs to review and commit.
