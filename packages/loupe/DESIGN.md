---
name: Loupe Toolbar
description: A dev-only sheet beside the running product that marks every Override the way a drawing marks a revision.
colors:
  sheet: "#F6F3EF"
  card: "#FFFFFF"
  sunk: "#F1F3F3"
  sunk-hover: "#E5E8E8"
  hover: "#F8F7F4"
  ink: "#0A0A0A"
  on-ink: "#FFFFFF"
  muted: "#5E5E5E"
  faint: "#737373"
  rule: "#E4E4E4"
  rule-soft: "#F0F0EE"
  rule-strong: "#C9C5BE"
  edge: "rgba(27, 34, 32, 0.07)"
  band: "#1B2220"
  on-band: "#F0F0F0"
  band-muted: "#9A9A9A"
  band-hover: "rgba(246, 243, 239, 0.1)"
  band-pressed: "rgba(246, 243, 239, 0.16)"
  lilac: "#CCCDFF"
  on-lilac: "#0A0A0A"
  lilac-line: "#8276CF"
  lilac-ink: "#4F43B8"
  ok-bg: "#DFF7E4"
  ok-fg: "#14532D"
  switch-off: "#EBE7E0"
  switch-on: "#27917E"
  primary: "#1B2220"
  on-primary: "#FFFFFF"
  pencil: "#8E959C"
  alert: "#C2570C"
  amber-fg: "#7A4B00"
  amber-bg: "#FFF3DC"
  amber-dot: "#C98A12"
  sheet-dark: "#0E1110"
  card-dark: "#181C1B"
  sunk-dark: "#242928"
  sunk-hover-dark: "#2E3432"
  hover-dark: "#1F2423"
  ink-dark: "#ECEDEA"
  on-ink-dark: "#0E1110"
  muted-dark: "#A4AAA7"
  faint-dark: "#8B918E"
  rule-dark: "#2C3230"
  rule-soft-dark: "#232827"
  rule-strong-dark: "#4A514E"
  band-dark: "#29322F"
  band-muted-dark: "#A3AAA7"
  lilac-dark: "#3A3884"
  on-lilac-dark: "#F1F0FF"
  lilac-line-dark: "#A99FF2"
  lilac-ink-dark: "#BDB5FF"
  ok-bg-dark: "#143A25"
  ok-fg-dark: "#93E2AC"
  switch-off-dark: "#353B39"
  switch-on-dark: "#2FA58F"
  primary-dark: "#F6F3EF"
  on-primary-dark: "#1B2220"
  pencil-dark: "#6B737C"
  alert-dark: "#F0904A"
  amber-fg-dark: "#E5B567"
  amber-bg-dark: "#2A2109"
  amber-dot-dark: "#D9963B"
  page-line: "#8276CF"
  page-ink: "#4F43B8"
  page-fill: "rgba(204, 205, 255, 0.34)"
  page-band: "#1B2220"
  page-hover: "#6F7472"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.015em"
  wordmark:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "24px"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  control:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  option:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "14px"
  meta:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "14px"
    fontFeature: "\"tnum\""
  delta:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  mono-small:
    fontFamily: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "16px"
  annotation:
    fontFamily: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "14px"
    letterSpacing: "0.04em"
rounded:
  checkbox: "5px"
  ring: "8px"
  table: "12px"
  status: "14px"
  card: "18px"
  sheet: "24px"
  pill: "999px"
spacing:
  table-line: "1px"
  hair: "2px"
  xs: "4px"
  sheet: "6px"
  inset: "8px"
  row: "10px"
  card: "12px"
  gutter: "14px"
  dialog: "18px"
