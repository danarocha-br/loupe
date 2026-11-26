# Agents

Loupe is a pnpm monorepo:
- `packages/loupe` is the published, development-only Next.js toolbar, drawn in a shadow root;
- `packages/ui` is `@loupe/ui`, the toolbar's design system: the tokens, the primitives and the surface they draw in. It is private, and `@danarocha/loupe` ships it inside its `dist/ui` (ADR 0010);
- `packages/patterns` is `@loupe/patterns`, the Toolbar's patterns on `@loupe/ui`: Loupe's product layer, its contract (`view.ts`), its own tokens and the stylesheet the Toolbar adopts. It is private too, and `@danarocha/loupe` ships it inside its `dist/patterns` (ADR 0012);
- `fixture/app` is a Next 16 host on port 3100 that the tests run against;
- `fixture/visual` is the visual check, `pnpm visual` (below).

## The toolbar's design system

Read `packages/loupe/DESIGN.md` first, its **Layers** section above all. It sets out:
- the four layers (tokens, primitives, patterns, views);
- the import rule between them:
  - `@loupe/ui` imports nothing from Loupe (`packages/ui/src/boundary.test.ts`);
  - `@loupe/patterns` imports only `@loupe/ui`'s entries, React and itself; a pattern (`packages/patterns/src/<pattern>/`) only `@loupe/ui` (the primitives and the tokens), other patterns, the package's `tokens.ts` and the contract, `view.ts`; nothing from Loupe, `panel-view` least of all, not even a type (ADR 0012, `packages/patterns/src/boundary.test.ts`);
  - nothing in `packages/loupe` imports UI SDK, or reaches into `packages/ui` or `packages/patterns` but through their entries; `panel-view`, the adapter, takes from `@loupe/patterns` only the contract's types and `@loupe/patterns/tokens`;
  - `packages/loupe/src/toolbar/layers.test.ts` enforces Loupe's side;
- the layered stylesheet and the surface every primitive draws in.

When you add or change a primitive:
- Work in its own folder, `packages/ui/src/<primitive>/`: the component, its `.css` (written against state attributes, values from the tokens), a role-based test inside the surface's real shadow root, and a `.md` of its states, ARIA and keys. Export it from `packages/ui/src/index.ts`, and add its `.css` to `styles.ts`.
- Run the package's own checks: `pnpm --filter @loupe/ui test` and `typecheck`. `pnpm --filter @danarocha/loupe build` builds `@loupe/ui` first and ships its `dist`.
- Move its call sites onto it in the same change.
- Delete a view's test only once the primitive's own test covers the same behaviour.
- Look at it on the package's own workbench (`pnpm --filter @loupe/ui dev`, port 3200), which draws each primitive in its states, light and dark, with its `.md` beside it. An edit keeps the page as it was: a component's `.tsx` through React Refresh, a `.css` by swapping the surfaces' stylesheet in place (`workbench/vite.ts`, `@loupe/ui/workbench/vite`, which both workbenches' configs take; never the build's). Give a new primitive its states in `packages/ui/workbench/states/` and an entry in `workbench/primitives.ts`: a test fails until it has one.

