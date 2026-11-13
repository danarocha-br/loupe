import { describe, expect, it } from "vitest";
import { type Fiber, keyPathOf, keyPaths } from "./fiber.js";

/** A fiber chain from the root down; returns the innermost fiber. */
function chain(...keys: (string | null)[]): Fiber {
  let parent: Fiber | null = null;
  for (const key of keys) {
    parent = {
      tag: 0,
      key,
      type: null,
      memoizedProps: {},
      return: parent,
      child: null,
      sibling: null,
      alternate: null,
      stateNode: null,
    };
  }
  return parent as Fiber;
}

describe("keyPathOf", () => {
  it("joins app-authored keys from the outermost down", () => {
    expect(keyPathOf(chain(null, "team-1", null, "m1", null))).toBe("team-1/m1");
  });

  it("stops at the App Router's keys, which every Instance on the page shares", () => {
    // The chain seen on Next 16.3 above a Button in a keyed row of a page.
    const fiber = chain("layout", "c", "__PAGE__", "0", "__PAGE__", "c", "c-page", "m1", null);
    expect(keyPathOf(fiber)).toBe("m1");
    expect(keyPathOf(chain("layout/c/org/[slug]", "m2"))).toBe("m2");
    expect(keyPathOf(chain("__DEFAULT__", "x"))).toBe("x");
  });

  it("skips Base UI's generated keys", () => {
    expect(keyPathOf(chain("c-page", "m1", "base-ui-_R_1lpklrlb_"))).toBe("m1");
  });

  it("keeps app keys that only look path-like", () => {
    expect(keyPathOf(chain("c-page", "/settings/members", "a/c/b"))).toBe("/settings/members/a/c/b");
  });

  it("is empty when nothing above the Instance has an app key", () => {
    expect(keyPathOf(chain("c-page", null, null))).toBe("");
    expect(keyPathOf(null)).toBe("");
  });
});

describe("keyPaths", () => {
  it("answers as keyPathOf does, for fibers that share their ancestors", () => {
    const keyPathOfFiber = keyPaths();
    const row = chain("layout", "c-page", "team-1", "", null, "base-ui-_R_1_");
    const below = { ...row, key: "m1", return: row };
    const beside = { ...row, key: "c", return: row };
    for (const fiber of [row, below, beside, row.return, null]) {
      expect(keyPathOfFiber(fiber)).toBe(keyPathOf(fiber));
    }
    expect(keyPathOfFiber(below)).toBe("team-1//m1");
    expect(keyPathOfFiber(beside)).toBe("");
  });
});
