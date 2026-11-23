// The toolbar's primitives (ADR 0003, DESIGN.md "Layers"). Each lives in its own folder:
// the component, its CSS, its tests and a `.md` of its states, ARIA and keys.
//
// The import rule: this folder imports nothing from the rest of the toolbar
// (`panel-view/`, `runtime/`, the views), so it can become a package by moving it;
// nothing outside it imports UI SDK. `src/toolbar/ui/layers.test.ts` holds both.

export { Chip, ChipGroup, type ChipGroupProps, type ChipProps } from "./chip-group/chip-group.js";
// The CSS is `./styles.js`'s, apart, so the collapsed pill loads none of the components.
export { PRIMITIVES_CSS } from "./styles.js";
