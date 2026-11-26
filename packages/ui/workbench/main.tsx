// The design system's own workbench (ADR 0011): every primitive in each of its states, light
// and dark side by side, inside the real shadow-root surface, with its `.md` beside it, drawn
// in the workbench shell (`shell/`, `@loupe/ui/workbench`) the patterns' workbench shares (ADR
// 0012). `pnpm --filter @loupe/ui dev` serves it; nothing here ships, and nothing here imports
// Loupe (boundary.test.ts).

import { PRIMITIVES } from "./primitives.js";
import { mountWorkbench } from "./shell/index.js";
import { WORKBENCH_STYLESHEET } from "./stylesheet.js";

const draw = mountWorkbench({
  title: "@loupe/ui",
  intro: "Every primitive in each of its states, light and dark, inside the real surface.",
  nav: "Primitives",
  pages: PRIMITIVES,
  // The system's stylesheet with the workbench's frame layout as its top layer, where a consumer's patterns go.
  stylesheet: WORKBENCH_STYLESHEET,
  folder: "packages/ui/src/",
  storage: "loupe-ui-workbench",
});

// An edit of a primitive's states draws them again in place, the reader's settings and the page's state kept.
import.meta.hot?.accept("./primitives.js", (next) => {
  if (next) draw({ pages: next.PRIMITIVES as typeof PRIMITIVES });
});