components:
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sheet}"
    width: "344px"
  panel-wide:
    width: "384px"
  header-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.on-band}"
    typography: "{typography.wordmark}"
    padding: "0 9px 0 18px"
    height: "48px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px 14px"
  prop-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "6px 6px 12px 12px"
  tool:
    textColor: "{colors.on-band}"
    rounded: "{rounded.pill}"
    size: "30px"
  tool-hover:
    backgroundColor: "{colors.band-hover}"
  tool-mode:
    backgroundColor: "{colors.band-pressed}"
  tool-armed:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.band}"
  back-button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "28px"
  button:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  button-hover:
    backgroundColor: "{colors.sunk-hover}"
  button-small:
    padding: "0 11px"
    height: "26px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "0 18px 0 16px"
    height: "40px"
  option-table:
    backgroundColor: "{colors.rule}"
    rounded: "{rounded.table}"
  option-cell:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted}"
    typography: "{typography.option}"
    padding: "4px 8px"
    height: "30px"
  option-cell-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  option-cell-selected:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.on-lilac}"
  switch:
    backgroundColor: "{colors.switch-off}"
    rounded: "{rounded.pill}"
    width: "40px"
    height: "22px"
  switch-on:
    backgroundColor: "{colors.switch-on}"
  delta:
    backgroundColor: "{colors.card}"
    textColor: "{colors.lilac-ink}"
    typography: "{typography.delta}"
    width: "22px"
    height: "20px"
  status-chip:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "2px 7px 2px 6px"
  status-chip-supported:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-fg}"
  tag:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  tag-stale:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber-fg}"
  text-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.table}"
    padding: "8px 12px"
  status-line:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.on-lilac}"
    typography: "{typography.control}"
    rounded: "{rounded.status}"
    padding: "8px 12px"
  warn:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber-fg}"
    rounded: "{rounded.table}"
    padding: "10px 12px"
  copy-dialog:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    width: "440px"
---

# Design System: Loupe Toolbar

## Overview

**Creative North Star: "The Revision Set"**

The Loupe panel is the revision sheet pinned beside a set of drawings. On an architect's drawing a change gets a small triangle, a delta, carrying the revision's number; the same number lists the change in the revision table. Loupe numbers an Override the same way: a delta on the prop's card in the panel, in the footer and in the change list, and the same number on the change in the copied Proposal. The page itself stays the product's (2026-11-20): plain outlines show what is selected and, for a moment, what a change reached, then step back so the change can be judged as it will ship.

The sheet itself is warm and calm. A dark ink band runs across the top, and below it the panel is a column of white cards on a warm ground: the selection, then one card per prop, each prop's options laid out as a small table of hairline cells with the chosen one filled lilac. It works the way a designer already works in Figma: the scope of a change is the select tool in the header (one Instance, or every Instance from its call site), not a control in the middle of the panel, so the cards hold only the props.

It is a dev tool inside someone else's product, so it stays a guest. It uses system faces only, keeps every style inside its shadow root, and never covers the product: the page reflows to leave a column, and the sheet floats 8px inside it. Light and dark are both first-class, with every colour a token on the shadow host.

**Key Characteristics:**
- A warm sheet with white cards on it; one card per prop.
- An ink band on top: the only dark slab besides the primary button.
- One accent family, lilac: its fill marks what is chosen, its line marks what was revised.
- Numbered deltas tie a change together across panel and Proposal; on the page, plain outlines that step back once a change has landed.
- Scope chosen with the header's select tools, as in Figma.
- System sans for words, system mono for evidence and small annotations.
- Motion only where something lands: a delta settling in, a change's outlines fading in and stepping back, a switch's thumb.

## Colors

A warm off-white sheet, white cards, near-black ink, and one lilac family that carries both choice and revision.

### Primary
- **Chosen Lilac** (`lilac`, dark `lilac-dark`): the fill of the chosen option in a prop's table, the instruction strip while a select tool waits for a click, and the held button state. Text on it uses `on-lilac`.
- **Revision Line** (`lilac-line`, dark `lilac-line-dark`): the delta's stroke, the Override dot, the coverage bar's editable segments, ticked checkboxes, focus outlines and the text field's focus edge.
- **Revision Ink** (`lilac-ink`, dark `lilac-ink-dark`): lilac text that has to be read: the number inside a delta, the new value in a change line, the "changed" count in the component list, the widen link and the "keep" link.

