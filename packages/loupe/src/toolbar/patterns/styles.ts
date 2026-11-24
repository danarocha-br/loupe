// Every pattern's CSS, as strings: the stylesheet's `patterns` layer (surface/). A module of
// its own, as `ui/styles.ts` is, so the collapsed pill, which adopts the stylesheet, loads
// the strings and never a pattern's component.

import GROUP_ROW_CSS from "./group-row/group-row.css?inline";
import HELD_FOR_REVIEW_CSS from "./held-for-review/held-for-review.css?inline";
import IDENTITY_CSS from "./identity/identity.css?inline";
import INTERACTION_CSS from "./interaction/interaction.css?inline";
import MARKS_CSS from "./marks/marks.css?inline";
import ON_THIS_PAGE_CSS from "./on-this-page/on-this-page.css?inline";
import PAGE_MAP_CSS from "./page-map/page-map.css?inline";
import PROP_ROW_CSS from "./prop-row/prop-row.css?inline";
import SCOPE_SECTION_CSS from "./scope-section/scope-section.css?inline";
import SITE_CARD_CSS from "./site-card/site-card.css?inline";
import START_CARD_CSS from "./start-card/start-card.css?inline";

/** Every pattern's CSS, in order: the marks they share, the Inspector's, then the list's. */
export const PATTERNS_CSS: string = [
  MARKS_CSS,
  IDENTITY_CSS,
  SCOPE_SECTION_CSS,
  PROP_ROW_CSS,
  START_CARD_CSS,
  HELD_FOR_REVIEW_CSS,
  ON_THIS_PAGE_CSS,
  PAGE_MAP_CSS,
  GROUP_ROW_CSS,
  SITE_CARD_CSS,
  INTERACTION_CSS,
].join("\n");
