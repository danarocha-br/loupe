import { describe, expect, it } from "vitest";
import type { ProposalCallSite } from "./types.js";
import { changeInWords, ordinal, siteCount } from "./words.js";

const site = (nth: number, total: number | null): ProposalCallSite => ({
  path: "apps/app/components/member-row-menu.tsx",
  enclosing: "MemberRowMenu",
  component: "Button",
  nth,
  total,
  anchor: "",
  lineHint: null,
});

describe("words", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st",
    ]);
  });

  it("says which use of a component a call site is, and of how many when the page said", () => {
    expect(siteCount(site(3, 4))).toBe("3rd of 4");
    expect(siteCount(site(1, 1))).toBe("1st of 1");
    expect(siteCount(site(2, null))).toBe("2nd");
  });

  it("captions a change by its scope", () => {
    const change = (scope: "instance" | "call-site" | "page", callSites: ProposalCallSite[]) => ({
      scope,
      component: "Button",
      props: [{ name: "variant" }, { name: "children" }],
      callSites,
    });
    expect(changeInWords(change("instance", [site(1, 4)]))).toBe("variant, text on 1st of 4 <Button> in MemberRowMenu");
    expect(changeInWords(change("call-site", [site(1, 4)]))).toBe("variant, text on 1st of 4 <Button> in MemberRowMenu, every Instance");
    expect(changeInWords(change("page", [site(1, 4), site(2, 4)]))).toBe("variant, text on every <Button> on the page");
    expect(changeInWords(change("instance", []))).toBe("variant, text on <Button>");
  });
});
