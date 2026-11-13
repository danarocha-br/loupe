---
status: accepted
---

# The ledger is the only record of an install, and an upgrade reruns init

Through 0.0.4, the compatibility check and `init` both wrote the ledger, and each with its own serialisation. Every command re-derived "is this still Loupe's work?" on its own. The Loupe version sat in three records that nothing moved together: `ledger.loupe.version`, the `package-json` touch point's hash and the Product layer's `peerDependencies`. So upgrading in place was impossible, and the only path was remove and reinstall.

We decided:

- **One module owns the ledger.** It is the only writer and the only judge of a recorded item: intact, drift, missing, pending, unclaimed, not Loupe's or unrecognised (see `GLOSSARY.md`).
- **An upgrade is a rerun of `loupe init`** with the newer version installed. The flow is bump, `pnpm install`, commit, `loupe init`.
- **The version has one source, `ledger.loupe.version`.** It is written last, and only when nothing was left blocked.
- **The version is not part of a touch point's hash**, so a version bump never reads as drift.

## Considered options

- **`generate` reconciles the version.** We rejected it because `generate` would start writing the ledger and the Product layer's `package.json`. Today it writes only its own generated files, and `generate --check` needs no ledger.
- **A new `loupe upgrade` command.** We rejected it because `init` already reapplies what is missing and rewrites its own out-of-date files, so a second command would duplicate that logic.
- **Bump the ledger's `formatVersion` to drop the old hashes.** We rejected it because the installer plugin reads the ledger's JSON directly, so the shape stays a contract. Instead, a hash written before this change is recognised by rebuilding it with the recorded version, and it is re-recorded the new way.

## Consequences

- **Downgrades.** An installed version older than the ledger's is refused.
- **The dirty-tree guard.** It is unchanged, so the version bump has to be committed before `init` runs. `init` says so when that is why it refused.
- **The dev server.** It keeps reading the generated-file header directly, because the ledger module loads TypeScript through the touch points.
