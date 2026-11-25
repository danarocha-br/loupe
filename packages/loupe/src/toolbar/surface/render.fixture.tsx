// The test host for the Toolbar's layers: the design system's (`@loupe/ui/testing`), bound
// to the Toolbar's stylesheet, so a pattern draws under the same sheet as in the Toolbar.

import type { ReactNode } from "react";
import { type Rendered, renderInSurface as renderInSystem } from "@loupe/ui/testing";
import { STYLESHEET, type Theme } from "./index.js";

export { axeViolations, cleanup, type Rendered } from "@loupe/ui/testing";

/** Draws `ui` in a surface under `STYLESHEET`; `cleanup()` (or `unmount()`) takes it away. */
export function renderInSurface(ui: ReactNode, { theme = "light" }: { theme?: Theme } = {}): Rendered {
  return renderInSystem(ui, { theme, stylesheet: STYLESHEET });
}
