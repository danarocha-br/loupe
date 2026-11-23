// The toolbar's primitives (ADR 0003, DESIGN.md "Layers"). Each lives in its own folder:
// the component, its CSS, its tests and a `.md` of its states, ARIA and keys.
//
// The import rule: this folder imports nothing from the rest of the toolbar
// (`panel-view/`, `runtime/`, the views), so it can become a package by moving it;
// nothing outside it imports UI SDK. `src/toolbar/ui/layers.test.ts` holds both.

import { CHIP_GROUP_CSS } from "./chip-group/chip-group.js";

export { Chip, ChipGroup, type ChipGroupProps, type ChipProps } from "./chip-group/chip-group.js";

/** Every primitive's CSS, in order: the stylesheet's `primitives` layer. */
export const PRIMITIVES_CSS: string = [CHIP_GROUP_CSS].join("\n");
