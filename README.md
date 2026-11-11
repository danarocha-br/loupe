# Component Playground

A dev-only toolbar that lets a designer inspect and override the props of real
components in a running Next.js app, then export a Proposal.

| Path | What it is |
| -- | -- |
| `packages/playground` | The Playground: runtime, dev loader and the `playground` CLI. Published to npm as `@danarocha/playground`. |
| `plugins/playground` | The Installer: a thin Claude Code plugin that runs the CLI. Empty for now. |
| `fixture/app` | A Next 16.3 app that CI runs every Playground check against. |
| `fixture/design-system` | The fixture's tiny shadcn-on-Base-UI design system. |

The fixture app imports the design system through tsconfig `paths`, the same
way orbix-ai's `apps/app` imports `@repo/design-system`. The dev loader has to
treat those files as app source, not as `node_modules`.

## Working here

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @fixture/app build
```

## Releasing

The product pins the Playground exactly, so every release is a new version:

```bash
pnpm --filter @danarocha/playground build
cd packages/playground && npm publish --access public
```
