# @danarocha/loupe

A dev-only toolbar for inspecting and overriding the props of real components in
a running Next.js app. Pre-release: this version ships the CLI skeleton and the dev loader.

Install it exact-pinned, as a dev dependency of the app, and run the CLI from
that copy so the generator and runtime versions stay paired:

```bash
pnpm add -D -E @danarocha/loupe
pnpm exec loupe --version
```

## The dev loader

Wrap the app's `next.config.ts`. The loader is added for `next dev` only; every
other phase, `next build` included, gets the config back untouched.

```ts
import { withLoupe } from "@danarocha/loupe/next";

export default withLoupe(nextConfig, { adaptList: "../../packages/playground/adapt-list.json" });
```

Under `next dev` it tags each JSX call site of a design-system or app component
with `data-ds-anchor` (`path › EnclosingComponent › Component[n]`, stable across
edits) and `data-ds-source` (`path:line:col n/total`, a hint only), and swaps an
import to its Adapter where `adapt-list.json` lists one, in client code only.
`LOUPE=0 next dev` runs without it.
