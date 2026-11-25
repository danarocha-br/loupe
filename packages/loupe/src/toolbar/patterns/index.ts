// The toolbar's patterns (ADR 0003, DESIGN.md "Layers"): primitives composed, taking
// panel-view's types. Each lives in its own folder: the component, its CSS in the
// stylesheet's `patterns` layer, its tests and a `.md`.
//
// The import rule: a pattern imports only `@loupe/ui` (the primitives and the tokens),
// other patterns and `panel-view`'s types (never a value from it), and draws the words
// panel-view decided; it builds none, and makes no write: its callbacks do, in the view.
// `@loupe/ui` imports nothing from Loupe, a pattern least of all.
// `src/toolbar/layers.test.ts` and `@loupe/ui`'s `boundary.test.ts` hold both.

export { ChangeList, type ChangeListProps } from "./change-list/change-list.js";
export { CommandLine, type CommandLineProps } from "./command/command.js";
export {
  CopySplit,
  type CopySplitProps,
  type CopyState,
  CopyToast,
  type CopyToastProps,
  DetailsForm,
  type DetailsFormProps,
  NotCopied,
  type NotCopiedProps,
} from "./copy-flow/copy-flow.js";
export { FlagRow, type FlagRowProps, FlagsCard, type FlagsCardProps } from "./flags-card/flags-card.js";
export { PanelFooter, type PanelFooterProps } from "./footer/footer.js";
export { GroupRow, type GroupRowProps } from "./group-row/group-row.js";
export { PanelHeader, type PanelHeaderProps, StatusStrip, type StatusStripProps } from "./header/header.js";
export { HeldForReview, type HeldForReviewProps } from "./held-for-review/held-for-review.js";
export { Identity, type IdentityProps } from "./identity/identity.js";
export { InspectOnly, type InspectOnlyProps } from "./inspect-only/inspect-only.js";
export { AppearsOnInteraction, type AppearsOnInteractionProps } from "./interaction/interaction.js";
export { Legend, type LegendProps } from "./legend/legend.js";
export { Breakable, ChangeKey, DotTitle, HeldKey, HeldValues, hovering, Keys, Meta, type Status, StatusChip, TagChip } from "./marks/marks.js";
export { NoGroup, type NoGroupProps } from "./no-group/no-group.js";
export { InstanceNote, type InstanceNoteProps, Notice, type NoticeProps } from "./notice/notice.js";
export { OnThisPage, type OnThisPageProps } from "./on-this-page/on-this-page.js";
export {
  ChangeOutline,
  type ChangeOutlineProps,
  type OutlineBox,
  type OutlineKind,
  PageOutline,
  type PageOutlineProps,
  PickTag,
  type PickTagProps,
  type SizeTag,
} from "./page-marks/page-marks.js";
export { type MapBox, PageMap, type PageMapProps, stepFrom } from "./page-map/page-map.js";
export { PropRow, type PropRowProps } from "./prop-row/prop-row.js";
export { METER_MAX, ScopeMoveButton, ScopeSection, type ScopeSectionProps } from "./scope-section/scope-section.js";
export { Sheet, type SheetProps } from "./sheet/sheet.js";
export { SiteCard, type SiteCardProps } from "./site-card/site-card.js";
export { StartCard, type StartCardProps, ToolPreview } from "./start-card/start-card.js";
// The pill (LauncherPill) is not here: it is imported by its own path, `./launcher/launcher.js`,
// so the collapsed Toolbar loads no other pattern. Its CSS is `./styles.js`'s, with every pattern's.
// The CSS is `./styles.js`'s, apart, so the collapsed pill loads none of the components.
export { PATTERNS_CSS } from "./styles.js";
