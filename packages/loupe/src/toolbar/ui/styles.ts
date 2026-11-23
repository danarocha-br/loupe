// Every primitive's CSS, as strings: the stylesheet's `primitives` layer (surface/).
// A module of its own so the collapsed pill, which adopts the stylesheet, loads the
// strings and never a primitive's component or UI SDK (the panel's chunk has those).

import CHIP_GROUP_CSS from "./chip-group/chip-group.css?inline";
import FOLD_CSS from "./fold/fold.css?inline";

/** Every primitive's CSS, in order. */
export const PRIMITIVES_CSS: string = [CHIP_GROUP_CSS, FOLD_CSS].join("\n");
