# Installer plugin

The Claude Code plugin that installs, upgrades, removes and checks Loupe in a
product. It explains each change, asks the designer, runs the pinned `loupe` CLI
and relays what it prints. The CLI makes every edit to the product, except one:
the upgrade skill's script sets the app's `@danarocha/loupe` to the pinned
version, and the skill commits that bump on the designer's yes. The plugin never
edits the Product layer and makes no other commit.

For how a designer installs, uses and removes Loupe, see the
[guide](../../README.md). This README is about how the plugin is built.

| Path | What it is |
| -- | -- |
| `skills/install` | Compatibility check (asking its Untested question once), the yes to the edits, `loupe init`, `pnpm install`, `loupe doctor`, then a browser check that an Instance can be selected. |
| `skills/upgrade` | Where the upgrade stands, the bump of `@danarocha/loupe` to this plugin's pin, `pnpm install`, the compatibility check, the commit of that bump on a yes, `loupe init`, a second `pnpm install` for the Product layer's own `package.json`, and `loupe doctor`. It picks up where an earlier run stopped. |
| `skills/remove` | `loupe remove`, what it kept, and putting back the lockfile peers that installing Loupe re-resolved. |
| `skills/doctor` | `loupe doctor` and, on request, `doctor --build`. |
| `hooks/hooks.json` | One `PreToolUse` guard (`scripts/guard.mjs`): Claude's Edit and Write are refused inside a Product layer, pointing at `generate`. |
| `scripts/pin.mjs` | The exact Loupe release this plugin installs, and the names it installs under. A test keeps them equal to `packages/loupe`'s version and `src/names.ts`. |
| `scripts/loupe.mjs` | Runs the right CLI: the app's own copy once installed, `pnpm dlx` of the exact release before that. |
| `scripts/lockfile.mjs` | Reports what an install or removal did to `pnpm-lock.yaml` beyond Loupe's own entries, and restores a peer-only residue. |
| `scripts/upgrade.mjs` | `status` says where an upgrade stands (`not-installed`, `up-to-date`, `plugin-behind`, `app-pin-not-plain`, `upgrade` or `resume`) and writes nothing. `bump` sets the app's `@danarocha/loupe` to the pin, exact, and writes only that line. |

No `bin/` and no npm dependencies: the scripts need only Node, and
`package.json` exists to run the tests (`pnpm --filter @danarocha/loupe-installer test`).

## Installing the plugin

```bash
claude plugin marketplace add danarocha-br/loupe
claude plugin install loupe@loupe
```

For a local checkout, `claude --plugin-dir plugins/loupe` loads it for one session.

## Why `init` runs before the dependency is added

The install skill runs `loupe init` through `pnpm dlx` of the exact pinned
release, and `init`'s `package.json` edit adds that same exact version. Adding
the dependency first would write `package.json` and the lockfile before the
designer's yes, and `init` refuses to run while those files have uncommitted
changes.

## The lockfile

`loupe init` never writes the lockfile, so the install skill runs a plain
`pnpm install` (never `pnpm add`, `pnpm update` or an override, which re-resolve
more than Loupe). Measured on orbix-ai, that install changes only:

- Loupe's own importer entries and packages;
- an optional `typescript` peer in the packages that don't depend on TypeScript
  themselves, re-resolved from 5.9.3 to the 6.0.3 that ts-morph brings;
- other peers, sometimes. On the PER-94 round trip it also re-resolved
  `@hookform/resolvers`' peer `ajv` in apps/storybook from 6.15.0 to 8.20.0.
  `lockfile.mjs` counts it as a peer re-resolution, like the TypeScript ones.

`radix-ui: "latest"` stays at its locked version: an install only re-resolves
importers whose `package.json` changed, and the design system's didn't. Earlier
runs saw it move because they added a root `pnpm.overrides` entry, which
re-resolves every importer.

`loupe remove`'s own `pnpm install` takes Loupe's entries out but keeps the
TypeScript 6 peers, since they still resolve. On PER-94 it put the `ajv` peer
back on its own. `scripts/lockfile.mjs restore` puts back the lockfile from the
commit before the install, only when peer re-resolutions are the sole difference
and `pnpm install --frozen-lockfile` accepts it.

## Why an upgrade goes to the pin

The upgrade skill moves a repo to `LOUPE_VERSION` and nowhere else, never to
"latest". A plugin release installs exactly one Loupe release, so a designer
gets a newer Loupe by updating the plugin and then running `/loupe:upgrade`. The
skill runs `init` with `--pinned`, which refuses when the app's installed copy
isn't that release, and it never goes back: an install ahead of the plugin gets
`plugin-behind` and a pointer to the plugin update.

The bump is the one edit the skill makes outside the CLI, because
[ADR 0001](../../docs/adr/0001-ledger-and-upgrade.md) decided against a
`loupe upgrade` command. It is also the one commit: `init` refuses to run while
the app's `package.json` or the lockfile has uncommitted changes, so the bump has
to be committed first. `bump` itself refuses while those two files have changes,
so the commit holds the bump and nothing else.

The skill quotes the CLI's messages (the dirty-tree refusal, "Upgraded from
Loupe", "Rerun loupe init to finish upgrading to"). `test/upgrade-skill.test.mjs`
checks each against the CLI's source, so rewording one there fails the plugin's
tests until the skill follows.

## Releasing

Each plugin release installs exactly one Loupe release. Bump `LOUPE_VERSION` in
`scripts/pin.mjs` with `packages/loupe/package.json`, publish that Loupe to npm,
then bump `.claude-plugin/plugin.json`. A plugin release with no new Loupe leaves
`LOUPE_VERSION` alone, and designers on that Loupe get `up-to-date` from the
upgrade skill.
