// The patterns' own workbench (ADR 0012): every pattern in each of its states with its sample
// data, light and dark side by side, inside the real shadow-root surface under the Toolbar's
// stylesheet, with its `.md` beside it, drawn in `@loupe/ui`'s workbench shell. `pnpm --filter
// @loupe/patterns dev` serves it; nothing here ships, and nothing here imports Loupe
// (`src/boundary.test.ts`).

import { mountWorkbench } from "@loupe/ui/workbench";
import { PATTERNS } from "./patterns.js";
import { WORKBENCH_STYLESHEET } from "./stylesheet.js";

mountWorkbench({
  title: "@loupe/patterns",
  intro: "Every pattern in each of its states, with its sample data, light and dark, inside the real surface.",
  nav: "Patterns",
  pages: PATTERNS,
  stylesheet: WORKBENCH_STYLESHEET,
  folder: "packages/patterns/src/",
  storage: "loupe-patterns-workbench",
});
