# @danarocha/loupe

A dev-only toolbar for inspecting and overriding the props of real components in
a running Next.js app, then exporting a Proposal for engineering. This package
holds the Toolbar, the dev loader, the Adapter runtime and the `loupe` CLI,
which makes every write to the product.

**Designers: install it with the Installer plugin, not by hand.** The
[guide](https://github.com/danarocha-br/loupe#readme) covers installing, using,
removing and upgrading Loupe, and troubleshooting. This README is the CLI
reference.

## Compatibility

> Loupe 0.x supports: Next.js 16.3 with the App Router and Turbopack in
> development, on Node 22 or Bun; a pnpm workspace; TypeScript; one design
> system kept as a workspace package with its source (shadcn on Base UI).

`loupe check` grades each part of a repo as supported, not tested yet (needs a
yes) or not supported (nothing is installed). The
[guide](https://github.com/danarocha-br/loupe#is-your-setup-supported) has the
full table.

## Running the CLI

The product pins Loupe exactly, as a dev dependency of the app, so the CLI that
writes the Product layer always matches the runtime that reads it. `loupe init`
adds that dependency itself, so before the install, run the exact release with
`pnpm dlx`:

```bash
pnpm dlx @danarocha/loupe@<version> check --app apps/app
pnpm dlx @danarocha/loupe@<version> init --app apps/app
pnpm install                          # init never writes the lockfile
```

Once installed, the CLI lives in the app, not at the repo root. Run it from the
app's folder, or from the root with `pnpm -C`:

```bash
pnpm -C apps/app exec loupe --version
```

The examples below are run from the app's folder (`cd apps/app`). Every command
finds the repo root on its own.

## The compatibility check

Check the repo against the compatibility statement before anything else.
It writes nothing, except a yes to untested items, which it keeps in
`packages/loupe/loupe.ledger.json` so a rerun doesn't ask again:

Before the install the app has no copy yet, so run it from the repo root with
`pnpm dlx`. `--app` is relative to the repo root:

```bash
pnpm dlx @danarocha/loupe@<version> check            # asks which app when there are several
pnpm dlx @danarocha/loupe@<version> check --app apps/app
```

Once installed, `pnpm exec loupe check` in the app's folder reruns it.

## Installing

`init` runs the check, creates the Product layer (`packages/loupe`), makes the
four edits (the app's `package.json`, `next.config.ts`, the root layout and the
Biome config), then runs `generate`. Each edit is recorded in
`packages/loupe/loupe.ledger.json`. A rerun writes only what is missing; with a
newer Loupe installed, it upgrades the install (see [Upgrading](#upgrading)).

The first run goes through `pnpm dlx`, as above. Once the app has its copy:

```bash
pnpm exec loupe init                  # a rerun: reapplies what is missing, lists what was edited by hand
pnpm exec loupe init --adopt          # after a "manual step": record the edit you made by hand
pnpm exec loupe init --allow-dirty    # proceed although a file it would change has uncommitted changes
```

`--adopt` and `--allow-dirty` work on the first run too.

Exit codes: 0 done · 1 refused or something needs attention · 2 a manual step is
needed. On 2 it prints the file and the exact snippet; make that edit, then run
`init --adopt`.

## Checking an install

`doctor` checks an install against its ledger and writes nothing. It reruns the
compatibility check, compares the Loupe version in the app's `package.json`, the
ledger, `node_modules` and the CLI, checks each touch point and Product layer
file against its recorded hash, lists generated files that are older than their
sources, and checks that the Product layer resolves what it imports. A touch
point or generated file changed by hand is listed as drift and left as it is.

```bash
pnpm exec loupe doctor           # exits 1 when something needs attention
pnpm exec loupe doctor --build   # also runs next build under Node and scans .next
```

`--build` runs the app's own `next build` under Node (not the app's build
script, which may run Bun) and fails if `.next` holds `data-ds-anchor`,
`__loupe`, Loupe's `loader.cjs`, `@repo/loupe`, `@danarocha/loupe`, the
Toolbar's `data-loupe-toolbar` or its flag preview's `loupe-flag-preview`, or if
`required-server-files.json` names the loader. It skips `.next/cache`,
`.next/dev` and source maps (they hold the app's own source, the layout's
import of the mount included), and writes the app's `.next` as any build does (Next may also
rewrite `next-env.d.ts`).

## Generating Adapters

`generate` reads every component of the design system's `components/` and of the
app with the TypeScript checker, and writes the Product layer's generated files:

- `adapters/ds/…` and `adapters/app/…`: a thin `'use client'` Adapter for each
  module with at least one component that can take an Override, mirroring the
  source path;
- `meta/ds/…` and `meta/app/…`: prop metadata for every component module,
  Adapter or not;
- `adapt-list.json`: what the dev loader reads.

```bash
pnpm exec loupe generate          # reads the roots back from adapt-list.json
pnpm exec loupe generate --check  # for CI: writes nothing, exits 1 when out of date
pnpm exec loupe generate --verbose  # lists every component and what it became
```

`init` runs the first `generate`. Its other options (`--out`, `--design-system`,
`--app`, `--specifier`, `--root`) are for running it outside an install, as this
repo's CI does on the fixture; `loupe generate --help` lists them. Relative
paths are read from the folder you run it in.

It writes only files whose bytes differ, deletes generated files that left the
set, and prints a Coverage summary (Adapters, Inspect only, skipped by shape).
Every generated file carries a header with a hash of its content. If one was
edited by hand, `generate` and `--check` write nothing, name the file and exit 1.
There is no `--force`: delete the file (or `git restore` it) and rerun.

## Removing Loupe

`remove` undoes `init` in a fixed order: the `<LoupeMount />` block and the
`withLoupe` wrapper, then the Product layer, the Biome exclusion and the
dependencies, followed by `pnpm install` (which updates the lockfile; Loupe
itself never writes it). It reads `packages/loupe/loupe.ledger.json` and deletes
it last, once nothing is left.

```bash
pnpm exec loupe remove
pnpm exec loupe remove --allow-dirty  # proceed although a file it would change has uncommitted changes
```

It never overwrites a hand edit. A touch point or a Product layer file changed
since Loupe wrote it is left alone and listed, and `remove` exits 1. Files git
ignores in the Product layer are kept too, except its `node_modules`. If the
mount or `withLoupe` stays (edited, or a manual step never adopted), it stops
before the Product layer, so the app still builds. Undo what it lists and run it
again: the second run works from the files as they are now, so it picks up where
the first stopped. When it removes the mount or the wrapper, it asks you to
restart a running `next dev`; `.next` is left alone.

It refuses when a file it would change has uncommitted changes (the lockfile
counts when the dependencies go), and outside a git repository. If `pnpm install`
fails, it puts the dependencies back so the next run retries.

## Upgrading

An upgrade is a rerun of `init` with the newer version installed:

1. In the app's `package.json`, set `@danarocha/loupe` to the new version,
   exact as `init` wrote it, and run `pnpm install`.
2. Commit both. `init` refuses while the app's `package.json` or the lockfile
   has uncommitted changes; during an upgrade it says "commit the version bump,
   then rerun".
3. Run `pnpm exec loupe init` in the app's folder.

`init` then reconciles item by item, as on any rerun, recording each item in the
ledger before writing it. It rewrites its own unedited files in
`packages/loupe` (that `package.json` pins the version in `peerDependencies`),
reapplies a touch point that went missing, and runs `generate`, which rewrites
the Adapters and `meta/`. The ledger's `loupe.version` moves last, and only when
nothing was left blocked: then `init` prints "Upgraded from Loupe <old> to <new>".
`init` refuses to start while the app's `package.json` still pins the old
version, as when a newer release runs through `pnpm dlx`.

If a hand-edited file or a manual step stops it, the ledger keeps the old
version, and `doctor` reports "Loupe versions differ" with "Run loupe init to
finish upgrading". Restore the file (or make the manual step and run
`init --adopt`), commit, and rerun `init`; it picks up where it stopped.

The `package.json` touch point's hash leaves out Loupe's version, so a bump never
reads as drift. A ledger written by 0.0.4 or earlier still has the version in
that hash: `init`, `doctor` and `remove` recognise it by rebuilding it with the
ledger's version, and `init` records it again the new way.

Loupe never downgrades: when the installed version is older than the ledger's,
`init` refuses and writes nothing.

## The dev loader

`init` wraps the app's `next.config.ts` with the Product layer's `withLoupe`
(`@repo/loupe/next`), which passes its own `adapt-list.json` to this package's.
The loader is added for `next dev` only; every other phase, `next build`
included, gets the config back untouched. By hand, it looks like this:

```ts
import { withLoupe } from "@danarocha/loupe/next";

export default withLoupe(nextConfig, { adaptList: "../../packages/loupe/adapt-list.json" });
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
adapts with `createAdapter` (`generate` emits them):

```tsx
"use client";
import { createAdapter } from "@danarocha/loupe/runtime";
import { Button as Original, buttonVariants } from "@repo/design-system/components/ui/button";

export const Button = createAdapter("Button", Original);
export { buttonVariants };
```

`generate` also passes the component's prop metadata, `{ props: {…} }`, so the
Toolbar knows which props are Editable and why the others are inspect-only.

An Adapter registers each Instance it renders, under its call-site anchor plus
the app's own keys (`… › Button[1]#m2`), and renders the component with the app's
props plus any Override. Refs, `children`, context and memoization pass through.

## The Toolbar

`<LoupeMount />` (`@danarocha/loupe/mount`, written into the root layout by
`init`) loads the Toolbar in `next dev` only. The mount is a `'use client'`
module, so a production build keeps it as a client reference, but only as a
null stub: the Toolbar's dynamic import sits inside the `NODE_ENV` condition, so
the bundler drops it, and `doctor --build` fails if it ever leaks.

The Toolbar is one right-hand panel in its own shadow root. With nothing
selected it lists every Instance on the page by component, and updates as menus
and dialogs mount. That includes server-rendered Instances and anchored client
ones with no Adapter, both inspect-only. A component on the page that the next
`generate` would add (exported by a file it reads, missing from `meta/`) is
tagged **Not generated yet**, with the command; it clears once the command has
run. Nothing regenerates on its own. **Pick** selects by clicking
the page (Esc cancels); only while Pick is on does the Toolbar stop the page's
pointer events. The inspector shows the Instance, its call site, Coverage as
"N editable props · M inspect only", each prop's Current value with a reason per
inspect-only prop, and what a library injected in one collapsed line. For an
Instance with no Adapter, or a server-rendered one, the inspector reads its
component's `meta/` file from the dev server the first time it shows it, so its
rows carry their real reasons and defaults. They stay inspect-only: a prop that
would be Editable reads `NO ADAPTER` or `ON THE SERVER`.

The same is on the console:

```js
__loupe.list()                         // adapted Instances; client ones with no Adapter and server-rendered ones (inspect-only)
__loupe.props(id)                      // Current value, injected props, Overrides, rendered props, sources, State props
__loupe.set(id, "variant", "outline")  // an Instance Override
__loupe.reset(id)                      // back to the Current value
__loupe.pick($0)                       // the Instance that rendered a DOM node
__loupe.inspect(id)                    // the inspector's rows: Editable or inspect-only with a reason, Coverage
__loupe.status                         // { overrides: false, reason } when React's internals don't check out
```

**The Current value is the app's own props**: the ones the call site writes, as
the loader records them (`data-ds-writes`). What a library adds on top, such as Base
UI's handlers, ARIA, `id` and `data-slot` on a `render={<Button/>}` trigger, is
listed apart in `injected` and gets no source, so it never reaches Coverage or a
Proposal. `authorship` is `spreads` when the call site spreads props and
`unrecorded` when it has no record; then the two can't be separated and every
live prop is in the Current value.

**State props** (`X` with `onXChange`, such as `open`/`onOpenChange`) come from
the component's types: `generate` flags them `state` in the prop metadata (a
hand-written Adapter can pass `{ state: ["open"] }`). They are Instance
scope only: `set(id, "open", true, "group")` and `"page"` throw. An Override
holds the value, and the app's `onXChange` keeps running. When the app tries to
change a held value, through the handler or its own state,
`props(id).states` reports `{ held: { value, appTried } }` and the console says
so once per attempt. Reset hands control back.

