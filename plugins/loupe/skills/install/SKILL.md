---
name: install
description: Install Loupe into a Next.js app in this pnpm workspace - check compatibility, explain the edits, get a yes, run loupe init and pnpm install, then confirm in the browser that an Instance can be selected in the Loupe Toolbar.
---

# Loupe: install

Loupe is a dev-only toolbar for inspecting and overriding the props of real components on a running page. The
`loupe` CLI makes every write; this skill explains, asks, runs it and relays what it prints. **You never edit
`packages/loupe` yourself, by any tool** (a hook refuses Edit and Write there), you never run `npx …@latest`,
`pnpm add`, `pnpm update` or change `pnpm.overrides`, and you never commit.

Run every command from the repo root (the folder with `pnpm-workspace.yaml`). `LOUPE` below means
`node "${CLAUDE_PLUGIN_ROOT}/scripts/loupe.mjs"`, which runs the exact Loupe release this plugin pins: the app's
own copy once it is installed, `pnpm dlx` of that exact version before.

## 1. Before anything

1. If `packages/loupe/loupe.ledger.json` exists and has a `"loupe"` field, Loupe is already installed: say so
   and run the **doctor** skill instead. Stop. (A ledger holding only `untestedAccepted` is a yes recorded by an
   earlier attempt that didn't finish; carry on.)
2. Run `git status --short`. `loupe init` refuses to run while the app's `package.json`, `next.config.ts`,
   root `layout.tsx`, the root Biome config, `pnpm-lock.yaml` or `packages/loupe/` have uncommitted changes. If
   any of them do, list them and ask the designer to commit or stash first. Stop. Never pass `--allow-dirty`
   unless the designer asks for it by name. The one exception to offer: when the only such change is
   `packages/loupe/` left by an earlier attempt that didn't finish, say so and ask whether to continue with
   `--allow-dirty`.

## 2. The compatibility check, and the Untested question

1. Run `LOUPE --pinned check </dev/null`. It writes nothing.
   - Exit code 3: the app already has another Loupe version. Relay the line and stop.
   - If it lists several apps and ends with "No app was chosen", show the list (one is marked as the one that
     uses the design system most) and ask which app. Rerun with `--app <dir>`. Use that `--app` from here on.
   - If it lists several design systems and ends with "No design system was chosen", show the list and ask
     which one. There is no flag for it: rerun with that number on stdin, `printf '<n>\n' | LOUPE --pinned check
     --app <app>`, and keep the number for step 4.
2. Read the `Result:` line.
   - `Result: Loupe can't be installed here.` Relay the ✗ lines word for word (each says what was found, what
     Loupe needs and the fix) and stop. Nothing was written.
   - `Result: works here.`, or `… untested item(s), accepted before.` Nothing to ask. Go to step 3.
   - `Result: works here, with N untested item(s).` (followed by "Continue? (yes/no)" and "Nothing was
     written." because nobody answered). This is the **Untested question, and you ask it once, here**: show each
     `!` line and its risk sentence word for word, then ask "Loupe hasn't been proven on these yet. Continue
     anyway?" On no, stop. On yes, remember it: you will pass that yes to `init` in step 4, and nobody is asked
     again.

## 3. Explain what will change, and ask for the yes

Tell the designer, for the chosen app (`<app>` below), that installing will:

- create `packages/loupe` (`@repo/loupe`), a committed workspace package that `loupe init` and `loupe generate`
  write: Adapters, prop metadata, the mount and a ledger (`loupe.ledger.json`) recording what was written. Its
  files are generated and must not be edited by hand.
- make four edits, each recorded in the ledger:
  - `<app>/package.json`: two devDependencies, `@danarocha/loupe` at exactly the pinned version and
    `@repo/loupe` from the workspace;
  - `<app>/next.config.ts`: wrap the default export in `withLoupe(...)`, which adds the dev loader only to
    `next dev`;
  - `<app>/app/layout.tsx`: a `{process.env.NODE_ENV === "development" && <LoupeMount />}` block, last in `<body>`;
  - the root Biome config: exclude `packages/loupe`.
- run `pnpm install`, which adds Loupe's entries to `pnpm-lock.yaml`. Loupe brings TypeScript 6 (through
  ts-morph), so pnpm also re-resolves an optional `typescript` peer to 6.x in packages that don't depend on
  TypeScript themselves. That changes no code; the remove skill can put it back.
- change nothing in a production build: the Toolbar loads only in development.

Nothing is committed. Ask: "Shall I make these changes?" Continue only on a clear yes.

## 4. Run `loupe init`

`init` reruns the check and asks the same questions in the same order, so pipe the designer's answers from
step 2, one per line: the design-system number if it was asked, then `yes` if there were untested items to accept.

- Both: `printf '<n>\nyes\n' | LOUPE --pinned init --app <app>`.
- Only untested items: `printf 'yes\n' | LOUPE --pinned init --app <app>`.
- Neither: `LOUPE --pinned init --app <app> </dev/null`.

Give it a 10-minute timeout; `generate` reads every component. Then by exit code:

- **0**: done. It ends "Next: run pnpm install …". Go to step 5.
- **2, a manual step**: a file had a shape `init` won't guess at. It printed the file and the exact snippet.
  Show them, ask whether to apply that snippet, and on yes make exactly that edit (these files are outside
  `packages/loupe`). Then run `LOUPE --pinned init --adopt --app <app> </dev/null` and go to step 5.
- **1**: something was refused or needs attention. Relay the ✗ lines and what it says to do, word for word,
  and stop. If files had uncommitted changes, it wrote nothing.

## 5. `pnpm install`, and what it did to the lockfile

1. Run `pnpm install` (a plain install, 10-minute timeout). If it fails, relay the error and stop; the edits stay
   and the remove skill undoes them.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lockfile.mjs" report --base HEAD`. By its `Result:` line:
   - `loupe-only` or `loupe-and-peers`: as explained. Say in one line which packages had their peer re-resolved.
   - `other-changes`: a dependency moved that Loupe didn't ask for, such as a `"latest"` specifier (orbix-ai's
     `radix-ui`) re-resolving. A plain install isn't expected to do that, since it re-resolves only the
     importers whose `package.json` changed. List those lines, say it is a Loupe bug worth reporting, and ask
     the designer whether to keep the install or undo it with the remove skill. Don't fix them yourself.
   - `unchanged` or `peers-only`: Loupe's entries are missing, so the install didn't take. Relay the pnpm
     output and stop.

