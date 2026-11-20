---
version: 1
slug: "src-toolbar-panel-tsx"
primary_target: "src/toolbar/panel.tsx"
related_targets: ["src/toolbar/styles.ts","src/toolbar/index.tsx"]
---

# Surface: the Loupe toolbar panel

Mode: Operate. A dev-only tool column inside the product's own running app, used by product designers to inspect real components, try other prop values (Overrides) and export a Proposal for engineers.

Audience and job: product designers who think in variants and may not read code. Primary task: find a component by what is on screen, choose one Instance or its whole call site with the select tool, change a value, see it marked, export. Constraints: shadow root, no webfonts (system stacks), light and dark both required, coexists with any host design system, must never hide the product.

Unresolved: the dock side (right by default, left on request) is the designer's per-browser choice; a narrow viewport (under two column widths) overlays instead of reserving a column.

## Direction contract

Replaced 2026-11-20: the Revision Set, from the designer's own Paper exploration "A · Revision Set" (file "Loupe", page "Panel directions · not picked"), after the Grading Report of 2026-11-19.

THESIS: Every Override is marked the way a drawing marks a revision: a dashed revision cloud around each Instance the change reaches, and a numbered delta on its corner that matches the delta on the prop's card, in the footer, in the change list and on the change in the Proposal. Scope is the select tool, as in Figma, so the panel holds only the props. It refuses the category default: a floating dark pill-panel over the product with generic accent chips.

OWN-WORLD: A warm sheet with white cards on it. Light: sheet #F6F3EF, cards #FFFFFF, ink #0A0A0A, an ink band #1B2220. Dark: sheet #0E1110, cards #181C1B, band #29322F. One accent family, lilac: fill #CCCDFF (dark #3A3884) for what is chosen, line #8276CF (dark #A99FF2) and ink #4F43B8 (dark #BDB5FF) for what was revised. Teal switches, a green Supported chip, amber and orange only for notices and failures. Soft pills for buttons and tags, 18px cards, 12px option tables on hairlines, system sans for words, system mono for evidence and uppercase annotations.

STORY: The designer presses Select one or Select multiple, clicks a component on the page, and the panel shows it by its visible name with one card per prop. They choose another option in a prop's table; a numbered delta lands on the card and a dashed cloud with the same delta wraps every Instance it reaches. A link widens a call site to the whole page. Undo is always one click away. They export a Proposal whose changes carry the same numbers.

FIRST VIEWPORT: The product reflows to the left; the sheet floats 8px inside a column on the right (360px, 400px from 1600px wide), 24px corners, a 1px edge and a soft shadow. Band: the Loupe wordmark and the page crumb, then the two select tools in a pill group, Hide marks, light or dark, and Hide as round tools. Body: the identity card (back, component and verdict chip, the visible name at 17px, the call site in mono), the selection card under Select multiple, then a card per prop and one card of switches. Footer card: the Override count and its deltas, Copy, Reset all, and Export Proposal at the right.

FORM: Revision set (architectural drawing revisions), chosen by the designer from a Paper comp rather than a roll. Signature interaction: the revision mark, a numbered delta on a dashed cloud around each changed Instance, matching its card and the Proposal's change id. Motion grammar: the delta settling in (180ms, scale and fade), the cloud fading up (200ms), a switch's thumb (180ms); everything else at most a 120ms colour change; reduced motion drops the movement.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
