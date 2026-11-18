import { describe, expect, it } from "vitest";
import { toJson } from "./json.js";

describe("toJson", () => {
  it("keeps JSON as it is and shows anything else as the Toolbar does", () => {
    expect(toJson({ a: [1, "x", null] })).toEqual({ a: [1, "x", null] });
    expect(toJson(function onSelect() {})).toBe("ƒ onSelect()");
    expect(toJson(Number.NaN)).toBe("NaN");
  });

  it("survives a value that refers to itself", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(toJson(cyclic)).toEqual({ a: 1, self: "[Circular]" });
    expect(toJson({ left: [1], right: [1] })).toEqual({ left: [1], right: [1] });
  });
});
