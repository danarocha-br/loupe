// Every primitive's CSS, as strings: the stylesheet's `primitives` layer (surface/).
// A module of its own so the collapsed pill, which adopts the stylesheet, loads the
// strings and never a primitive's component or UI SDK (the panel's chunk has those).

import ANNOUNCER_CSS from "./announcer/announcer.css?inline";
import BUTTON_CSS from "./button/button.css?inline";
import CARD_CSS from "./card/card.css?inline";
import CHIP_GROUP_CSS from "./chip-group/chip-group.css?inline";
import DELTA_CSS from "./delta/delta.css?inline";
import DOT_CSS from "./dot/dot.css?inline";
import FIELD_CSS from "./field/field.css?inline";
import FOLD_CSS from "./fold/fold.css?inline";
import KBD_CSS from "./kbd/kbd.css?inline";
import POPOVER_CSS from "./popover/popover.css?inline";
import ROW_CSS from "./row/row.css?inline";
import SWITCH_CSS from "./switch/switch.css?inline";
import TAG_CSS from "./tag/tag.css?inline";
import TOGGLE_CSS from "./toggle/toggle.css?inline";

/** Every primitive's CSS, in order. */
export const PRIMITIVES_CSS: string = [ANNOUNCER_CSS, CARD_CSS, ROW_CSS, BUTTON_CSS, TOGGLE_CSS, CHIP_GROUP_CSS, FOLD_CSS, SWITCH_CSS, FIELD_CSS, POPOVER_CSS, TAG_CSS, DOT_CSS, DELTA_CSS, KBD_CSS].join("\n");