### Neutral
- **Warm Sheet** (`sheet` / `sheet-dark`): the panel's ground, the back button, the selection strip, notices and the command line.
- **Card White** (`card` / `card-dark`): every card on the sheet, option cells at rest, text fields, and the delta's fill.
- **Sunk** (`sunk` / `sunk-dark`) and **Sunk Hover** (`sunk-hover`): soft pill buttons, tags, status chips and crumbs, and their hover.
- **Hover Wash** (`hover` / `hover-dark`): hover on rows and option cells inside a card, and an open group in the component list.
- **Ink** (`ink` / `ink-dark`): all primary text. `on-ink` is its counter-colour.
- **Muted** (`muted`) and **Faint** (`faint`): option labels at rest, secondary lines, values; faint for counts, arrows, annotations and left-out Instances.
- **Rule** (`rule`): the option table's hairlines and field borders. **Rule Soft** (`rule-soft`): row separators inside a card. **Rule Strong** (`rule-strong`): checkbox borders and the scrollbar. **Edge** (`edge`): the sheet's 1px outline against the product.
- **Band** (`band` / `band-dark`): the header. **On Band** (`on-band`) for the wordmark and tools, **Band Muted** (`band-muted`) for the page crumb. **Band Hover** and **Band Pressed** are translucent washes of the sheet colour for the tools.
- **Primary** (`primary` / `primary-dark`): Copy Proposal only. Ink in light, the warm sheet colour in dark.
- **Pencil** (`pencil`): held for review (Suspended): the hollow ring and the held tag. Applies to nothing on the page.

### Status
- **Supported Green** (`ok-bg`, `ok-fg`): the "Supported" chip beside the component name.
- **Switch Teal** (`switch-on`), against **Switch Off** (`switch-off`): a true/false prop's switch.
- **Alert Orange** (`alert`): failures only, as a dot beside the sentence that says what failed.
- **Notice Amber** (`amber-fg`, `amber-bg`, `amber-dot`): out of date and warnings: stale tags, the warn strip, the flag-previews-off dot.

### On the page
- **Page Ink** (`page-ink`), **Page Line** (`page-line`) and **Page Fill** (`page-fill`): the outlines over the host product. They are fixed light values in both panel themes, because they sit on the app, not on the panel. The selected Instance's outline is solid `page-ink` and its tag is `page-ink` with white figures (7.4:1); the other Instances a selection or a change reaches are dashed `page-line`; left-out and hovered Instances are dashed **Page Hover** (`page-hover`). The pick tag is a **Page Band** (`page-band`) pill.
- **Picking** (a select tool armed), after the browser's element picker: what a click would select gets a solid `page-line` outline washed with `page-fill`, standing in for the selection's outline while the pointer is on an Instance. Select one outlines the Instance under the pointer; Select multiple outlines every Instance from its call site, a left-out one dashed. A `page-band` pill tag names the component on the hovered Instance's top-left ("Button"), with a muted detail: "4 from this call site" in Select multiple, "Inspect only" when no Override can reach it. The tag goes below the outline when there is no room above, and slides sideways to stay clear of the page's edge and the panel's column.

### Named Rules
**The One Violet Family Rule.** Lilac is the only accent. Its fill means chosen; its line means revised. Nothing else is lilac, and no second accent is added for brand, selection or emphasis.

**The No Red Rule.** Nothing in the panel is red. Failures are alert orange, warnings amber, changes lilac.

## Typography

**Body Font:** the system sans stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`)
**Mono Font:** the system mono stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`)

**Character:** The panel lives in a shadow root inside a dev build and cannot load a web font, so it speaks in the operating system's own voice: on a Mac, SF Pro and SF Mono, close cousins of the Inter Tight and Geist Mono the Revision Set was drawn in. Hierarchy comes from a few steps of size and weight and slightly tight tracking on names.

### Hierarchy
- **Headline** (600, 17px/22px, -0.015em): the selected Instance's visible name and the page name; the Copy Proposal dialog's title steps up to 18px/24px.
- **Wordmark** (600, 14px/20px, -0.01em): "Loupe" in the band.
- **Title** (500, 14px/18px, -0.01em): card titles, prop names, the component name beside the back button, and the footer's Override count.
- **Body** (400, 13px/18px): the panel's base text and text fields. Explanatory paragraphs run 13px/19px in muted.
- **Control** (500, 12px/16px): buttons, links, the status strip.
- **Option** (400, 12px/16px): option cells; the chosen one at 500.
- **Label** (500, 11px/14px) and **Meta** (400, 11px/14px, tabular, faint): field labels and the counts beside card titles.
- **Delta** (700, 9px/1, tabular): the number inside a delta.
- **Mono** (400, 12px/16px) and **Mono Small** (400, 11px/16px): call sites, change lines, values set by the code, crumbs.
- **Annotation** (400, 10px/14px, 0.04em, uppercase mono): the page crumb in the band, "SAME ON ALL 4", a switch's TRUE or FALSE, and the status chip (500, 10px/12px).

