import { describe, expect, it } from "vitest";
import type { PropMeta } from "../meta/types.js";
import type { CallSiteWrites } from "../writes.js";
import { type InspectInput, inspect, NO_META_NOTE, parseHint, reasonOfValue, SERVER_NOTE, SPREADS_NOTE } from "./inspect.js";

const options = (values: (string | boolean)[], extra: Partial<PropMeta> = {}): PropMeta =>
  ({ editable: true, from: "repo", kind: "options", status: "verified", options: values, ...extra }) as PropMeta;

const BUTTON: Record<string, PropMeta> = {
  children: { editable: true, from: "@types/react", kind: "text" },
  className: { editable: false, from: "@base-ui/react", reason: "OPEN TEXT", default: { source: "unknown" } },
  render: { editable: false, from: "@base-ui/react", reason: "STRUCTURAL", default: { source: "unknown" } },
  size: options(["default", "sm"], { default: { source: "destructure", value: "default" } }),
  variant: options(["default", "ghost"], { default: { source: "destructure", value: "default" } }),
};

const writes = (names: string[], children: CallSiteWrites["children"] = "text"): CallSiteWrites => ({
  attributes: names.map((name) => ({ name, writtenAs: "literal" as const })),
  spreads: false,
  children,
});

const base = (over: Partial<InspectInput> = {}): InspectInput => ({
  id: "a.tsx › A › Button[1]#m1",
  component: "Button",
  anchor: "a.tsx › A › Button[1]",
  hint: "app/a.tsx:12:7 1/2",
  rendered: "client",
  current: { variant: "ghost", children: "Cancelar", onClick: () => {} },
  injected: { "aria-expanded": false, "data-slot": "button" },
  authorship: "recorded",
  writes: writes(["variant", "onClick"]),
  meta: BUTTON,
  stateProps: [],
  overridesOn: true,
  ...over,
});

