import { describe, expect, it } from "vitest";
import { assignOrdinals, callSiteHint, callSiteId, parseCallSiteId } from "./call-site.js";

const key = {
  path: "apps/app/membros/member-row-menu.tsx",
  enclosing: "MemberRowMenu",
  component: "DropdownMenuItem",
  ordinal: 3,
};

describe("call-site identity", () => {
  it("formats the id as path › enclosing › Component[n]", () => {
    expect(callSiteId(key)).toBe(
      "apps/app/membros/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[3]",
    );
  });

  it("parses an id back into its key", () => {
    expect(parseCallSiteId(callSiteId(key))).toEqual(key);
    expect(parseCallSiteId("apps/app/page.tsx:12:3|Button")).toBeNull();
  });

  it("keeps line and column out of the id and in the hint", () => {
    const hint = callSiteHint(key, { line: 107, column: 11, total: 4 });
    expect(hint).toBe("apps/app/membros/member-row-menu.tsx:107:11 3/4");
    expect(callSiteId(key)).not.toContain("107");
  });

  it("numbers occurrences per enclosing component and component, in source order", () => {
    const numbers = assignOrdinals([
      { enclosing: "A", component: "Button", start: 50 },
      { enclosing: "A", component: "Button", start: 10 },
      { enclosing: "B", component: "Button", start: 30 },
      { enclosing: "A", component: "Badge", start: 20 },
    ]);
    expect(numbers).toEqual([
      { ordinal: 2, total: 2 },
      { ordinal: 1, total: 2 },
      { ordinal: 1, total: 1 },
      { ordinal: 1, total: 1 },
    ]);
  });
});
