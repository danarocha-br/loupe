# Agents

Loupe is a pnpm monorepo:
- `packages/loupe` is the published, development-only Next.js toolbar, drawn in a shadow root;
- `packages/ui` is `@loupe/ui`, the toolbar's design system: the tokens, the primitives and the surface they draw in. It is private, and `@danarocha/loupe` ships it inside its `dist/ui` (ADR 0010);
- `fixture/app` is a Next 16 host on port 3100 that the tests and the patterns' workbench run against;
- `fixture/visual` is the visual check, `pnpm visual` (below).

## The toolbar's design system

Read `packages/loupe/DESIGN.md` first, its **Layers** section above all. It sets out:
- the four layers (tokens, primitives, patterns, views);
- the import rule between them:
  - `@loupe/ui` imports nothing from Loupe (`packages/ui/src/boundary.test.ts`);
  - nothing in `packages/loupe` imports UI SDK, or reaches into `packages/ui` but through `@loupe/ui`'s entries;
  - a pattern (`src/toolbar/patterns/`) imports only `@loupe/ui` (the primitives and the tokens), other patterns and `panel-view`'s types;
  - `packages/loupe/src/toolbar/layers.test.ts` enforces Loupe's side;
- the layered stylesheet and the surface every primitive draws in.

When you add or change a primitive:
- Work in its own folder, `packages/ui/src/<primitive>/`: the component, its `.css` (written against state attributes, values from the tokens), a role-based test inside the surface's real shadow root, and a `.md` of its states, ARIA and keys. Export it from `packages/ui/src/index.ts`, and add its `.css` to `styles.ts`.
- Run the package's own checks: `pnpm --filter @loupe/ui test` and `typecheck`. `pnpm --filter @danarocha/loupe build` builds `@loupe/ui` first and ships its `dist`.
- Move its call sites onto it in the same change.
- Delete a view's test only once the primitive's own test covers the same behaviour.
- Look at it on the package's own workbench (`pnpm --filter @loupe/ui dev`, port 3200), which draws each primitive in its states, light and dark, with its `.md` beside it. Give a new primitive its states in `packages/ui/workbench/states/` and an entry in `workbench/primitives.ts`: a test fails until it has one.

A pattern works the same way, in `src/toolbar/patterns/<pattern>/`: its `.css` in the `patterns` layer, against its own part attributes; a role-based test with axe in the surface; a `.md`; and sample panel-view data in `patterns/samples.ts` for its test and the fixture's `/workbench` page. A value only the Toolbar draws from (a page mark's colour, a map hue) is a token in `src/toolbar/patterns/tokens.ts`, not in `@loupe/ui/tokens` (ADR 0011). It draws the words `panelView()` decided and builds none, and its callbacks make the writes, in the view.

Primitives are built on UI SDK (`@ui-sdk/react`, `@ui-sdk/core`, pinned to one exact version in `packages/ui/package.json`). `packages/loupe/package.json` repeats the pin, because `dist/ui` imports UI SDK; a test fails when the two differ. Its `ui-sdk` skill is installed at `.claude/skills/ui-sdk/`, copied from `packages/ui/node_modules/@ui-sdk/core/skills/ui-sdk/`. Refresh that copy when the pin moves. The installed docs are in `packages/ui/node_modules/@ui-sdk/react/docs/`; start at `llms.txt`.

## Before a PR: `pnpm visual`

A refactor keeps the layout identical to main. Prove it with `pnpm visual` before you open the PR, and paste its last line in the description. It records your working tree and its base, `git merge-base HEAD main`, on this machine, and diffs them:
- every `@loupe/ui` workbench page (`ui/<primitive>`), at 16px, at 20px and under forced colours, each with its light and dark surfaces;
- the Toolbar on the fixture, light and dark: the pill, hovered, then the hand harness's ten states, from the list to Hide marks (`toolbar/<theme>/…`), and the sheet over the page at 700 × 860 (`overlay/<theme>/…`);
- the fixture's `/workbench`, every pattern in each frame, and under forced colours (`patterns`, `patterns@forced`).

For each, every element in a Loupe shadow root: its box (to 0.05px), 85 computed properties, its `::before` and `::after`, its text and ARIA, the root's ARIA tree, and a screenshot of each root compared pixel by pixel. A pixel counts as changed when a channel moves by more than 3/255, since Skia can antialias a rounded corner 1/255 apart between runs; the structure names every colour exactly.

- **It exits 0** with `✓ No difference: …` and fails otherwise. `.visual/report.md` lists every difference, and `.visual/diff/` shows the changed pixels in red.
- **The baseline is made, not committed.** The tokens draw in the system's sans, so a baseline from one OS fails on another. `.visual/base` is a git worktree of the base, installed offline and built. Its recording is kept in `.visual/runs/` under the base's commit and a hash of the recorder, and reused until either changes. The first run takes a few minutes, the next ones about half that.
- **Options:**
  - `--base <ref>` compares against another ref.
  - `--only <prefix>` records the scenes whose name starts with it, for example `ui/chip-group` or `toolbar/dark`.
  - `pnpm visual:update` records the base again.
- **Stop the fixture's `next dev` first.** Next locks a project's dev server, and the check builds Loupe and starts its own servers on ports 3300 and 3310. It says so if one is running.
- **Where a change is meant,** say so in the PR and list what the report shows. CI runs the same check on every pull request (the `visual` job, against `origin/main`, with the report in the job's summary and as an artifact); a meant change passes there once the PR has the `visual-change` label and the job is re-run.
- **New noise** gets fixed in the recorder (`fixture/visual/src/`), never by loosening a tolerance. The recorder stops the page's clock at its first capture and runs it 3s ahead at each one, so the landing ring's `data-quiet`, the sheet's close and an announcement have settled and nothing fires mid-capture. It also turns transitions off, and measures a box from its section, keyed by the section's heading, so an inserted section moves one box.

## Decisions

The architecture decision records live in `docs/adr/` and the plans in `plans/`, in the maintainer's checkout only. They are local and never go to GitHub: never `git add` them. ADR 0003 decides the primitives on UI SDK, ADR 0004 the Vite build of the browser side, ADR 0010 the primitives' package, `@loupe/ui`, and ADR 0011 its own workbench and the Toolbar's tokens kept out of it.
