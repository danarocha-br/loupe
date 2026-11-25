// Every primitive the workbench draws: its folder in `src/`, its name, its `.md` (states,
// ARIA and keys) and its states. `primitives.test.tsx` fails when a folder with a `.md` has
// no entry here, so a new primitive comes with its workbench page.

import ANNOUNCER_MD from "../src/announcer/announcer.md?raw";
import BUTTON_MD from "../src/button/button.md?raw";
import CARD_MD from "../src/card/card.md?raw";
import CHIP_GROUP_MD from "../src/chip-group/chip-group.md?raw";
import DELTA_MD from "../src/delta/delta.md?raw";
import DOT_MD from "../src/dot/dot.md?raw";
import FIELD_MD from "../src/field/field.md?raw";
import FOLD_MD from "../src/fold/fold.md?raw";
import ICON_MD from "../src/icon/icon.md?raw";
import KBD_MD from "../src/kbd/kbd.md?raw";
import POPOVER_MD from "../src/popover/popover.md?raw";
import ROW_MD from "../src/row/row.md?raw";
import SWITCH_MD from "../src/switch/switch.md?raw";
import TAG_MD from "../src/tag/tag.md?raw";
import TOGGLE_MD from "../src/toggle/toggle.md?raw";
import { AnnouncerStates } from "./states/announcer.js";
import { ButtonStates } from "./states/button.js";
import { CardStates } from "./states/card.js";
import { ChipGroupStates } from "./states/chip-group.js";
import { DeltaStates } from "./states/delta.js";
import { DotStates } from "./states/dot.js";
import { FieldStates } from "./states/field.js";
import { FoldStates } from "./states/fold.js";
import { IconStates } from "./states/icon.js";
import { KbdStates } from "./states/kbd.js";
import { PopoverStates } from "./states/popover.js";
import { RowStates } from "./states/row.js";
import { SwitchStates } from "./states/switch.js";
import { TagStates } from "./states/tag.js";
import { ToggleStates } from "./states/toggle.js";
import type { Page } from "./shell/index.js";

/** A primitive's page: its folder in `src/` (`#chip-group`), its name, its `.md` and its states. */
export type Primitive = Page;

/** In the order DESIGN.md's Layers lists them: the controls, the marks, the surfaces, the icons, the announcer. */
export const PRIMITIVES: Primitive[] = [
  { id: "chip-group", name: "ChipGroup", doc: CHIP_GROUP_MD, States: ChipGroupStates },
  { id: "fold", name: "Fold", doc: FOLD_MD, States: FoldStates },
  { id: "button", name: "Button", doc: BUTTON_MD, States: ButtonStates },
  { id: "toggle", name: "Toggle", doc: TOGGLE_MD, States: ToggleStates },
  { id: "switch", name: "Switch", doc: SWITCH_MD, States: SwitchStates },
  { id: "field", name: "Field", doc: FIELD_MD, States: FieldStates },
  { id: "popover", name: "Popover", doc: POPOVER_MD, States: PopoverStates },
  { id: "tag", name: "Tag", doc: TAG_MD, States: TagStates },
  { id: "dot", name: "Dot", doc: DOT_MD, States: DotStates },
  { id: "delta", name: "Delta", doc: DELTA_MD, States: DeltaStates },
  { id: "kbd", name: "Kbd", doc: KBD_MD, States: KbdStates },
  { id: "card", name: "Card", doc: CARD_MD, States: CardStates, bare: true },
  { id: "row", name: "Row", doc: ROW_MD, States: RowStates, bare: true },
  { id: "icon", name: "Icon", doc: ICON_MD, States: IconStates },
  { id: "announcer", name: "Announcer", doc: ANNOUNCER_MD, States: AnnouncerStates },
];
