// Every pattern's CSS, as strings: the stylesheet's `patterns` layer (`stylesheet.ts`). A module of
// its own, as `@loupe/ui`'s `styles.ts` is, so the collapsed pill, which adopts the stylesheet, loads
// the strings and never a pattern's component.

import CHANGE_LIST_CSS from "./change-list/change-list.css?inline";
import COMMAND_CSS from "./command/command.css?inline";
import COPY_FLOW_CSS from "./copy-flow/copy-flow.css?inline";
import FLAGS_CARD_CSS from "./flags-card/flags-card.css?inline";
import FOOTER_CSS from "./footer/footer.css?inline";
import GROUP_ROW_CSS from "./group-row/group-row.css?inline";
import HEADER_CSS from "./header/header.css?inline";
import HELD_FOR_REVIEW_CSS from "./held-for-review/held-for-review.css?inline";
import IDENTITY_CSS from "./identity/identity.css?inline";
import INSPECT_ONLY_CSS from "./inspect-only/inspect-only.css?inline";
import INTERACTION_CSS from "./interaction/interaction.css?inline";
import LAUNCHER_CSS from "./launcher/launcher.css?inline";
import LEGEND_CSS from "./legend/legend.css?inline";
import MARKS_CSS from "./marks/marks.css?inline";
import NO_GROUP_CSS from "./no-group/no-group.css?inline";
import NOTICE_CSS from "./notice/notice.css?inline";
import ON_THIS_PAGE_CSS from "./on-this-page/on-this-page.css?inline";
import PAGE_MAP_CSS from "./page-map/page-map.css?inline";
import PAGE_MARKS_CSS from "./page-marks/page-marks.css?inline";
import PROP_ROW_CSS from "./prop-row/prop-row.css?inline";
import SCOPE_SECTION_CSS from "./scope-section/scope-section.css?inline";
import SHEET_CSS from "./sheet/sheet.css?inline";
import SITE_CARD_CSS from "./site-card/site-card.css?inline";
import START_CARD_CSS from "./start-card/start-card.css?inline";

/**
 * Every pattern's CSS, in order: the marks they share, the chrome (the pill, the sheet, its
 * header, footer and Copy Proposal), the notices, the Inspector's, the list's, and last the
 * page's marks, which draw over the app.
 */
export const PATTERNS_CSS: string = [
  MARKS_CSS,
  LAUNCHER_CSS,
  SHEET_CSS,
  HEADER_CSS,
  FOOTER_CSS,
  COPY_FLOW_CSS,
  COMMAND_CSS,
  NOTICE_CSS,
  IDENTITY_CSS,
  NO_GROUP_CSS,
  SCOPE_SECTION_CSS,
  PROP_ROW_CSS,
  LEGEND_CSS,
  INSPECT_ONLY_CSS,
  START_CARD_CSS,
  CHANGE_LIST_CSS,
  HELD_FOR_REVIEW_CSS,
  ON_THIS_PAGE_CSS,
  PAGE_MAP_CSS,
  GROUP_ROW_CSS,
  SITE_CARD_CSS,
  INTERACTION_CSS,
  FLAGS_CARD_CSS,
  PAGE_MARKS_CSS,
].join("\n");
