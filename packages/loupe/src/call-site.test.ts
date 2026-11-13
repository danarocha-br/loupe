import { describe, expect, it } from "vitest";
import {
  assignOrdinals,
  callSiteHint,
  callSiteId,
  callSiteLabels,
  instanceId,
  isUnanchored,
  pageAnchor,
  parseCallSiteId,
  parseHint,
  parseInstanceId,
  sharesBase,
  unanchoredId,
  uniqueId,
} from "./call-site.js";

const key = {
  path: "apps/app/membros/member-row-menu.tsx",
  enclosing: "MemberRowMenu",
  component: "DropdownMenuItem",
  ordinal: 3,
};
const ANCHOR = callSiteId(key);

describe("anchor", () => {
  it("formats the id as path › enclosing › Component[n]", () => {
    expect(ANCHOR).toBe("apps/app/membros/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[3]");
  });

  it("round-trips through parse", () => {
    expect(parseCallSiteId(ANCHOR)).toEqual(key);
    const odd = { path: "app/(group)/a b/[id]/page.tsx", enclosing: "<module>", component: "Button", ordinal: 12 };
    expect(parseCallSiteId(callSiteId(odd))).toEqual(odd);
  });

  it("reads anything else as null", () => {
    expect(parseCallSiteId("apps/app/page.tsx:12:3|Button")).toBeNull();
    expect(parseCallSiteId(unanchoredId("Button"))).toBeNull();
    expect(parseCallSiteId(pageAnchor("/membros", "Button"))).toBeNull();
  });

  it("marks an Adapter the loader didn't anchor", () => {
    expect(unanchoredId("Button")).toBe("<unanchored> › Button");
    expect(isUnanchored(unanchoredId("Button"))).toBe(true);
    expect(isUnanchored(ANCHOR)).toBe(false);
  });

  it("names a held page-scope record by route and component", () => {
    expect(pageAnchor("/membros", "Button")).toBe("/membros › Button");
  });
});

describe("Instance id", () => {
  it("adds the key path after #, only when there is one", () => {
    expect(instanceId(ANCHOR, "")).toBe(ANCHOR);
    expect(instanceId(ANCHOR, "user_1/0")).toBe(`${ANCHOR}#user_1/0`);
  });

  it("round-trips anchor and key path through parse", () => {
    for (const keyPath of ["", "user_1", "user_1/0", "row~2", "a#b"]) {
      expect(parseInstanceId(instanceId(ANCHOR, keyPath))).toEqual({ anchor: ANCHOR, key: keyPath });
    }
  });

  it("numbers mount-order duplicates ~2, ~3… after the base", () => {
    const taken = new Set([ANCHOR]);
    expect(uniqueId(ANCHOR, new Set())).toBe(ANCHOR);
    expect(uniqueId(ANCHOR, taken)).toBe(`${ANCHOR}~2`);
    taken.add(`${ANCHOR}~2`);
    expect(uniqueId(ANCHOR, taken)).toBe(`${ANCHOR}~3`);
  });

  it("tells a base's duplicates from another key path", () => {
    const base = instanceId(ANCHOR, "user_1");
    expect(sharesBase(base, base)).toBe(true);
    expect(sharesBase(uniqueId(base, new Set([base])), base)).toBe(true);
    expect(sharesBase(`${base}0`, base)).toBe(false);
    expect(sharesBase(`${base}~x`, base)).toBe(false);
    expect(sharesBase(instanceId(ANCHOR, "user_10"), base)).toBe(false);
  });

  it("drops an unkeyed duplicate's ~n from the anchor, and keeps a keyed one's on the key", () => {
    expect(parseInstanceId(uniqueId(ANCHOR, new Set([ANCHOR])))).toEqual({ anchor: ANCHOR, key: "" });
    const keyed = instanceId(ANCHOR, "user_1");
    expect(parseInstanceId(uniqueId(keyed, new Set([keyed])))).toEqual({ anchor: ANCHOR, key: "user_1~2" });
  });
});

describe("labels", () => {
  it("names an anchor", () => {
    expect(callSiteLabels(ANCHOR)).toEqual({
      component: "DropdownMenuItem",
      enclosing: "MemberRowMenu",
      site: "DropdownMenuItem[3]",
      short: "MemberRowMenu › DropdownMenuItem[3]",
      key: "",
    });
  });

  it("names a keyed duplicate", () => {
    const keyed = instanceId(ANCHOR, "user_1");
    expect(callSiteLabels(uniqueId(keyed, new Set([keyed])))).toEqual({
      component: "DropdownMenuItem",
      enclosing: "MemberRowMenu",
      site: "DropdownMenuItem[3]",
      short: "MemberRowMenu › DropdownMenuItem[3]#user_1~2",
      key: "#user_1~2",
    });
  });

  it("names an unkeyed duplicate", () => {
    const labels = callSiteLabels(uniqueId(ANCHOR, new Set([ANCHOR])));
    expect(labels.component).toBe("DropdownMenuItem");
    expect(labels.short).toBe("MemberRowMenu › DropdownMenuItem[3]~2");
    expect(labels.key).toBe("");
  });

  it("names an unanchored Instance by its component, with no enclosing", () => {
    const labels = callSiteLabels(instanceId(unanchoredId("Button"), "row_1"));
    expect(labels.component).toBe("Button");
    expect(labels.enclosing).toBeNull();
    expect(labels.short).toBe("<unanchored> › Button#row_1");
  });
});

describe("hint", () => {
  it("keeps line and column out of the id and in the hint", () => {
    const hint = callSiteHint(key, { line: 107, column: 11, total: 4 });
    expect(hint).toBe("apps/app/membros/member-row-menu.tsx:107:11 3/4");
    expect(ANCHOR).not.toContain("107");
  });

  it("round-trips through parse", () => {
    const odd = { path: "app/a b:c/menu.tsx", enclosing: "Menu", component: "Item", ordinal: 2 };
    expect(parseHint(callSiteHint(odd, { line: 9, column: 3, total: 4 }))).toEqual({
      path: "app/a b:c/menu.tsx",
      line: 9,
      column: 3,
      ordinal: 2,
      total: 4,
    });
  });

  it("reads no hint, or a malformed one, as null", () => {
    expect(parseHint(null)).toBeNull();
    expect(parseHint("app/menu.tsx:9:3")).toBeNull();
    expect(parseHint(ANCHOR)).toBeNull();
  });
});

describe("ordinals", () => {
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
