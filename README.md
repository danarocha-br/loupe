# Loupe

Loupe is a toolbar for product designers. It runs inside a product's own
Next.js app on your machine, lists the real components on the page, shows the
props each one was given, and lets you try other values on the live page. When
something works, you copy a Proposal: an exact list of the changes, each tied to
a call site, for your coding agent to apply, or an engineer.

Loupe only runs in development. It never edits the product's components, and
nothing from it reaches a production build. In the planning documents it is
called the Component Playground.

You install it with a Claude Code plugin, the Installer. The plugin explains
each change, asks before making it, and runs Loupe's own `loupe` command, which
makes the edits. The one exception is an upgrade's version bump, which the plugin
makes and commits after a second yes.

- [Is your setup supported?](#is-your-setup-supported)
- [Install](#install)
- [Using Loupe](#using-loupe)
- [What the install changes](#what-the-install-changes)
- [Check an install](#check-an-install)
- [Remove Loupe](#remove-loupe)
- [Upgrade](#upgrade)
- [Troubleshooting](#troubleshooting)
- [Demo](#demo)
- [Working on Loupe](#working-on-loupe)

## Is your setup supported?

Loupe 0.x supports one setup, the one it was proven on:

> Loupe 0.x supports: Next.js 16.3 with the App Router and Turbopack in
> development, on Node 22 or Bun; a pnpm workspace; TypeScript; one design
> system kept as a workspace package with its source (shadcn on Base UI).

The install starts with a compatibility check that grades each part of your
repo as one of three results:

- **✓ supported**: proven to work.
- **! not tested yet**: likely to work, but never proven. Each one comes with a
  sentence about the risk, and you have to say yes once to continue. Loupe
  remembers that yes, so a rerun doesn't ask again while nothing changes.
- **✗ not supported**: known not to work. The install stops, writes nothing and
  says what it found, what Loupe needs and how to fix it, if a fix exists.

| Part of the setup | ✓ supported | ! not tested yet | ✗ not supported |
| -- | -- | -- | -- |
| Next.js, in the app | 16.3.x | other 16.x | below 16.0, and 17 or later |
| Router | App Router | App Router and Pages Router together (Pages routes aren't covered) | Pages Router only |
| Dev bundler | Turbopack, Next 16's default | a Babel config, or the React Compiler; a `dev` script without `next dev` | `next dev --webpack` |
| Dev server runtime | Node 22, or Bun (`bun --bun next dev`) | other Node versions | |

How the runtime is read: Bun counts when the app's `dev` script runs
`bun --bun next dev` (or `bunx --bun`). Otherwise the check grades the Node it
runs on, so run it in the same terminal setup you start the dev server from.
| Workspace | a pnpm workspace whose `pnpm-workspace.yaml` covers `packages/*` | | a pnpm workspace without `packages/*`; npm, yarn or bun workspaces; no workspace |
| Language | TypeScript (a `tsconfig.json` in the app) | | no `tsconfig.json` |
| Design system | one workspace package the app depends on, with `.tsx` source and a shadcn `components.json`, built on Base UI | shadcn on Radix (`asChild`); a `.tsx` workspace package using cva with no `components.json` | none in the workspace, or one installed from npm; one with no `.tsx` source |

A few more things to know:

- **React isn't graded.** The check prints the React that Next bundles, such as
  `React 19.3.0-canary-cbb046ab-20260731 (bundled by Next)`. In the browser,
  Loupe checks that React's development internals behave as expected. If they
  don't, every prop turns inspect-only and the Toolbar says "this React build
  isn't supported".
- **Production builds aren't part of the statement**, whether Node or Bun runs
  them. Loupe never runs in a build. `doctor --build` checks that, and it runs
  `next build` under Node.
- **One install covers one app and one design system.** When a repo has several
  App Router apps, the check lists them, marks the one that imports the design
  system most and asks you which. When the app depends on more than one design
  system, it asks which one too. It never guesses.
- **`next.config` must be TypeScript** (`next.config.ts` or `.mts`). With a
  `.js` or `.mjs` config, the install can't make that edit itself and shows you
  the snippet to add instead (see [Install](#install)).
- **The check covers your setup, not each component.** Which components and
  props can be changed is reported after the install, as Coverage in the
  Toolbar (for example "4 editable props · 3 inspect only", with a reason for
  each inspect-only prop). Components rendered on the server can be inspected
  but not changed.
- **A setup joins the statement only once it is proven.** The pilot is orbix-ai.

This is what the check printed on this repo's own test app:

```
Compatibility check — fixture/app

  ✓ Next.js 16.3.6, App Router, Turbopack dev                        supported
    React 19.3.0-canary-cbb046ab-20260731 (bundled by Next)
  ✓ pnpm workspace                                                   supported
  ! Design system @fixture/design-system (cva, no components.json)   not tested yet
    Without a shadcn components.json, Loupe can only guess where the components live.
  ✓ TypeScript                                                       supported
  ✓ Dev server runs on Node 22.22.2                                  supported

Result: works here, with 1 untested item.
Continue? (yes/no)
```

To see your own result without installing anything, start the install below and
answer no: the check comes first and writes nothing.

## Install

You need Claude Code, git, and the product repo on your machine with its
dependencies installed (`pnpm install`). The app must already run locally with
its dev server, including its environment variables and any sign-in, since the
install ends by opening it in the browser.

1. Add the plugin to Claude Code, once per machine:

   ```bash
   claude plugin marketplace add danarocha-br/loupe
   ```

   ```bash
   claude plugin install loupe@loupe
   ```

   Then restart Claude Code.

2. Commit or stash any changes to the files the install touches (see
   [What the install changes](#what-the-install-changes)) and to
   `pnpm-lock.yaml`. Loupe refuses to edit a file that has uncommitted changes,
   so your own work can't get mixed into its edits.

3. Open Claude Code in the product repo and run:

   ```
   /loupe:install
   ```

The install skill then:

1. runs the compatibility check, asks which app if there are several, and asks
   about any untested item once;
2. tells you exactly what it will change and asks "Shall I make these changes?";
3. on your yes, runs `loupe init`, which makes the edits and generates Loupe's
   files for your components;
4. runs `pnpm install`, then reports what that changed in `pnpm-lock.yaml`;
5. runs `loupe doctor` to check the install;
6. starts the dev server and checks in the browser that a component can be
   selected.

It never commits. Review the changes with `git status` and commit them when
you're happy, so teammates get Loupe when they pull.

If a file doesn't have the shape the install expects, it doesn't guess. It shows
you the exact snippet to add and where, applies it only after you say yes, and
then records it.

## Using Loupe

Start the app's dev server the way you usually do and open a page. The Loupe
panel takes a column on the right, and the page narrows to make room for it, as
it would beside DevTools, so the panel never covers what you're inspecting. In a
window too narrow for both, the panel sits over the page instead. Anything the
app fixes to the window, such as a dialog or a toast, can still run under the
panel. The panel says so when a dialog does, and holding Alt (Option on a Mac)
makes it see-through. Its
header holds the two select tools (**Select one** and **Select multiple**),
**Hide marks**, the light or dark switch and **Hide**. The panel follows your
system's light or dark setting; the half-filled circle switches it, and the
browser remembers your choice.

1. **Find a component.** With nothing selected, the panel lists every component
   on the page, grouped by name, and the list updates as menus and dialogs open.
   Each instance is named by what it shows on screen, such as "Actions for Ana
   Souza", with its file and line under the name. Click a row, or press a select
   tool in the header and click the component on the page (Esc cancels). The
   selected instance is outlined.
2. **Inspect it.** The inspector shows the instance, the file and component it
   is drawn in (its call site), and Coverage. Each prop shows the value the app
   gave it. A prop you can change has a control; any other prop says why not,
   such as `FROM CODE` for a label the code computes. Props a component library
   added on its own sit on one collapsed line and never reach a Proposal.
3. **Choose a scope with the select tool**, as you would in Figma. **Select one**
   (the arrow) changes the one instance you picked. **Select multiple** selects
   every instance drawn by the same call site (for example "All in
   MemberRowMenu · 4"), and a link under it widens that to **All on page**.
   Pressing a tool switches the current selection at once and lets you pick the
   next one on the page; the tool you chose stays on for the next selection. The
   panel outlines every instance the selection reaches. To leave an instance out
   of a group or page change, untick it in the selection's list: it keeps its
   own value.
4. **Change a value.** Each prop has its own card: choose an option in its table,
   flip its switch for true or false, or type in the **Text** field for a plain
   label. The page updates live, and the change gets a number, the way a drawing
   marks a revision: a numbered triangle on its card, a dashed outline around
   every instance it reaches on the page, for a moment as it lands and while you
   point at its row, its line in the **Changes** list, and its entry in the
   Proposal (`c1` is 1). A change keeps its number while you make others, and a
   change you reset leaves its number unused. The card keeps
   the app's own value, dotted in the table and on the line under the name. Your
   change holds while the app re-renders.
   - Label text can be changed on one instance or a call site, never page-wide.
   - A prop tagged `STATE`, such as a dialog's `open`, can be held on one
     instance only. If the app tries to change it, the row says so.
   - **Hold open** keeps a menu or dialog open while you inspect what's inside
     it. Clicking the panel closes the app's own menus, so select the menu (or
     its trigger's parent) and press **Hold open**. Release hands it back to the
     app, closed.
5. **Reset.** Reset undoes only the scope you're on. An instance falls back to
   its group's or page's value if there is one, otherwise to the app's own value.
   **Reset all** drops every change at once; the footer then offers **Undo** for
   a few seconds.
6. **Preview feature flags.** With nothing selected, the **Feature flags** card
   lists the app's flags and lets you flip them. It uses the app's own Flags SDK
   setup, so it needs the app's `FLAGS_SECRET`; the card says if it's missing.
   Always press **Clear flag previews** before you switch to another project:
   the preview is a cookie that other apps on `localhost` see too (see
   [Troubleshooting](#another-app-on-localhost-answers-500-with-flags-missing-flags_secret)).
7. **Copy the Proposal.** **Copy Proposal**, at the bottom of the panel, asks
   for a title and a note per change, then copies one text: the rules for
   applying it, one line per change, and the Proposal's JSON. Paste it into your
   coding agent (see [Apply a Proposal with your agent](#apply-a-proposal-with-your-agent)),
   or send it to an engineer.
   Copying writes nothing to the repo and clears nothing.

Your component changes live in the browser tab only. Reloading the page drops
them, and they are never written to the product's code.

**Hide** gives the page its full width back and leaves a small **Loupe** button;
click it to bring the panel back.

### Apply a Proposal with your agent

Paste the copied text into Claude Code, Cursor or any coding agent working in
the product repo. The text tells the agent what to do with each change:

- **Apply**: a literal edit at each listed call site.
- **Ask first**: the change needs a condition (it reaches some instances of a
  call site only), or the value comes from app logic, so the agent proposes the
  code and waits for your yes.
- **Context**: states you held open and flags you previewed. No code changes.
- **Don't apply**: changes held for review.

The agent finds each call site with `loupe locate`, which reads the same anchors
the panel uses, so it never guesses which `<Button>` you meant. Run from the
repo root, with your app's folder in it:

```bash
pnpm -C apps/app exec loupe locate < proposal.md
```

It prints each call site's file and line, and how each prop is written there
now. If the code around a call site changed since you copied the Proposal, it
says so, and the agent stops and asks. When the agent is done, the same command
with `--check` exits 0 only once every Apply change is in the code. The
Proposal names the exact command, `--out` included when your Product layer
isn't `packages/loupe`.

Loupe itself never edits your code: the agent does, at the call sites you
changed, never in a design-system default and never in the Product layer.

### When the panel asks you to run `generate`

Loupe reads your components when it is installed, and rereads them only when you
ask. If a component's source changed since, the panel tags it **Source
changed**. A new component shows as **Not generated yet**. Both come with the
command to run from the repo root, with your app's folder in it. For an app in
`apps/app`:

```bash
pnpm -C apps/app exec loupe generate
```

The `loupe` command is installed in the app, not at the repo root, so a plain
`pnpm exec loupe` from the root answers "Command "loupe" not found". You can
also ask Claude to run it. It rewrites only what changed. Commit what it writes.

If the panel says **Product layer missing**, `adapt-list.json` is gone, as after a
branch switch to a branch without it. Restore it with git. If the rest of the Product
layer is intact, you can write it again instead: run the command in the panel from
the repo root, replacing each `<dir>` with a path from the app folder (`pnpm -C` runs
it from there, so `.` is the app itself). When the command also has
`--specifier <name>`, the layer has no package name for `generate` to read, so
replace `<name>` with the path the app imports it by, such as `@/loupe`. Once the
file is back, the panel's Instances return by themselves. If the file is already gone
when `next dev` starts, `next dev` stops with an error that names the same command,
and `loupe doctor` names it too.

## What the install changes

Loupe edits at most four of your files, three when the repo has no root Biome
config. It never edits a component or a page.

| File | The edit |
| -- | -- |
| `<app>/package.json` | Two dev dependencies: `@danarocha/loupe` at an exact version, and `@repo/loupe` from the workspace. |
| `<app>/next.config.ts` | Imports `withLoupe` from `@repo/loupe/next` and wraps the default export: `export default withLoupe(nextConfig)`. It adds Loupe's loader to `next dev` only. |
| `<app>/app/layout.tsx` | Imports `LoupeMount` from `@repo/loupe/mount` and adds `{process.env.NODE_ENV === "development" && <LoupeMount />}` as the last item in `<body>`. |
| The root Biome config (`biome.jsonc`, else `biome.json`), only if there is one | Adds `"!packages/loupe"` to `files.includes`, with a comment above it, so the formatter leaves Loupe's files alone. |

When a file doesn't have the expected shape, such as a `next.config.mjs`, or a
Biome config with no `files.includes` list, the install shows you the snippet
for that file instead of editing it.

It also creates **`packages/loupe`** (`@repo/loupe`), the Product layer. It holds
the files Loupe generated for your components, and a ledger,
`packages/loupe/loupe.ledger.json`, recording every edit and file with a hash so
Loupe can tell its own work from yours. Commit it with the rest. Don't edit
anything in `packages/loupe` by hand: the plugin stops Claude from doing so, and
`generate` refuses to overwrite a file you changed.

Loupe never writes `pnpm-lock.yaml` itself; `pnpm install` does. See
[Install changed other lines in the lockfile](#install-changed-other-lines-in-the-lockfile).

In a production build the only trace is the mount's empty stub, which renders
nothing. The Toolbar, the loader and the generated files stay out. `loupe
doctor --build` builds the app and fails if they ever leak.

## Check an install

```
/loupe:doctor
```

It checks the install against its ledger and writes nothing: the compatibility
statement, that the Loupe version agrees everywhere, the four edits, and the
Product layer's files. For each problem it says what it means and how to fix it.
Ask it for a production check to have it run `doctor --build` too. That runs
`next build` under Node, takes a few minutes and needs the app's environment
variables.

## Remove Loupe

```
/loupe:remove
```

Removal undoes the install in a fixed order:

1. the `<LoupeMount />` block and the `withLoupe` wrapper;
2. the files in `packages/loupe` that Loupe still recognises as its own;
3. the Biome exclusion;
4. both dev dependencies, followed by `pnpm install`;
5. the ledger, last, once nothing is left.

It never overwrites something you changed by hand. Anything edited since Loupe
wrote it is left alone and listed, with what to undo. If the mount or the
wrapper was edited, removal stops after step 1, so the app still builds. Undo
what it lists, then run `/loupe:remove` again: it picks up where it stopped.

Afterwards the skill checks the lockfile and may offer to put it back exactly as
it was before the install (see
[Install changed other lines in the lockfile](#install-changed-other-lines-in-the-lockfile)).
Restart `next dev` when it's done, since a running dev server still has Loupe
loaded.

## Upgrade

```
/loupe:upgrade
```

The skill upgrades Loupe in place to the release your plugin installs. A newer
Loupe therefore starts with the plugin:

1. Update the plugin, then restart Claude Code:

   ```bash
   claude plugin marketplace update loupe
   ```

   ```bash
   claude plugin update loupe@loupe
   ```

2. Commit or stash any changes to the files the install touches (see
   [What the install changes](#what-the-install-changes)) and to
   `pnpm-lock.yaml`. `loupe init` won't run while they have uncommitted changes.
3. Open Claude Code in the product repo and run `/loupe:upgrade`.

The upgrade skill then:

1. says where the upgrade stands: the Loupe your plugin installs, the one
   recorded in the repo, and the one the app has. If the repo is already on the
   plugin's version it says so and stops. It never moves Loupe to an older
   version;
2. tells you what it will change and asks "Shall I upgrade Loupe from `<old>` to
   `<new>`?";
3. on your yes, sets `@danarocha/loupe` in the app's `package.json` to the new
   version, exact and without `^`, and runs `pnpm install`;
4. runs the compatibility check again, and asks about any untested item once;
5. shows what changed in `package.json` and `pnpm-lock.yaml` and, on a second
   yes, commits those two files and nothing else;
6. runs `loupe init`, which rewrites its own files in `packages/loupe`,
   regenerates your components' files for the new version, and ends with
   "Upgraded from Loupe `<old>` to `<new>`";
7. runs `pnpm install` again, since `loupe init` rewrites the Product layer's own
   `package.json`, which pins the Loupe version;
8. runs `loupe doctor`, and offers to check in the browser that a component can
   still be selected.

It commits only the version bump. What `loupe init` wrote, and the lockfile
change from the second install, are yours to review and commit. Restart `next
dev` when it's done, since a running dev server still has the old Loupe loaded.

If an upgrade stops, run `/loupe:upgrade` again: it picks up where it stopped.
When `loupe init` stops on a file that was edited by hand, the install stays on
the old version until that's resolved, and `/loupe:doctor` reports "Loupe
versions differ". The skill says which file, and offers to restore it from
before the edit with git, only on your yes.

To upgrade by hand, without the skill, follow
[Upgrading](packages/loupe/README.md#upgrading) in the CLI's README.

## Troubleshooting

### Install changed other lines in the lockfile

`pnpm install` after the install changes more of `pnpm-lock.yaml` than Loupe's
own entries, and that's expected. Loupe brings TypeScript 6 (through ts-morph),
so pnpm re-resolves an optional `typescript` peer to 6.x in packages that don't
depend on TypeScript themselves. It can move other peers too: on orbix-ai it
also moved `@hookform/resolvers`' `ajv` from 6.15.0 to 8.20.0 in the Storybook
app. None of this changes code.

Removing Loupe takes Loupe's entries out, and its `pnpm install` puts most of
those peers back. When only peer changes are left, the remove skill offers to
restore the lockfile from the commit before the install. It keeps the old one
only if `pnpm install --frozen-lockfile` accepts it.

If the install reports `other-changes`, a dependency moved that Loupe didn't ask
for. That isn't expected: report it, and keep the install or undo it with
`/loupe:remove`.

### Another app on localhost answers 500 with "flags: Missing FLAGS_SECRET"

A feature-flag preview is a `vercel-flag-overrides` cookie. Cookies ignore the
port, so a preview made in one app reaches every app on `localhost`, and an app
that uses the Flags SDK without a `FLAGS_SECRET` fails to load while it's there.

Delete the cookie: in Chrome, open DevTools → Application → Cookies →
`http://localhost`, delete `vercel-flag-overrides`, and reload. Next time, press
**Clear flag previews** before switching projects.

From 0.0.4 on, a preview expires 8 hours after your last flag change, and the
Feature flags card says so. A cookie written by 0.0.3 or earlier has no expiry
date: it stays until you clear it or end the browser session.

### The panel doesn't appear

- Restart `next dev`: Turbopack caches the loader, especially right after an
  install or a `generate`.
- In the browser console, check that `window.__loupe` exists. If it doesn't, the
  loader isn't running: check that the dev server isn't started with
  `LOUPE=0`, which turns Loupe off.
- Run `/loupe:doctor` and fix what it lists.

### Everything is inspect-only

If the Toolbar says "Overrides are off, everything is inspect-only: this React
build isn't supported", React's development internals didn't behave as Loupe
expects, so it can't tell instances apart reliably. Check the React version the
compatibility check printed against the statement.

A single component with no controls is usually not a problem: Coverage gives the
reason for each prop, such as `ON THE SERVER` for a server-rendered instance.

### The install or removal refuses to start

It refuses while a file it would change has uncommitted changes, and says which.
Commit or stash them, then run it again. The skill offers `--allow-dirty` only
when the changes are the install's own, for example removing an install you
never committed, or finishing an upgrade that stopped partway: it names the
files first and asks.

### Untracked `AGENTS.md` and `CLAUDE.md` in the app

Next.js 16.3 writes these into the app on its first `next dev`. They aren't
Loupe's; keep or delete them as you like.

## Demo

A short recording of the whole loop on orbix-ai (install, select a component,
change it at two scopes, copy a Proposal, apply it with an agent, remove) will go here. It waits for
the Toolbar's visual design, which will change how the panel looks.

## Working on Loupe

| Path | What it is |
| -- | -- |
| `packages/loupe` | Runtime, dev loader and the `loupe` CLI. Published to npm as `@danarocha/loupe`. Its [README](packages/loupe/README.md) is the CLI reference. |
| `plugins/loupe` | The Installer: a thin Claude Code plugin (skills `install`, `upgrade`, `remove`, `doctor` and a guard hook) that runs the CLI. See its [README](plugins/loupe/README.md). |
| `fixture/app` | A Next 16.3 app that CI runs every check against. |
| `fixture/design-system` | The fixture's tiny design system: shadcn-style components on Base UI and cva. It has no `components.json`, which is why the check grades it untested. |
| `fixture/app/loupe` | The fixture's Product layer, written by `loupe generate` and checked by `generate --check` in CI. |

The fixture app imports the design system through tsconfig `paths`, the same
way orbix-ai's `apps/app` imports `@repo/design-system`. The dev loader has to
treat those files as app source, not as `node_modules`.

```bash
pnpm install
pnpm --filter @danarocha/loupe build   # the fixture's next.config.ts imports dist
pnpm test
pnpm typecheck
pnpm --filter @fixture/app build
scripts/check-fixture-build-clean.sh
scripts/check-packed-bin.sh
```

### Releasing

The product pins Loupe exactly, so every release is a new version:

```bash
cd packages/loupe && npm publish --access public
```

`prepack` builds `dist` first. The plugin pins the release it installs; see
[Releasing](plugins/loupe/README.md#releasing) in the plugin's README.
