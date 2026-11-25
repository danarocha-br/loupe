// The stylesheet the workbench's surfaces adopt: the Toolbar's (`STYLESHEET`, `src/stylesheet.ts`),
// with the frames' layout after the patterns' CSS, in their layer, as `@loupe/ui`'s workbench
// puts its own in the layer a consumer's patterns take: the shell's, every workbench's
// (`FRAMES_CSS`), then this workbench's own (`frame.css`).

import { stylesheet } from "@loupe/ui/surface";
import { FRAMES_CSS } from "@loupe/ui/workbench";
import { PATTERNS_CSS } from "../src/styles.js";
import { PATTERN_PROPERTIES } from "../src/tokens.js";
import FRAME_CSS from "./frame.css?inline";

/** The frames' rules, after the patterns': the shell's, then this workbench's. */
export const WORKBENCH_CSS = `${FRAMES_CSS}\n${FRAME_CSS}`;

export const WORKBENCH_STYLESHEET: string = stylesheet(`${PATTERNS_CSS}\n${WORKBENCH_CSS}`, PATTERN_PROPERTIES);
