// The workbench's dev server (ADR 0011): a plain Vite page in the package, with the build's
// own React Compiler and JSX settings, so a primitive draws here as it does in `dist`, and
// React Refresh and the stylesheet swapped in place, so an edit keeps the page's state
// (`vite.ts`). `pnpm --filter @loupe/ui dev`. Never built, never shipped.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { reactCompiler } from "../vite.config.js";
import { workbenchConfig } from "./vite.js";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  workbenchConfig({
    root,
    compiler: reactCompiler(),
    stylesheet: join(root, "stylesheet.ts"),
    // Off the fixture's 3100 and the other worktrees' 3101.
    port: 3200,
  }),
);
