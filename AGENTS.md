# Agents

Loupe is a pnpm monorepo:
- `packages/loupe` is the published, development-only Next.js toolbar, drawn in a shadow root;
- `fixture/app` is a Next 16 host on port 3100 that the tests and the workbench run against.

## The toolbar's design system

Read `packages/loupe/DESIGN.md` first, its **Layers** section above all. It sets out:
- the four layers (tokens, primitives, patterns, views);
- the import rule between them:
  - nothing outside `packages/loupe/src/toolbar/ui/` imports UI SDK;
  - `ui/` imports nothing from `panel-view/`, `runtime/`, the patterns or the views;
  - a pattern (`src/toolbar/patterns/`) imports only `ui/`, the tokens, other patterns and `panel-view`'s types;
  - `src/toolbar/ui/layers.test.ts` enforces all three;
- the layered stylesheet and the surface every primitive draws in.

When you add or change a primitive:
- Work in its own folder, `src/toolbar/ui/<primitive>/`: the component, its `.css` (written against state attributes, values from the tokens), a role-based test inside the surface's real shadow root, and a `.md` of its states, ARIA and keys.
- Move its call sites onto it in the same change.
- Delete a view's test only once the primitive's own test covers the same behaviour.
- Look at it on the fixture's `/workbench` page (`pnpm --filter @fixture/app dev`, development only).

A pattern works the same way, in `src/toolbar/patterns/<pattern>/`: its `.css` in the `patterns` layer, against its own part attributes; a role-based test with axe in the surface; a `.md`; and sample panel-view data in `patterns/samples.ts` for its test and the workbench. It draws the words `panelView()` decided and builds none, and its callbacks make the writes, in the view.

Primitives are built on UI SDK (`@ui-sdk/react`, `@ui-sdk/core`, pinned to one exact version). Its `ui-sdk` skill is installed at `.claude/skills/ui-sdk/`, copied from `node_modules/@ui-sdk/core/skills/ui-sdk/`. Refresh that copy when the pin moves. The installed docs are in `node_modules/@ui-sdk/react/docs/`; start at `llms.txt`.

## Decisions

The architecture decision records live in `docs/adr/` and the plans in `plans/`, in the maintainer's checkout only. They are local and never go to GitHub: never `git add` them. ADR 0003 decides the primitives on UI SDK, and ADR 0004 the Vite build of the browser side.
