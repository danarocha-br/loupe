// The stylesheet the workbench's surfaces adopt: the Toolbar's (`STYLESHEET`, `src/stylesheet.ts`),
// with the workbench's frame layout after the patterns' CSS, in their layer, as `@loupe/ui`'s
// workbench puts its own in the layer a consumer's patterns take.

import { stylesheet } from "@loupe/ui/surface";
import { PATTERNS_CSS } from "../src/styles.js";
import { PATTERN_PROPERTIES } from "../src/tokens.js";
import FRAME_CSS from "./frame.css?inline";

export const WORKBENCH_STYLESHEET: string = stylesheet(`${PATTERNS_CSS}\n${FRAME_CSS}`, PATTERN_PROPERTIES);
