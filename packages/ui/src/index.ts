// Loupe's primitives (ADR 0003, 0010; Loupe's DESIGN.md "Layers"). Each lives in its own
// folder: the component, its CSS, its tests and a `.md` of its states, ARIA and keys.
//
// The package boundary: nothing here imports Loupe, only this package, React and UI SDK
// (`boundary.test.ts`); nothing in Loupe imports UI SDK, only this package's entries
// (Loupe's `src/toolbar/layers.test.ts`).

export { type Announce, type AnnounceOptions, Announcer, type Politeness, useAnnounce, useAnnounceChange } from "./announcer/announcer.js";
export { Button, type ButtonLook, type ButtonProps, type ButtonSize, lookAttributes } from "./button/button.js";
export { Card, CardHead, type CardHeadProps, type CardLook, type CardProps } from "./card/card.js";
export { Chip, ChipGroup, type ChipGroupProps, type ChipProps } from "./chip-group/chip-group.js";
export { Delta, type DeltaProps } from "./delta/delta.js";
export { Dot, type DotProps, type DotTone } from "./dot/dot.js";
export { Field, type FieldLook, type FieldProps, focusField } from "./field/field.js";
export { Fold, FoldChevron, FoldPanel, type FoldPanelProps, type FoldProps, FoldTrigger, type FoldTriggerProps } from "./fold/fold.js";
export * from "./icon/icon.js";
export { Kbd, type KbdProps } from "./kbd/kbd.js";
export { Popover, type PopoverCaret, PopoverPanel, type PopoverPanelProps, type PopoverProps } from "./popover/popover.js";
export { Row, RowAction, RowLine, type RowLook, RowName, type RowNameProps, type RowProps, RowValue } from "./row/row.js";
export { Switch, type SwitchProps } from "./switch/switch.js";
export { Tag, type TagLook, type TagProps } from "./tag/tag.js";
export { Toggle, type ToggleProps } from "./toggle/toggle.js";
// The CSS is `./styles.js`'s, apart, so the collapsed pill loads none of the components.
export { PRIMITIVES_CSS } from "./styles.js";