### Named Rules
**The Mono Is Evidence Rule.** Mono is for what an engineer would paste (values, call sites, commands, flag keys) and for small uppercase annotations. Names a designer reads on screen stay in sans.

**The Tabular Figures Rule.** Every counted or keyed number (Override counts, Instance counts, ×N, delta numbers, option counts, tiles) uses `font-variant-numeric: tabular-nums`.

## Layout

While the panel is open the page gives it a column on the right by taking a matching right margin on the document root (360px, 400px from a 1600px viewport), so the product reflows beside it the way it would beside DevTools. The sheet floats 8px inside that column on every side (344px wide, 384px wide), with 24px corners. Below two column widths of viewport (under 720px) the page keeps the whole viewport and the sheet overlays it.

The sheet is three bands, top to bottom:
- **The band** (48px): the wordmark and the page crumb on the left; on the right the two select tools in their own soft pill group, then Hide marks, light or dark, and Hide, all 30px round tools.
- **The middle**, scrolling: cards in one column, 6px apart, 6px from the sheet's edges.
- **The footer card**, pinned: the count ("2 changes · 1 state shown") with its deltas on the right, a dashed unnumbered delta for each state shown, and below it Reset all and Copy Proposal at the right edge. A change's number is the one it got when it was made: it never moves, and a reset one leaves a gap.

A lilac status strip appears under the band for transient states: a select tool waiting for a click, a dialog under the panel, marks hidden on the page.

