// The stylesheet the workbench's surfaces adopt: the system's, with the frames' layout as its
// top layer, where a consumer's patterns go: the shell's, every workbench's (`FRAMES_CSS`),
// then this workbench's own (`frame.css`).

import { stylesheet } from "../src/surface/index.js";
import FRAME_CSS from "./frame.css?inline";
import FRAMES_CSS from "./shell/frames.css?inline";

/** The top layer's rules: the shell's frames, then this workbench's. */
export const WORKBENCH_CSS = `${FRAMES_CSS}\n${FRAME_CSS}`;

export const WORKBENCH_STYLESHEET: string = stylesheet(WORKBENCH_CSS);
