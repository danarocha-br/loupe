// The workbench's dev server (ADR 0011): a plain Vite page in the package, with the build's
// own React Compiler and JSX settings, so a primitive draws here as it does in `dist`.
// `pnpm --filter @loupe/ui dev`. Never built, never shipped.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { reactCompiler } from "../vite.config.js";

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  plugins: [reactCompiler()],
  oxc: { include: /\.[cm]?tsx?$/, jsx: { runtime: "automatic" } },
  // Off the fixture's 3100 and the other worktrees' 3101.
  server: { port: 3200 },
});