describe("inspect", () => {
  it("lists every declared prop plus what the call site writes, Editable props first", () => {
    const result = inspect(base());
    expect(result.rows.map((row) => [row.name, row.editable, row.reason ?? null])).toEqual([
      ["children", true, null],
      ["size", true, null],
      ["variant", true, null],
      ["className", false, "OPEN TEXT"],
      ["render", false, "STRUCTURAL"],
      ["onClick", false, "FUNCTION"],
    ]);
    expect(result.coverage).toEqual({ editable: 3, inspectOnly: 3 });
    expect(result.rows.find((row) => row.name === "children")).toMatchObject({ label: "Text", text: true });
    // Only label text is marked.
    expect(result.rows.find((row) => row.name === "variant")?.text).toBeUndefined();
  });

  it("shows an unset prop's default, never a guessed value", () => {
    const size = inspect(base()).rows.find((row) => row.name === "size");
    expect(size).toMatchObject({ set: false, default: { source: "destructure", value: "default" } });
    const className = inspect(base()).rows.find((row) => row.name === "className");
    expect(className).toMatchObject({ set: false, default: { source: "unknown" } });
  });

  it("keeps a written prop whose value is undefined as set", () => {
    const onClick = inspect(base({ current: { onClick: undefined } })).rows.find((row) => row.name === "onClick");
    expect(onClick).toMatchObject({ set: true, value: undefined, reason: "FUNCTION" });
  });

  it("keeps injected props out of the rows and out of Coverage", () => {
    const result = inspect(base());
    expect(result.rows.some((row) => row.name === "aria-expanded" || row.name === "data-slot")).toBe(false);
    expect(result.injected).toEqual({ "aria-expanded": false, "data-slot": "button" });
  });

  it("judges label text by how this call site writes it (PER-113)", () => {
    const reason = (children: CallSiteWrites["children"]) =>
      inspect(base({ writes: writes(["variant"], children) })).rows.find((row) => row.name === "children")?.reason;
    expect(reason("text")).toBeUndefined();
    expect(reason("from-code")).toBe("FROM CODE");
    expect(reason("mixed")).toBe("MIXED");
    expect(reason("elements")).toBe("CONTENT");
    expect(inspect(base({ writes: null, authorship: "unrecorded" })).rows.find((row) => row.name === "children")?.reason).toBe(
      "UNVERIFIED",
    );
  });

  it("makes everything inspect-only while Overrides are off, and says why once", () => {
    const result = inspect(base({ overridesOn: false, overridesOffReason: "React reported no fiber." }));
    expect(result.coverage.editable).toBe(0);
    expect(result.rows.filter((row) => row.reason === "OVERRIDES OFF").map((row) => row.name)).toEqual([
      "children",
      "size",
      "variant",
    ]);
    expect(result.note).toContain("React reported no fiber.");
  });

  it("gives a server-rendered Instance one card-level line and no Editable prop", () => {
    const result = inspect(
      base({ rendered: "server", meta: null, authorship: "server", injected: {}, current: { plan: "pro", onPick: () => {} } }),
    );
    expect(result.note).toBe(SERVER_NOTE);
    expect(result.coverage).toEqual({ editable: 0, inspectOnly: 2 });
    // No per-row guess: "pro" may be one of a closed set we can't see from here.
    expect(result.rows.map((row) => row.reason)).toEqual([undefined, undefined]);
  });

  it("gives an Instance with no Adapter its metadata's reasons and defaults, and nothing Editable (PER-180)", () => {
    const result = inspect(base({ adapted: false, sources: undefined }));
    expect(result.rows.map((row) => [row.name, row.editable, row.reason ?? null])).toEqual([
      ["children", false, "NO ADAPTER"],
      ["className", false, "OPEN TEXT"],
      ["render", false, "STRUCTURAL"],
      ["size", false, "NO ADAPTER"],
      ["variant", false, "NO ADAPTER"],
      ["onClick", false, "FUNCTION"],
    ]);
    expect(result.coverage).toEqual({ editable: 0, inspectOnly: 6 });
    expect(result.rows.find((row) => row.name === "size")).toMatchObject({ set: false, default: { source: "destructure", value: "default" } });
    // Label text keeps its label, and a call site's own text reason still wins over "no Adapter".
    expect(result.rows.find((row) => row.name === "children")).toMatchObject({ label: "Text", text: true });
    const fromCode = inspect(base({ adapted: false, writes: writes(["variant"], "from-code") }));
    expect(fromCode.rows.find((row) => row.name === "children")?.reason).toBe("FROM CODE");
  });

  it("says no Adapter before Overrides off, which only an Adapter could lift", () => {
    const result = inspect(base({ adapted: false, overridesOn: false }));
    expect(result.rows.find((row) => row.name === "variant")?.reason).toBe("NO ADAPTER");
  });

  it("gives a server-rendered Instance with metadata its reasons and defaults, still nothing Editable (PER-180)", () => {
    const result = inspect(
      base({ rendered: "server", authorship: "server", injected: {}, current: { variant: "ghost", onClick: () => {} } }),
    );
    expect(result.note).toBe(SERVER_NOTE);
    expect(result.coverage.editable).toBe(0);
    expect(result.rows.map((row) => [row.name, row.reason ?? null])).toEqual([
      ["children", "ON THE SERVER"],
      ["className", "OPEN TEXT"],
      ["render", "STRUCTURAL"],
      ["size", "ON THE SERVER"],
      ["variant", "ON THE SERVER"],
      ["onClick", "FUNCTION"],
    ]);
    expect(result.rows.find((row) => row.name === "size")?.default).toEqual({ source: "destructure", value: "default" });
  });

  it("flags a spreading call site and an Adapter with no metadata", () => {
    expect(inspect(base({ authorship: "spreads", writes: { attributes: [], spreads: true, children: "text" } })).note).toBe(
      SPREADS_NOTE,
    );
    const bare = inspect(base({ meta: null }));
    expect(bare.note).toBe(NO_META_NOTE);
    expect(bare.rows.every((row) => !row.editable && row.reason === "UNVERIFIED")).toBe(true);
  });

  it("tags State props and records how the call site writes each prop", () => {
    const meta = { ...BUTTON, open: options([false, true], { state: true }) };
    const result = inspect(
      base({
        meta,
        current: { open: true },
        writes: { attributes: [{ name: "open", writtenAs: "expression", expression: "open" }], spreads: false, children: "none" },
      }),
    );
    expect(result.rows.find((row) => row.name === "open")).toMatchObject({
      state: true,
      editable: true,
      writtenAs: "expression",
      expression: "open",
    });
  });
});

describe("helpers", () => {
  it("parses the loader's hint", () => {
    expect(parseHint("app/a.tsx:12:7 2/4")).toEqual({ path: "app/a.tsx", line: 12, column: 7, ordinal: 2, total: 4 });
    expect(parseHint(null)).toBeNull();
  });

  it("names a reason for an undeclared value", () => {
    expect(reasonOfValue(() => {})).toBe("FUNCTION");
    expect(reasonOfValue("x")).toBe("OPEN TEXT");
    expect(reasonOfValue({ a: 1 })).toBe("OBJECT");
    expect(reasonOfValue({ $$typeof: Symbol.for("react.element") })).toBe("CONTENT");
    expect(reasonOfValue(3)).toBe("UNVERIFIED");
    expect(reasonOfValue(undefined, "onClick")).toBe("FUNCTION");
  });
});
