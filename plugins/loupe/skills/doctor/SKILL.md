---
name: doctor
description: Check a Loupe install without changing anything - run loupe doctor (or doctor --build for a production build) and relay what is healthy, stale or drifted, with the fix for each.
---

# Loupe: doctor

`loupe doctor` writes nothing. This skill runs it and relays the result. **You never edit `packages/loupe`
yourself, by any tool** (a hook refuses Edit and Write there).

Run every command from the repo root (the folder with `pnpm-workspace.yaml`). `LOUPE` below means
`node "${CLAUDE_PLUGIN_ROOT}/scripts/loupe.mjs"`, which runs the app's own Loupe copy.

1. If `packages/loupe/loupe.ledger.json` doesn't exist, Loupe isn't installed here: say so and offer the
   **install** skill. Stop.
2. Run `LOUPE doctor` (5-minute timeout). It checks the compatibility statement, the Loupe versions, the four
   touch points, the Product layer's files, and what the Product layer must resolve.
3. Relay the result in a few lines: exit 0 is healthy (warnings allowed), exit 1 needs attention. For each
   problem, say what it means and the fix it names, for example:
   - a touch point or generated file **changed by hand** (drift): restore it with git, or keep it and know that
     `loupe remove` will leave it behind;
   - **stale** generated files: run `LOUPE generate`, which rewrites only what changed;
   - a version that doesn't match: install the version the ledger names. An upgrade by version bump plus
     `generate` isn't finished in 0.0.x and ends here; the README's Upgrade section says how to undo it and
     upgrade by removing and reinstalling instead;
   - an **untested** item not accepted yet: the install skill asks about it.
   Run a fix only when the designer says yes to it.
4. Run `LOUPE doctor --build` only when the designer asks for a production check. Say first that it runs
   `next build` for the app under Node, which takes minutes, needs the app's environment variables, writes
   `.next`, and may rewrite `next-env.d.ts`. It then scans the build for any trace of Loupe and must find none.
   Relay the result the same way.
