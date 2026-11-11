import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

export type Files = Record<string, string | object | null>;

// A pnpm workspace shaped like orbix-ai: one App Router app on Next 16.3 that
// depends on a shadcn-on-Base-UI design system kept as a workspace package.
export const supportedRepo: Files = {
  "package.json": { name: "root", private: true },
  "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n",
  "apps/web/package.json": {
    name: "web",
    scripts: { dev: "next dev -p 3000" },
    dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*" },
  },
  "apps/web/tsconfig.json": {},
  "apps/web/app/page.tsx":
    'import { Button } from "@repo/design-system/components/ui/button";\n',
  "apps/web/node_modules/next/package.json": { name: "next", version: "16.3.6" },
  "apps/web/node_modules/next/dist/compiled/react/cjs/react.development.js":
    'exports.version = "19.3.0-canary-cbb046ab-20260731";\n',
  "packages/design-system/package.json": {
    name: "@repo/design-system",
    dependencies: { "@base-ui/react": "^1.6.0", "class-variance-authority": "^0.7.1" },
  },
  "packages/design-system/components.json": {
    aliases: { ui: "@repo/design-system/components/ui" },
  },
  "packages/design-system/components/ui/button.tsx": "export function Button() {}\n",
};

/** Writes `files` over `base` into a fresh temp dir. `null` deletes a path from `base`. */
export function makeRepo(files: Files = {}, base: Files = supportedRepo): string {
  const root = mkdtempSync(join(tmpdir(), "loupe-compat-"));
  for (const [path, content] of Object.entries({ ...base, ...files })) {
    if (content === null) continue;
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    );
  }
  return root;
}

/** Every file under `root` with its contents, to prove a run wrote nothing. */
export function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[relative(root, full)] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return out;
}
