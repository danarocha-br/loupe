import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAdaptList } from "./adapt-list.js";
import { createResolver, matchPaths, stripJsonc } from "./resolve.js";
import { transform } from "./transform.js";

const repo = realpathSync(path.resolve(fileURLToPath(import.meta.url), "../../../.."));
const fixture = (...parts: string[]) => path.join(repo, "fixture", ...parts);

function tree(files: Record<string, string>): string {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-resolve-")));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

describe("resolve on the fixture", () => {
  const { resolve, isClientModule } = createResolver();
  const page = fixture("app/app/page.tsx");

  it("resolves @/ through the app's tsconfig paths", () => {
    expect(resolve("@/components/product/member-row-menu", page)).toBe(
      fixture("app/components/product/member-row-menu.tsx"),
    );
  });

  it("resolves the design system from the app and from inside itself", () => {
    expect(resolve("@fixture/design-system/components/ui/button", page)).toBe(
      fixture("design-system/components/ui/button.tsx"),
    );
    expect(
      resolve(
        "@fixture/design-system/components/ui/button",
        fixture("design-system/components/ui/alert-dialog.tsx"),
      ),
    ).toBe(fixture("design-system/components/ui/button.tsx"));
  });

  it("resolves relative specifiers and packages", () => {
    expect(resolve("./members", page)).toBe(fixture("app/app/members.ts"));
    expect(resolve("react", page)).toMatch(/node_modules/);
    expect(resolve("./missing", page)).toBeNull();
  });

  it("reads the 'use client' directive", () => {
    expect(isClientModule(fixture("app/components/product/member-row-menu.tsx"))).toBe(true);
    expect(isClientModule(fixture("design-system/components/ui/button.tsx"))).toBe(false);
    expect(isClientModule(fixture("design-system/components/ui/alert-dialog.tsx"))).toBe(true);
  });
});

describe("resolve: tsconfig shapes from orbix-ai", () => {
  it("prefers the most specific paths key, follows package extends and reads JSONC", () => {
    const dir = tree({
      "node_modules/@repo/typescript-config/package.json": '{ "name": "@repo/typescript-config" }',
      "node_modules/@repo/typescript-config/nextjs.json": `{
        // comments and trailing commas, and "/*" inside strings
        "compilerOptions": { "paths": { "@/*": ["./*"], }, },
      }`,
      "apps/app/tsconfig.json": `{
        "extends": "@repo/typescript-config/nextjs.json",
        "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"], "@repo/*": ["../../packages/*"] } }
      }`,
      "apps/app/app/page.tsx": "",
      "apps/app/lib/util.ts": "",
      "packages/design-system/tsconfig.json": `{
        "compilerOptions": { "baseUrl": ".", "paths": { "@repo/*": ["../*"], "@repo/design-system/*": ["./*"] } }
      }`,
      "packages/design-system/components/ui/button.tsx": "",
      "packages/design-system/components/ui/sidebar.tsx": "",
      "packages/design-system/components/ui/index.ts": "",
    });
    const { resolve } = createResolver();
    const page = path.join(dir, "apps/app/app/page.tsx");
    const sidebar = path.join(dir, "packages/design-system/components/ui/sidebar.tsx");

    expect(resolve("@/lib/util", page)).toBe(path.join(dir, "apps/app/lib/util.ts"));
    expect(resolve("@repo/design-system/components/ui/button", page)).toBe(
      path.join(dir, "packages/design-system/components/ui/button.tsx"),
    );
    expect(resolve("@repo/design-system/components/ui/button", sidebar)).toBe(
      path.join(dir, "packages/design-system/components/ui/button.tsx"),
    );
    expect(resolve("@repo/design-system/components/ui", sidebar)).toBe(
      path.join(dir, "packages/design-system/components/ui/index.ts"),
    );
  });

  it("inherits paths from an extended config relative to that config", () => {
    const dir = tree({
      "tsconfig.base.json": '{ "compilerOptions": { "paths": { "~/*": ["./src/*"] } } }',
      "app/tsconfig.json": '{ "extends": "../tsconfig.base.json" }',
      "app/page.tsx": "",
      "src/thing.tsx": "",
    });
    expect(createResolver().resolve("~/thing", path.join(dir, "app/page.tsx"))).toBe(
      path.join(dir, "src/thing.tsx"),
    );
  });

  it("follows a package's exports map", () => {
    const dir = tree({
      "node_modules/ui/package.json": JSON.stringify({
        name: "ui",
        exports: { "./components/*": { types: "./types/*.d.ts", default: "./src/*.tsx" } },
      }),
      "node_modules/ui/src/card.tsx": "",
      "page.tsx": "",
    });
    expect(createResolver().resolve("ui/components/card", path.join(dir, "page.tsx"))).toBe(
      path.join(dir, "node_modules/ui/src/card.tsx"),
    );
  });

  it("matchPaths and stripJsonc", () => {
    expect(matchPaths({ "@repo/*": ["../*"], "@repo/ds/*": ["./*"] }, "@repo/ds/button")).toEqual([
      "./button",
    ]);
    expect(matchPaths({ "@/*": ["./*"] }, "react")).toEqual([]);
    expect(JSON.parse(stripJsonc('{ "a": "//not a comment /*", /* c */ "b": [1,], }'))).toEqual({
      a: "//not a comment /*",
      b: [1],
    });
  });
});

describe("transform with the real resolver, on the fixture", () => {
  it("anchors and swaps the fixture's product component as the loader would", () => {
    const resolver = createResolver();
    const file = fixture("app/components/product/member-row-menu.tsx");
    const adaptList = parseAdaptList(
      JSON.stringify({
        formatVersion: 1,
        designSystem: ["fixture/design-system"],
        app: ["fixture/app"],
        modules: {
          "fixture/design-system/components/ui/button.tsx": {
            adapter: "@/loupe/adapters/ds/ui/button",
            adapted: ["Button"],
          },
        },
      }),
    );
    const { code, callSites } = transform(readFileSync(file, "utf8"), file, {
      root: repo,
      adaptList,
      layerDir: fixture("app/loupe"),
      ...resolver,
    });
    expect(code).toContain('import { Button } from "@/loupe/adapters/ds/ui/button";');
    expect(callSites.map((site) => `${site.id} ${site.adapted ? "adapted" : "anchored"}`)).toEqual([
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenu[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuTrigger[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › Button[1] adapted",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuContent[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[2] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialog[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialogContent[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialogTitle[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialogDescription[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialogFooter[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialogCancel[1] anchored",
      "fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › AlertDialogAction[1] anchored",
    ]);
  });
});