## 6. `loupe doctor`

Run `LOUPE doctor`. Exit 0 is healthy (warnings allowed): say so in a line. Exit 1: relay the failing lines
and stop.

## 7. Check in the browser that an Instance can be selected

1. Start the app's dev server the way this project does (its launch config, or its `dev` script for that app),
   and open the app in the browser tool you have (the Browser pane, or Claude in Chrome). If a page needs a
   sign-in, ask the designer to sign in; never type credentials.
2. Open a page that renders design-system components. The Loupe panel appears on the right.
3. Select an Instance, by clicking a component on the page or a row in the panel's list. To do it by script:

   ```js
   const ui = document.querySelector("[data-loupe-toolbar]")?.shadowRoot;
   ui?.querySelector("button[data-instance]")?.click();
   ui?.querySelector('[data-testid="instance-id"]')?.textContent;
   ```

   The inspector then shows "Instance", the component's name and its id. Report the component you selected.
4. If the panel never appears: read the console, check that `window.__loupe` exists, restart the dev server
   (Turbopack caches), and run `LOUPE doctor`. Report what you found; don't edit `packages/loupe`.

If no browser tool is available, give the designer the URL, tell them to click any component, and say plainly
that you couldn't check this step.

## 8. Wrap up

Show `git status --short`. Say that Loupe is installed and dev-only, that the changes are theirs to review and
commit, and that the remove skill undoes all of it.