A pattern works the same way, in `packages/patterns/src/<pattern>/`: its `.css` in the `patterns` layer, against its own part attributes; a role-based test with axe in the surface (`../testing.fixture.js`, the package's `@loupe/patterns/testing`); a `.md`; and sample data in `src/samples.ts` for its test and the package's workbench. Export it from `src/index.ts`, and add its `.css` to `src/styles.ts`. The types it draws are the contract's, in `src/view.ts`: a new one goes there (or in the pattern's own folder, if that pattern alone uses it), and `panelView()` returns it. Its words come from `samples.ts`'s `WORDS`, spelled out, never a `*_WORDS` constant; Loupe's `panel-view/samples.test.ts` holds them equal to panel-view's. A value only the Toolbar draws from (a page mark's colour, a map hue) is a token in `packages/patterns/src/tokens.ts` (`@loupe/patterns/tokens`), not in `@loupe/ui/tokens` (ADR 0011). It draws the words `panelView()` decided and builds none, and its callbacks make the writes, in the view.
- Run the package's own checks: `pnpm --filter @loupe/patterns test` and `typecheck`. `pnpm --filter @danarocha/loupe build` builds `@loupe/patterns`, which builds `@loupe/ui` first, and ships both `dist`s.
- Look at it on the package's own workbench (`pnpm --filter @loupe/patterns dev`, port 3201), drawn in the same shell as `@loupe/ui`'s (`@loupe/ui/workbench`, never shipped): each pattern in its states with its sample data, light and dark, with its `.md` beside it. Give a new pattern its states in `packages/patterns/workbench/states/` and an entry in `workbench/patterns.ts`: a test fails until it has one.
- Loupe reaches the package through its entries alone: `@loupe/patterns` (every pattern, the contract's types, `STYLESHEET`), `/launcher` (the pill, which the collapsed Toolbar loads alone), `/stylesheet`, `/tokens`, and for tests `/testing`. A new entry goes in its `package.json`, then in both of Loupe's tsconfigs: a test fails until it does.

Primitives are built on UI SDK (`@ui-sdk/react`, `@ui-sdk/core`, pinned to one exact version in `packages/ui/package.json`). `packages/loupe/package.json` repeats the pin, because `dist/ui` imports UI SDK; a test fails when the two differ. `@loupe/patterns` names UI SDK nowhere: it draws it through `@loupe/ui`'s primitives. Its `ui-sdk` skill is installed at `.claude/skills/ui-sdk/`, copied from `packages/ui/node_modules/@ui-sdk/core/skills/ui-sdk/`. Refresh that copy when the pin moves. The installed docs are in `packages/ui/node_modules/@ui-sdk/react/docs/`; start at `llms.txt`.

## Before a PR: `pnpm visual`

A refactor keeps the layout identical to main. Prove it with `pnpm visual` before you open the PR, and paste its last line in the description. It records your working tree and its base, `git merge-base HEAD main`, on this machine, and diffs them:
- every `@loupe/ui` workbench page (`ui/<primitive>`), at 16px, at 20px and under forced colours, each with its light and dark surfaces;
- every `@loupe/patterns` workbench page (`patterns/<pattern>`), the same way;
- the Toolbar on the fixture, light and dark: the pill, hovered, then the hand harness's ten states, from the list to Hide marks (`toolbar/<theme>/…`), and the sheet over the page at 700 × 860 (`overlay/<theme>/…`).

It needs Node 22.12 or later (the repo's `.nvmrc`; Vite's floor on 22) and, once per machine, Playwright's Chromium:

```bash
pnpm --filter @fixture/visual exec playwright install --only-shell chromium
```

On Linux, add `--with-deps` for the browser's system libraries.

For each, every element in a Loupe shadow root: its box (to 0.05px), 85 computed properties, its `::before` and `::after`, its text and ARIA (an `aria-controls` or `aria-labelledby` as the key of the element it names), the root's ARIA tree, and a screenshot of each root compared pixel by pixel. A pixel counts as changed when a channel moves by more than 3/255, since Skia can antialias a rounded corner 1/255 apart between runs; the structure names every colour exactly.

- **It exits 0** with `✓ No difference: …`, 1 when something differs, and 2 when the check couldn't run (a build, a server, a scene that couldn't be driven, or an `--only` that selects nothing). `.visual/report.md` lists every difference, and `.visual/diff/` shows the changed pixels in red.
- **The baseline is made, not committed.** The tokens draw in the system's sans, so a baseline from one OS fails on another. `.visual/base` is a git worktree of the base, installed offline and built. Its recording is kept in `.visual/runs/` under the base's commit and a hash of the recorder, and reused until either changes. The first run takes a few minutes, the next ones about half that.
- **Options:**
  - `--base <ref>` compares against another ref. The default is `main`, or `origin/main` where there is no local `main`.
  - `--only <prefix>` records the scenes whose name starts with it, for example `ui/chip-group` or `toolbar/dark`.
  - `pnpm visual:update` records the base again.
- **Stop the fixture's `next dev` first.** Next locks a project's dev server, and a build of Loupe under it breaks it. The check says so before it builds anything. It starts its own servers on ports 3300 (`@loupe/ui`'s workbench), 3310 (the fixture) and 3320 (`@loupe/patterns`' workbench), and stops if any of them is taken, so it never measures another checkout's server. Ctrl+C stops them too.
- **Where a change is meant,** say so in the PR and list what the report shows. CI runs the same check on every pull request: the `visual` job, against `origin/main`, with the report in the job's summary and as an artifact. A meant change passes there once the PR has the `visual-change` label and the job is re-run. The label waives a difference (exit 1), never a check that couldn't run (exit 2).
- **New noise** gets fixed in the recorder (`fixture/visual/src/`), never by loosening a tolerance. The recorder stops the page's clock at its first capture and runs it 3s ahead at each one, so the landing ring's `data-quiet`, the sheet's close and an announcement have settled and nothing fires mid-capture. It also turns transitions off, measures a box from its section, keyed by the section's heading, so an inserted section moves one box, and turns Chromium's partial raster off, since a tile repainted in part antialiases an edge a few levels apart, by a clip that varies from run to run.

## Decisions

The architecture decision records live in `docs/adr/` and the plans in `plans/`, in the maintainer's checkout only. They are local and never go to GitHub: never `git add` them. ADR 0003 decides the primitives on UI SDK, ADR 0004 the Vite build of the browser side, ADR 0010 the primitives' package, `@loupe/ui`, and ADR 0011 its own workbench and the Toolbar's tokens kept out of it. ADR 0012 gives the patterns their own view contract, `view.ts`, with `panelView()` as the adapter, and moves them into the private `@loupe/patterns`, with a workbench shell shared with `@loupe/ui`.
