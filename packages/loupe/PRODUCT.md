# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: product designers.** They work in their product's own codebase, on their own machine, with the product's Next.js dev server running. They think in design-system variants, the way Figma presents them, know the product's screens well, and may not read code. They open Loupe to try other prop values on real components on a live screen, then have their own coding agent apply the result, or hand it to an engineer who will. Many already work with an agent in that repo: Loupe itself is installed through Claude Code.

**Secondary: engineers.** They review what a designer's agent changed, from the diff and a description written from the Proposal, or apply a Proposal a designer sends them, usually with their own agent. They need the exact file, call site and value for each change.

**Every Proposal is read first by a coding agent**, whoever runs it. It has to be exact enough that the agent never guesses a call site, a value or a scope (see `docs/adr/0002-proposal-is-written-for-coding-agents.md`).

**Screens:** a mix of laptops (about 1280–1512px wide) and external monitors (1600px and wider). The panel has to work at laptop widths and use extra room when there is some.

## Product Purpose

Loupe lists the real components on a page of a running Next.js app, shows the props each Instance was given, and lets a designer try other values live (Overrides) at a chosen Scope. When something works, the designer sends the Proposal to their coding agent, or copies it for any agent or an engineer: an exact list of changes, each one checked against the code once applied.

Success: a designer goes from "what if this button were outline?" to that exact change in the code, confirmed by Loupe and ready for review, without a meeting and without editing code by hand.

## Positioning

Loupe works on the product's own running components, with real data and real state, not on a catalogue, a mock or a design file. Its output is an exact list of changes, each tied to a call site and a value the designer saw working, that a coding agent applies without guessing. Loupe checks each one against the code. Where a tool like Agentation hands an agent a note about an element, Loupe hands it the change itself. Loupe never edits code itself: the designer's agent does.

## Operating Context

- Runs only in development (`next dev`), inside the product's app, as a toolbar in a shadow root over the product's own UI. Nothing from it reaches a production build.
- Installed into a product repo by a Claude Code plugin (the Installer), which runs the `loupe` CLI. Designers then start the dev server the way they usually do. The same plugin registers Loupe's MCP server and the `/loupe:apply` skill.
- Overrides live in the browser tab until the designer sends them. Reloading the page drops what wasn't sent. A sent Proposal is a snapshot kept by Loupe's dev-server integration until each change is applied or skipped.
- Feature-flag previews use the app's own Flags SDK and `FLAGS_SECRET`; the preview is a cookie every app on `localhost` sees.
- A Proposal reaches an agent one of two ways: Send to agent, through Loupe's MCP server, or Copy Proposal, as Markdown with its JSON underneath, for any agent or an engineer.

## Capabilities and Constraints

- Supported setup: Next.js 16 App Router with Turbopack dev, Node 22 or Bun, a pnpm workspace, TypeScript, one design system (see the README's "Is your setup supported?").
- Scopes: This instance, every Instance of a call site, or All on page. Label text can't be changed page-wide; a State prop can be held on one Instance only.
- Server-rendered and unadapted Instances are inspect only.
- The toolbar has to coexist with any host design system. Its styles live in a shadow root, and it never changes the product's own code or styles.
- Terminology is fixed in `GLOSSARY.md` (Instance, Call site, Override, Scope, Reach, Left out, Suspended, Proposal, Supported, Inspect only, State prop). UI copy uses those terms.

## Brand Commitments

- The panel follows the system's light or dark setting and keeps a manual switch. Both themes are required.
- The product is named Loupe (the Component Playground in planning documents). The name is not a binding visual motif.
- Not binding, open to change: the voice (short plain sentences, exact numbers). The panel's look is the Revision Set world recorded in `DESIGN.md` (2026-11-20), which replaced the Grading Report of 2026-11-19.

## Evidence on Hand

- `fixture/app`: a Members page built on a small shadcn-style design system (Base UI and cva, in `fixture/design-system`). Every check runs against it.
- Real product use so far: orbix-ai, per the README. It already runs Agentation with its MCP server.
- Other designers, watched or asked by the maintainer (2026-11), would rather paste changes into their own coding agent than send a report to engineering. Not written up; no numbers.
- There are no customer screenshots, testimonials or usage numbers. Don't invent them. The README's Demo section is waiting on the toolbar's visual design.

## Product Principles

1. **Designers first.** The panel speaks in what is on screen: names, visible text, variants. Code locations are supporting detail for the agent and for engineers.
2. **The product stays in view.** Loupe never hides the thing being inspected.
3. **Nothing is lost silently.** Changes can be recovered, and when the panel can't do something it says so and why.
4. **Exact, not approximate.** Every change in a Proposal maps to a call site and a value. The agent applying it never guesses: Loupe finds each call site; a change that needs more than a value edit asks the designer first; a design-system default is never changed on a page's behalf; and a change counts as applied only when the code says so.
5. **Dev-only, and the designer decides.** The toolbar and the `loupe` command never edit product code, and nothing reaches production. Code changes come only from the designer's own agent, at the listed call sites, never inside the Product layer, and with the designer's yes for any change that needs a decision.
