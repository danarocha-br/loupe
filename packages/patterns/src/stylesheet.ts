// The one stylesheet every surface of the Toolbar adopts (ADR 0010, 0011, 0012), every rule in
// a layer: the system's ground, with the Toolbar's own tokens (`tokens.ts`) on the host after
// the system's, then the primitives, then the patterns' CSS (`styles.ts`). A module, and an
// entry (`@loupe/patterns/stylesheet`), of its own, so the collapsed pill, which adopts it,
// loads the strings and never a pattern's component.

import { stylesheet } from "@loupe/ui/surface";
import { PATTERNS_CSS } from "./styles.js";
import { PATTERN_PROPERTIES } from "./tokens.js";

/** The system's stylesheet with the patterns as its top layer and the Toolbar's own tokens on the host. */
export const STYLESHEET: string = stylesheet(PATTERNS_CSS, PATTERN_PROPERTIES);
