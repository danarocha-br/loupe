import { describe, expect, it } from "vitest";
import { newNumbering, type Numbered, numberChanges } from "./numbers.js";

const change = (key: string, values: Record<string, unknown> = { variant: "outline" }): Numbered => ({ key, values });

describe("change numbers", () => {
  it("gives each change the next number when it first shows, and keeps it while others come and go", () => {
    const numbering = newNumbering();
    expect(numberChanges([change("page:a")], numbering)).toEqual([1]);
    // A new change listed first, as the store lists Instance records, doesn't move the older one.
    expect(numberChanges([change("instance:b"), change("page:a")], numbering)).toEqual([2, 1]);
  });

  it("never gives a reset change's number to another, and keeps a number through an edit", () => {
    const numbering = newNumbering();
    numberChanges([change("a"), change("b")], numbering);
    expect(numberChanges([change("b", { variant: "ghost" })], numbering)).toEqual([2]);
    expect(numberChanges([change("b", { variant: "ghost" }), change("c")], numbering)).toEqual([2, 3]);
  });

  it("gives a change back its number when Undo puts it back as it was, and a new one when it comes back changed", () => {
    const numbering = newNumbering();
    numberChanges([change("a"), change("b")], numbering);
    numberChanges([], numbering);
    expect(numberChanges([change("a"), change("b")], numbering)).toEqual([1, 2]);
    numberChanges([change("a")], numbering);
    expect(numberChanges([change("a"), change("b", { variant: "secondary" })], numbering)).toEqual([1, 3]);
  });

  it("numbers changes that show together in the order the store saw them made", () => {
    const numbering = newNumbering();
    numbering.made.set("page:a", 1);
    numbering.made.set("instance:b", 2);
    expect(numberChanges([change("instance:b"), change("page:a")], numbering)).toEqual([2, 1]);
  });

  it("reads a record reset and made again between two counts as a new change", () => {
    const numbering = newNumbering();
    numbering.made.set("a", 1);
    expect(numberChanges([change("a")], numbering)).toEqual([1]);
    numbering.made.set("a", 2);
    expect(numberChanges([change("a", { variant: "ghost" })], numbering)).toEqual([2]);
    // The same values made again: the same change, so it gets its number back.
    numbering.made.set("a", 3);
    expect(numberChanges([change("a", { variant: "ghost" })], numbering)).toEqual([2]);
  });
});