Inside the middle, a selection reads top to bottom: the identity card (back, component name and verdict chip, the Instance's visible name, its call site), then under Select multiple the selection card, then one card per prop with options or a text field, then one card of switches for the true/false props, then the props set by the code folded to one line, then Coverage. Cards pad 12px by 14px; a prop card pads 6px top and right so its Reset pill sits in the corner. Rows inside a card are 38–42px on `rule-soft` lines. Spacing steps are 1, 2, 4, 6, 8, 10, 12, 14 and 18px.

Holding Alt fades the panel to 8% opacity and lets clicks through, so an app dialog under the column can be seen.

## Elevation & Depth

Two levels: the sheet floats, the cards do not. The sheet stands off the product on a 1px `edge` outline and a soft two-layer shadow; everything on it is flat and separated by tone (warm sheet against white cards) and by hairlines.

### Shadow Vocabulary
- **Sheet** (`0 1px 2px rgba(27,34,32,0.05), 0 8px 24px rgba(27,34,32,0.07)`; dark `0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35)`): the docked sheet.
- **Overlay** (`0 12px 36px rgba(27,34,32,0.22), 0 2px 6px rgba(27,34,32,0.1)`; dark `0 12px 36px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)`): the sheet when it overlays a narrow viewport, and the "Show Loupe" pill when the panel is hidden.
- **Dialog** (`0 24px 64px rgba(27,34,32,0.22)`; dark `0 24px 64px rgba(0,0,0,0.6)`): the Copy Proposal dialog, over a `rgba(27,34,32,0.32)` backdrop.

### Named Rules
**The Flat Cards Rule.** Cards never carry a shadow or a border. Tone separates them from the sheet; hairlines separate what is inside them.

## Shapes

Soft, generous corners in three steps: the sheet and the Copy Proposal dialog at 24px, cards at 18px, option tables, fields and notices at 12px. Every button, tag, chip and tool is a full pill. Inside an option table the cells meet on 1px hairlines with no radius of their own, and the table's 12px corner clips them.

One shape carries meaning and appears nowhere else:
- **The delta**: an equilateral triangle, 22px wide, white with a 1.25px lilac stroke and its number at the base. Dashed and empty, it is a State prop held on one Instance. It stays in the panel and the Proposal; the page carries no numbers.

On the page, a solid outline is the one Instance in hand and a dashed lilac one is the rest of what it reaches. Grey dashes mean "not applied": a left-out Instance's outline, a hovered outline; in the panel, the held tag.

## Components

### Select tools
The scope of a change, chosen the way Figma selects.
- **Select one** (the arrow) and **Select multiple** (two stacked frames and the arrow) sit together in a soft pill group on the band (`rgba(246,243,239,0.05)`, 2px inset).
- **Mode:** the tool in use carries the `band-pressed` wash. It is kept for the next selection until the page reloads.
- **Armed:** pressing a tool re-scopes the current selection at once and waits for a click on the page; while it waits it is filled with the warm sheet colour and band-coloured icon, and the lilac strip says what a click will select. Pressed again, or Esc, it stops.
- **Leaving a selection**, as in Figma: Esc, or a pointer click on the page outside every selected Instance (at Select multiple, outside every one it reaches), goes back to the component list. Loupe only listens: the key and the click still reach the app, never stopped or delayed. Esc stays the app's while it has a menu or dialog open, a text field's while one has focus, and a select tool's while one is armed (Esc then stops picking first). A click in the panel, or one from the keyboard, never counts.
- **Select multiple** opens a selection card: the call site's name, "4 of 4 previewed", a **Widen to All on page · 7** link (or **Narrow to** the call site), **Reset this scope**, and the Instances folded under a disclosure row, open on its own while one is left out.

### Buttons
Soft pills, with the dark primary kept for the one exit.
- **Shape:** full pill, 30px tall (26px small), `sunk` fill, no border, 12px/500.
- **Primary:** Copy Proposal only: `primary` fill, `on-primary` text, 40px tall, 13px/600. Hover brightens in light (1.3) and dims in dark (0.92).
- **Hover / Focus:** hover fills `sunk-hover`; focus is a 2px `lilac-line` outline at 2px offset on every focusable element. Disabled drops to 45% opacity.
- **Back:** a 28px round button on the warm sheet colour, the arrow only.
- **Reset:** a small pill in the top-right corner of a prop's card; on a switch row, round and icon-only.
- **Link:** 500 12px `lilac-ink`, underlined at a 3px offset; for Widen, Narrow and "keep" actions.

### Prop cards (option tables)
The panel's core: one card per prop.
- **Head:** the delta (when overridden), the prop's name in the title style, then on the right its counts at a scope ("SAME ON ALL 4", annotation style) and its Reset pill.
- **Change line:** under an Override, `"ghost" → "outline"` in 11.5px mono, the new value in `lilac-ink` at 600, and "from All in MemberRowMenu" when the value comes from a wider scope.
- **Table:** cells 30px tall on 1px `rule` hairlines inside a 12px-cornered table; four or fewer options run on one line, more run three across with the last spanning its line. The chosen cell is `lilac`; the app's own value, once overridden, is dotted under; at a scope each cell carries a small count of the Instances showing it.
- **Text field:** a white field with a 1px `rule` border and 12px corners; focus turns the edge `lilac-line` with a 3px soft lilac ring; an overridden field keeps the `lilac-line` edge.

### Switches
True/false props share one card, a row each on `rule-soft` lines: the name, TRUE or FALSE in the annotation style, and a 40 × 22px switch, `switch-off` at rest and `switch-on` (teal) when true, its white thumb sliding 18px over 180ms. At a scope whose Instances differ, the counts replace TRUE or FALSE.

### Identity card
The selection by what it shows: the back button, the component name with its verdict chip (green "Supported", or neutral "Inspect only"), its deltas at the right; the Instance's visible name as the headline; its call site in mono; then only the exceptions (tags, the scopes acting on it, crumbs to the Instances around it, Hold open and Reset this Instance).

### Revision marks (signature)
The numbered delta that ties a change together.
- **In the panel:** a 22 × 20px delta before the prop's name, in the change list, and in the footer as 28px round hit targets that each select what their change reaches (up to 8, then "+N").
- **On the page:** no number. As a change lands (a new value, under a new number or the same one), every Instance it reaches is outlined, the selected one solid, the others dashed `page-line`; after 2 seconds the outlines fade, the selection's too, and the page shows the change as it will ship. They come back for 2 seconds when an Instance a change reaches is selected, and for as long as the pointer is on the change's row in the change list, its footer delta, or a row naming the Instance. Drawn only where the Instance is actually visible (not under a menu, dialog or the panel).
- **Motion:** the delta settles in over 180ms from 60% scale on `cubic-bezier(0.16, 1, 0.3, 1)`. A change's outlines fade in over 160ms and step back over 480ms. Reduced motion removes all three.

### On-page outline
After an element picker's outlines (the designer's reference, 2026-11-20). The selected Instance: a 2px solid `page-ink` outline standing 3px off its box, 8px corners and a white halo, and on its top right a `page-ink` tag in 11px mono with its component and size, "Button · 32 × 32" (under the outline near the top of the window). At Select multiple every other Instance reached is a 1.5px dashed `page-line` outline with no tag; left-out ones are dashed grey. It stays until a change lands on the Instance; then it steps back with the change's outlines (Revision marks).

