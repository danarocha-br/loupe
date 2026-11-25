// The patterns' workbench's dev server (ADR 0012): a plain Vite page in the package, with the
// build's own React Compiler and JSX settings, so a pattern draws here as it does in `dist`.
// `pnpm --filter @loupe/patterns dev`. Never built, never shipped.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { reactCompiler } from "../vite.config.js";

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  plugins: [reactCompiler()],
  oxc: { include: /\.[cm]?tsx?$/, jsx: { runtime: "automatic" } },
  // Beside @loupe/ui's 3200; off the fixture's 3100, the other worktrees' 3101 and the visual check's 3300, 3310 and 3320.
  server: { port: 3201 },
});
