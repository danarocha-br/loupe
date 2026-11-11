# Installer plugin

The Claude Code plugin that installs, removes and checks Loupe in a product. It
explains each change, asks the designer, runs the pinned `loupe` CLI and relays
what it prints. The CLI makes every write; the plugin never edits the Product
layer and never commits.

| Path | What it is |
| -- | -- |
| `skills/install` | Compatibility check (asking its Untested question once), the yes to the edits, `loupe init`, `pnpm install`, `loupe doctor`, then a browser check that an Instance can be selected. |
| `skills/remove` | `loupe remove`, what it kept, and putting back the lockfile peers that installing Loupe re-resolved. |
| `skills/doctor` | `loupe doctor` and, on request, `doctor --build`. |
| `hooks/hooks.json` | One `PreToolUse` guard (`scripts/guard.mjs`): Claude's Edit and Write are refused inside a Product layer, pointing at `generate`. |
| `scripts/pin.mjs` | The exact Loupe release this plugin installs. A test keeps it equal to `packages/loupe`'s version. |
| `scripts/loupe.mjs` | Runs the right CLI: the app's own copy once installed, `pnpm dlx` of the exact release before that. |
| `scripts/lockfile.mjs` | Reports what an install or removal did to `pnpm-lock.yaml` beyond Loupe's own entries, and restores a peer-only residue. |

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
  themselves, re-resolved from 5.9.3 to the 6.0.3 that ts-morph brings.

`radix-ui: "latest"` stays at its locked version: an install only re-resolves
importers whose `package.json` changed, and the design system's didn't. Earlier
runs saw it move because they added a root `pnpm.overrides` entry, which
re-resolves every importer.

`loupe remove`'s own `pnpm install` takes Loupe's entries out but keeps the
TypeScript 6 peers, since they still resolve. `scripts/lockfile.mjs restore`
puts back the lockfile from the commit before the install, only when those peers
are the sole difference and `pnpm install --frozen-lockfile` accepts it.

## Releasing

Each plugin release installs exactly one Loupe release. Bump `LOUPE_VERSION` in
`scripts/pin.mjs` with `packages/loupe/package.json`, publish that Loupe to npm,
then bump `.claude-plugin/plugin.json`.
