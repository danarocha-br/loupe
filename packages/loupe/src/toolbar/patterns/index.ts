// The toolbar's patterns (ADR 0003, DESIGN.md "Layers"): primitives composed, taking
// panel-view's types. Each lives in its own folder: the component, its CSS in the
// stylesheet's `patterns` layer, its tests and a `.md`.
//
// The import rule: a pattern imports only `ui/`, the tokens, other patterns and
// `panel-view`'s types (never a value from it), and draws the words panel-view decided; it
// builds none, and makes no write: its callbacks do, in the view. Nothing in `ui/` imports
// a pattern.
// `src/toolbar/ui/layers.test.ts` holds both.

export { Identity, type IdentityProps } from "./identity/identity.js";
export { Breakable, ChangeKey, HeldKey, Keys, type Status, StatusChip, TagChip } from "./marks/marks.js";
export { PropRow, type PropRowProps } from "./prop-row/prop-row.js";
export { METER_MAX, ScopeMoveButton, ScopeSection, type ScopeSectionProps } from "./scope-section/scope-section.js";
// The CSS is `./styles.js`'s, apart, so the collapsed pill loads none of the components.
export { PATTERNS_CSS } from "./styles.js";
