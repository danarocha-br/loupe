# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: product designers.** They work in their product's own codebase, on their own machine, with the product's Next.js dev server running. They think in design-system variants, the way Figma presents them, know the product's screens well, and may not read code. They open Loupe to try other prop values on real components on a live screen, then hand the result to engineering.

**Secondary: engineers who receive the Proposal.** They meet Loupe only through the exported HTML report or the Markdown summary, and need the exact file, call site and value for each change.

**Screens:** a mix of laptops (about 1280–1512px wide) and external monitors (1600px and wider). The panel has to work at laptop widths and use extra room when there is some.

## Product Purpose

Loupe lists the real components on a page of a running Next.js app, shows the props each Instance was given, and lets a designer try other values live (Overrides) at a chosen Scope. When something works, the designer exports a Proposal: an exact list of changes for an engineer to apply.

Success: a designer goes from "what if this button were outline?" to a Proposal an engineer can apply without a meeting.

## Positioning

Loupe works on the product's own running components, with real data and real state, not on a catalogue, a mock or a design file. It never edits code. Its output is an exact, reviewable list of changes, each tied to a call site.

## Operating Context

- Runs only in development (`next dev`), inside the product's app, as a toolbar in a shadow root over the product's own UI. Nothing from it reaches a production build.
- Installed into a product repo by a Claude Code plugin (the Installer), which runs the `loupe` CLI. Designers then start the dev server the way they usually do.
- Overrides live in the browser tab only. Reloading the page drops them.
- Feature-flag previews use the app's own Flags SDK and `FLAGS_SECRET`; the preview is a cookie every app on `localhost` sees.
- The Proposal is one self-contained HTML file, plus a Markdown summary for tickets.

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
- Real product use so far: orbix-ai, per the README.
- There are no customer screenshots, testimonials or usage numbers. Don't invent them. The README's Demo section is waiting on the toolbar's visual design.

## Product Principles

1. **Designers first.** The panel speaks in what is on screen: names, visible text, variants. Code locations are supporting detail for engineers.
2. **The product stays in view.** Loupe never hides the thing being inspected.
3. **Nothing is lost silently.** Changes can be recovered, and when the panel can't do something it says so and why.
4. **Exact, not approximate.** Every change in a Proposal maps to a call site and a value an engineer can apply.
5. **Dev-only and non-invasive.** Loupe never edits product code and never reaches production.
