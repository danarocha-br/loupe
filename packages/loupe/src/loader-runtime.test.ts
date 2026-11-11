import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runLoader } from "./loader-runtime.js";

const repo = realpathSync(path.resolve(fileURLToPath(import.meta.url), "../../../.."));
const adaptList = path.join(repo, "fixture/app/loupe/adapt-list.json");

describe("runLoader on the fixture", () => {
  it("transforms with the fixture's adapt list and reports what the output read", () => {
    const file = path.join(repo, "fixture/app/app/page.tsx");
    const { code, dependencies } = runLoader(readFileSync(file, "utf8"), file, {
      root: repo,
      adaptList,
    });
    expect(code).toContain('data-ds-anchor={"fixture/app/app/page.tsx › MembersPage › Button[1]"}');
    // page.tsx is a server file, so the swap depended on whether button.tsx is client.
    expect(code).toContain('from "@fixture/design-system/components/ui/button"');
    // MemberRowMenu is swapped too, because its target is a client module.
    expect(code).toContain('from "@/loupe/adapters/app/components/product/member-row-menu"');
    expect(dependencies).toEqual([
      adaptList,
      path.join(repo, "fixture/design-system/components/ui/button.tsx"),
      path.join(repo, "fixture/app/components/product/member-row-menu.tsx"),
    ]);
  });
});
