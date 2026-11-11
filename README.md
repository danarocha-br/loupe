# Loupe

A dev-only toolbar that lets a designer inspect and override the props of real
components in a running Next.js app, then export a Proposal. In the planning
documents this is the Component Playground.

| Path | What it is |
| -- | -- |
| `packages/loupe` | Runtime, dev loader and the `loupe` CLI. Published to npm as `@danarocha/loupe`. |
| `plugins/loupe` | The Installer: a thin Claude Code plugin (skills `install`, `remove`, `doctor` and a guard hook) that runs the CLI. |
| `fixture/app` | A Next 16.3 app that CI runs every check against. |
| `fixture/design-system` | The fixture's tiny shadcn-on-Base-UI design system. |
| `fixture/app/loupe` | The fixture's Product layer, written by `loupe generate` and checked by `generate --check` in CI. |

The fixture app imports the design system through tsconfig `paths`, the same
way orbix-ai's `apps/app` imports `@repo/design-system`. The dev loader has to
treat those files as app source, not as `node_modules`.

## Working here

```bash
pnpm install
pnpm --filter @danarocha/loupe build   # the fixture's next.config.ts imports dist
pnpm test
pnpm typecheck
pnpm --filter @fixture/app build
scripts/check-fixture-build-clean.sh
scripts/check-packed-bin.sh
```

## Releasing

The product pins Loupe exactly, so every release is a new version:

```bash
cd packages/loupe && npm publish --access public
```

`prepack` builds `dist` first.
