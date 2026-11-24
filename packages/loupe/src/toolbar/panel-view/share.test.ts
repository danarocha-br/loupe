// `share(previous, next)`: the new view, with every part deeply equal to the last
// view's same part replaced by the last view's object.

import { describe, expect, it } from "vitest";
import { share } from "./share.js";

describe("share", () => {
  it("hands back the previous value when the two are deeply equal", () => {
    const previous = { a: 1, rows: [{ name: "x", tags: ["t"] }], seen: new Set(["Button"]) };
    const next = { a: 1, rows: [{ name: "x", tags: ["t"] }], seen: new Set(["Button"]) };
    expect(share(previous, next)).toBe(previous);
  });

  it("makes new only what changed and the objects holding it; its siblings keep their identity", () => {
    const previous = { rows: [{ name: "x", value: 1 }, { name: "y", value: 2 }], footer: { count: 3 } };
    const next = { rows: [{ name: "x", value: 1 }, { name: "y", value: 5 }], footer: { count: 3 } };
    const out = share(previous, next);
    expect(out).toEqual(next);
    expect(out).not.toBe(previous);
    expect(out.rows).not.toBe(previous.rows);
    expect(out.rows[0]).toBe(previous.rows[0]);
    expect(out.rows[1]).toBe(next.rows[1]);
    expect(out.footer).toBe(previous.footer);
  });

  it("compares arrays by index, and keeps the unchanged items of one that grew or shrank", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const grown = share([a, b], [{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(grown).toHaveLength(3);
    expect(grown[0]).toBe(a);
    expect(grown[1]).toBe(b);
    const shrunk = share([a, b], [{ id: "a" }]);
    expect(shrunk).toEqual([{ id: "a" }]);
    expect(shrunk[0]).toBe(a);
  });

  it("tells a missing key from an undefined one", () => {
    const previous: { a: number; b?: undefined } = { a: 1 };
    const next = { a: 1, b: undefined };
    expect(share(previous, next)).not.toBe(previous);
    expect(share(previous, next)).toEqual(next);
  });

  it("compares a function, a Map or a class instance only by identity", () => {
    const fn = () => 1;
    expect(share({ fn }, { fn: () => 1 }).fn).not.toBe(fn);
    const map = new Map([["a", 1]]);
    expect(share({ map }, { map: new Map([["a", 1]]) }).map).not.toBe(map);
    const date = new Date(0);
    expect(share({ date }, { date: new Date(0) }).date).not.toBe(date);
  });

  it("changes neither argument", () => {
    const previous = Object.freeze({ rows: Object.freeze([Object.freeze({ v: 1 })]) });
    const next = Object.freeze({ rows: Object.freeze([Object.freeze({ v: 2 })]), extra: Object.freeze({ v: 1 }) });
    expect(() => share(previous, next)).not.toThrow();
    expect(previous.rows[0]?.v).toBe(1);
    expect(next.rows[0]?.v).toBe(2);
  });

  it("returns the next value as it is when there is no previous one", () => {
    const next = { a: [1] };
    expect(share(null, next)).toBe(next);
    expect(share(undefined, next)).toBe(next);
  });
});
