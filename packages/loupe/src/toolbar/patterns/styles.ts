// Every pattern's CSS, as strings: the stylesheet's `patterns` layer (surface/). A module of
// its own, as `ui/styles.ts` is, so the collapsed pill, which adopts the stylesheet, loads
// the strings and never a pattern's component.

import IDENTITY_CSS from "./identity/identity.css?inline";
import MARKS_CSS from "./marks/marks.css?inline";
import PROP_ROW_CSS from "./prop-row/prop-row.css?inline";
import SCOPE_SECTION_CSS from "./scope-section/scope-section.css?inline";

/** Every pattern's CSS, in order. */
export const PATTERNS_CSS: string = [MARKS_CSS, IDENTITY_CSS, SCOPE_SECTION_CSS, PROP_ROW_CSS].join("\n");
