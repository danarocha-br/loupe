// @vitest-environment jsdom
// Anchored client Instances with no Adapter (PER-100 §1, PER-179): found by a
// fiber walk and listed inspect-only, once each, never twice for one call site.
import { act, createElement as h, memo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdapter } from "./adapter.js";
import { createDebug, type LoupeDebug, UNADAPTED_REASON } from "./debug.js";
import { UNADAPTED_NOTE } from "./inspect.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = { title?: string; children?: ReactNode; [key: string]: unknown };

function DsButton(props: Props) {
  return h("button", props);
}
const Button = createAdapter("Button", DsButton);

/** A library part that forwards its props, as Radix's Slot does: never an Instance of its own. */
function Slot(props: Props) {
  return h("div", props);
}

/** A component `generate` has never seen: it forwards the loader's props to Slot. */
function NewCard(props: Props) {
  return h(Slot, props);
}
const MemoCard = memo(function MemoCardInner(props: Props) {
  return h("section", props);
});

const at = (component: string, n = 1) => `app/page.tsx › Page › ${component}[${n}]`;
const loader = (component: string, n = 1, line = 10) => ({
  "data-ds-anchor": at(component, n),
  "data-ds-source": `app/page.tsx:${line}:5 ${n}/1`,
});

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
const doc = document as unknown as Record<string, unknown>;

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // Next hydrates the document; `rootFibers` looks for a container there.
  const key = Object.keys(container).find((name) => name.startsWith("__reactContainer$")) as string;
  doc.__reactContainer$test = (container as unknown as Record<string, unknown>)[key];
  loupe = createDebug();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete doc.__reactContainer$test;
});

const render = (element: ReactNode) => act(() => root.render(h("main", null, element)));

describe("anchored client Instances without an Adapter", () => {
  it("are listed once each, inspect-only, beside adapted ones", () => {
    render([
      h(Button, { key: "b", ...loader("Button") }, "Save"),
      h(NewCard, { key: "c", title: "Hi", ...loader("NewCard", 1, 12) }, h("span", null, "Body")),
    ]);
    const rows = loupe.list();
    expect(rows.map((row) => [row.component, row.rendered, row.adapted])).toEqual([
      ["Button", "client", true],
      ["NewCard", "client", false],
    ]);
    expect(rows[1]).toMatchObject({
      id: at("NewCard"),
      anchor: at("NewCard"),
      hint: "app/page.tsx:12:5 1/1",
      editable: false,
      reason: UNADAPTED_REASON,
      overrides: {},
      renders: 0,
      stateProps: [],
    });
    // The server scan stays server-only.
    expect(loupe.scan()).toEqual([]);
  });

  it("names the component as the call site imports it, and keys repeated ones like Adapters", () => {
    render(
      h(
        "ul",
        null,
        ["m1", "m2"].map((key) => h("li", { key }, h(MemoCard, loader("Card")))),
      ),
    );
    expect(loupe.list().map((row) => [row.id, row.component])).toEqual([
      [`${at("Card")}#m1`, "Card"],
      [`${at("Card")}#m2`, "Card"],
    ]);
  });

  it("inspects one as client-rendered with no metadata, and says why there are no controls", () => {
    render(h(NewCard, { title: "Hi", ...loader("NewCard") }));
    const inspection = loupe.inspect(at("NewCard"));
    expect(inspection).toMatchObject({
      component: "NewCard",
      rendered: "client",
      callSite: { path: "app/page.tsx", line: 10, column: 5, ordinal: 1, total: 1 },
      note: UNADAPTED_NOTE,
      coverage: { editable: 0, inspectOnly: 1 },
    });
    expect(inspection.rows).toMatchObject([{ name: "title", value: "Hi", editable: false }]);
  });

  it("can be picked and highlighted, and refuses Overrides with the reason", () => {
    render(h(NewCard, { title: "Hi", ...loader("NewCard") }, h("span", null, "Body")));
    const span = container.querySelector("span") as Element;
    expect(loupe.pick(span)).toBe(at("NewCard"));
    expect(loupe.nodes(at("NewCard"))).toEqual([container.querySelector("div")]);
    expect(() => loupe.props(at("NewCard"))).toThrow(/no Adapter/);
    expect(() => loupe.set(at("NewCard"), "title", "Bye")).toThrow(/no Adapter/);
  });

  it("picks an adapted Instance inside an unadapted one, nearest first", () => {
    render(h(NewCard, loader("NewCard"), h(Button, loader("Button"), "Save")));
    expect(loupe.pick(container.querySelector("button") as Element)).toBe(at("Button"));
    expect(loupe.pick(container.querySelector("div") as Element)).toBe(at("NewCard"));
  });

  it("leaves a Server Component's client child to the server scan, so it is listed once", () => {
    const anchor = at("Badge");
    const props = { variant: "muted", "data-ds-anchor": anchor };
    // A client component a Server Component rendered with its props: React records the server one on it.
    const child = { tag: 0, key: null, type: () => null, memoizedProps: props, child: null, sibling: null, alternate: null, stateNode: null, _debugInfo: [{ name: "Badge", env: "Server", props }] };
    const host = { tag: 3, key: null, type: null, memoizedProps: {}, return: null, child, sibling: null, alternate: null, stateNode: null as unknown };
    host.stateNode = { current: host };
    (child as { return?: unknown }).return = host;
    doc.__reactContainer$test = host;
    expect(loupe.list().map((row) => [row.component, row.rendered])).toEqual([["Badge", "server"]]);
  });

  it("lists nothing for unanchored components or plain elements", () => {
    render([h(NewCard, { key: "c", title: "Hi" }), h("div", { key: "d", ...loader("Div") })]);
    expect(loupe.list()).toEqual([]);
  });
});
