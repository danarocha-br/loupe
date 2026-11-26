// The patterns' workbench's dev server (ADR 0012): a plain Vite page in the package, with the
// build's own React Compiler and JSX settings, so a pattern draws here as it does in `dist`,
// and `@loupe/ui`'s React Refresh and stylesheet swapped in place, so an edit keeps the
// page's state (`@loupe/ui/workbench/vite`). `pnpm --filter @loupe/patterns dev`. Never
// built, never shipped. The `dev` script loads this file with `--configLoader runner`: Vite's
// own module runner, not Node, reads `@loupe/ui`'s config, which is TypeScript in a linked
// package that Node would load untransformed.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { workbenchConfig } from "@loupe/ui/workbench/vite";
import { defineConfig } from "vite";
import { reactCompiler } from "../vite.config.js";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  workbenchConfig({
    root,
    compiler: reactCompiler(),
    // Beside @loupe/ui's 3200; off the fixture's 3100, the other worktrees' 3101 and the visual check's 3300, 3310 and 3320.
    port: 3201,
  }),
);
