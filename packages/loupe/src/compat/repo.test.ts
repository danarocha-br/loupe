import { describe, expect, it } from "vitest";
import { devCommand, readWorkspace, workspacePackages } from "./repo.js";
import { makeRepo } from "./repo.fixture.js";

describe("reading pnpm-workspace.yaml", () => {
  it("keeps going past comments and blank lines, and normalises patterns", () => {
    const root = makeRepo({
      "pnpm-workspace.yaml": "packages:\n# apps\n  - ./apps/*\n\n  - 'packages/*/'\n",
    });
    expect(readWorkspace(root)).toEqual({ kind: "pnpm", patterns: ["apps/*", "packages/*"] });
  });

  it("expands globs inside a segment and in the middle of a path", () => {
    const root = makeRepo({
      "pnpm-workspace.yaml": "packages:\n  - packages/design-*\n  - services/*/web\n",
      "services/shop/web/package.json": { name: "shop-web" },
      "services/shop/api/package.json": { name: "shop-api" },
    });
    const dirs = workspacePackages(root, readWorkspace(root)).map((p) => p.dir);
    expect(dirs).toEqual(["packages/design-system", "services/shop/web"]);
  });
});

describe("finding next dev in the dev script", () => {
  it("follows a local script run through the package manager", () => {
    expect(devCommand({ dev: "pnpm dev:next", "dev:next": "next dev --turbopack" })).toEqual({
      script: "dev:next",
      runtime: "node",
      webpack: false,
    });
  });

  it("does not read --webpack-something as --webpack", () => {
    expect(devCommand({ dev: "next dev --webpack-stats" })?.webpack).toBe(false);
  });
});