### Hide marks
To judge the page with nothing on it, before any change has landed too. The eye on the band takes off the page the selection's outlines and tag and a change's outlines, even in the moment they show. The selection, the panel and its deltas stay, so editing goes on. What follows the pointer still shows: a hovered row's outline and, while a select tool is armed, the pick's preview and tag. Pressed, the tool carries the `band-pressed` wash and the struck-through eye, and the lilac strip says "Outlines are hidden on the page". Pressed again, the outlines come back. Kept until the page reloads, never stored.

### Component list
With nothing selected: a "Changes" card (each change by its delta, the change in mono, where it applies), then "On this page", a card of 42px rows on `rule-soft` lines: the component name at 500, `×N` in tabular mono, a status chip only where something is exceptional, and a chevron that turns 90° when the group opens onto its Instances.

### Notices and status
- **Status strip:** `lilac` fill, 14px corners, 12px text, `kbd` keys on a faint wash.
- **Warn strip:** amber wash, amber text and dot, 12px corners.
- **Notice:** the warm sheet colour inside a card, 12px corners, code in mono 600.
- **Tags and chips:** `sunk` pills, 11px muted (chips in 10px mono); stale ones amber; held ones a pencil ring.
- **Dots:** 8px (6px small): `lilac-line` for Overrides, alert orange for failures, amber for warnings, a pencil ring for held, `rule` for none.

### Copy Proposal dialog
A 440px sheet with 24px corners and 6px inset, its sections white cards with 18px corners, over the dialog shadow. The title in the headline style, count tiles in the figure style, fields with 12px corners, actions right-aligned.

### Undo
Reset all acts immediately; the footer then offers "Reset N Overrides · Undo" for 8 seconds on its own line. One offer at a time.

## Do's and Don'ts

### Do:
- **Do** mark every change with its numbered delta, the same number on its card, in the change list, in the footer and in the Proposal; keep numbers off the page.
- **Do** keep lilac to two jobs: `lilac` fill for what is chosen, `lilac-line` and `lilac-ink` for what was revised.
- **Do** give each prop with options its own card and lay its options out as one hairline table; put true/false props together in one card of switches.
- **Do** choose the scope with the header's select tools, and keep the widen-to-page link in the selection card.
- **Do** separate the sheet from the product with the 8px float, the `edge` outline and the sheet shadow, and separate cards by tone alone.
- **Do** put values, call sites and commands in system mono, and everything a designer reads in system sans.
- **Do** use tabular figures for every count and delta number.
- **Do** declare every panel colour as a token on the shadow host with a dark counterpart; draw outlines and tags on the page with the fixed page values.
- **Do** keep motion to the delta's settle, a change's outlines fading in and stepping back, and the switch's thumb, and drop it under reduced motion.

### Don't:
- **Don't** use red anywhere in the panel; failures are alert orange, warnings amber.
- **Don't** add a second accent colour for brand, selection or emphasis.
- **Don't** put a scope control in the middle of the panel.
- **Don't** give cards a shadow or a border, or nest a card inside a card.
- **Don't** put a status chip on every row; only the exceptions get one.
- **Don't** load a web font into the shadow root or reach for a display face; the system stacks are the type system.
- **Don't** let any panel style reach the host page, or any host style reach the panel.
- **Don't** cover the product: no layout that hides the inspected page while the column fits.
