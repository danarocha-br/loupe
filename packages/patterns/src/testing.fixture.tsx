// `@loupe/patterns/testing` (ADR 0012): the test host the patterns draw in, the design system's
// (`@loupe/ui/testing`) bound to the package's `STYLESHEET`, so a pattern draws under the same
// sheet as in the Toolbar; and the sample data in the contract's types, words spelled out
// (`samples.ts`), which the patterns' tests, Loupe's and the workbench draw. Never shipped.

import type { ReactNode } from "react";
import type { Theme } from "@loupe/ui/surface";
import { type Rendered, renderInSurface as renderInSystem } from "@loupe/ui/testing";
import { STYLESHEET } from "./stylesheet.js";

export { axeViolations, cleanup, type Rendered } from "@loupe/ui/testing";
export * from "./samples.js";

/** Draws `ui` in a surface under `STYLESHEET`; `cleanup()` (or `unmount()`) takes it away. */
export function renderInSurface(ui: ReactNode, { theme = "light" }: { theme?: Theme } = {}): Rendered {
  return renderInSystem(ui, { theme, stylesheet: STYLESHEET });
}