Instances rendered by a Server Component are listed from React's dev-only
`_debugInfo` and stay inspect-only. If React's dev internals don't identify the
rendering component, Overrides turn off for the page and everything is inspect-only.

### Feature flags

Feature flags are the only rule the Toolbar previews. With nothing selected, the
**Feature flags** card lists the app's flags from the Flags SDK's discovery
endpoint, `/.well-known/vercel/flags`, which the Flags Explorer reads too. Flipping
one writes the encrypted `vercel-flag-overrides` cookie that `flags/next` reads,
and the page re-renders with it. **Clear** gives one flag back to the app and
keeps the cookie's other overrides, the Vercel Toolbar's included; **Clear flag
previews** empties the cookie. A flag with no declared options is offered as on
and off.

Both steps run as Server Actions on the dev server, because both need the app's
`FLAGS_SECRET`: the endpoint checks an access proof made with it, and the cookie
is encrypted with it. Without the secret or the endpoint, the card says which is
missing. The discovery request goes to the dev server's loopback address, never
to the host a request names. The preview lives in the cookie, so it survives a
reload, and the Proposal builder reads it back with `previewedFlags()`.

From 0.0.4 on, a preview lasts 8 hours from the last flag you change, and then
the cookie expires. A cookie written by 0.0.3 or earlier has no expiry date and
stays until it is cleared or the browser session ends. Cookies ignore the port,
so while a preview lasts the cookie reaches every app on `localhost`, and `flags/next` answers 500 (`flags: Missing FLAGS_SECRET`) in one
that has no `FLAGS_SECRET`. Press **Clear flag previews** before you switch
projects. If another app already fails that way, delete the
`vercel-flag-overrides` cookie for `localhost` in the browser (in Chrome,
DevTools → Application → Cookies) and reload.

