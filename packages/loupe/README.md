# @danarocha/loupe

A dev-only toolbar for inspecting and overriding the props of real components in
a running Next.js app. Pre-release: this version ships the CLI, its compatibility
check, the dev loader and the Adapter runtime.

Install it exact-pinned, as a dev dependency of the app, and run the CLI from
that copy so the generator and runtime versions stay paired:

```bash
pnpm add -D -E @danarocha/loupe
pnpm exec loupe --version
```

## The compatibility check

Check the repo against the compatibility statement before anything else.
It writes nothing, except a yes to untested items, which it keeps in
`packages/loupe/loupe.ledger.json` so a rerun doesn't ask again:

```bash
pnpm exec loupe check            # asks which app when there are several
pnpm exec loupe check --app apps/app
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
edits), `data-ds-source` (`path:line:col n/total`, a hint only) and
`data-ds-writes` (what the call site writes: its prop names, each as a literal
or an expression, whether it spreads props, and its children kind `text`,
`from-code`, `mixed`, `elements` or `none`), and swaps an import to its Adapter
where `adapt-list.json` lists one, in client code only.
`LOUPE=0 next dev` runs without it.

## Adapters and `window.__loupe`

An Adapter module re-exports a component module and replaces the components it
adapts with `createAdapter` (Stage 1 writes them by hand; `generate` will emit them):

```tsx
"use client";
import { createAdapter } from "@danarocha/loupe/runtime";
import { Button as Original, buttonVariants } from "@repo/design-system/components/ui/button";

export const Button = createAdapter("Button", Original);
export { buttonVariants };
```

An Adapter registers each Instance it renders, under its call-site anchor plus
the app's own keys (`… › Button[1]#m2`), and renders the component with the app's
props plus any Override. Refs, `children`, context and memoization pass through.
Until there is a Toolbar, drive it from the browser console:

```js
__loupe.list()                         // adapted Instances, and server-rendered ones (inspect-only)
__loupe.props(id)                      // Current value, Overrides, rendered props, the source of each
__loupe.set(id, "variant", "outline")  // an Instance Override
__loupe.reset(id)                      // back to the Current value
__loupe.pick($0)                       // the Instance that rendered a DOM node
__loupe.status                         // { overrides: false, reason } when React's internals don't check out
```

Instances rendered by a Server Component are listed from React's dev-only
`_debugInfo` and stay inspect-only. If React's dev internals don't identify the
rendering component, Overrides turn off for the page and everything is inspect-only.

