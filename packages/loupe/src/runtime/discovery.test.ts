// @vitest-environment jsdom
// Instance discovery: which Instances are on the page, of what kind, with which
// DOM nodes and ancestors. Client cases render with real React; React records
// Server Components only under RSC, so those cases build the fibers by hand.
import { act, createElement as h, memo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteHint, callSiteId, instanceId, SOURCE_ATTRIBUTE } from "../call-site.js";
import { createAdapter } from "./adapter.js";
import { type AdaptedInstance, discover } from "./discovery.js";
import type { DebugInfo, Fiber } from "./fiber.js";
import { registry } from "./registry.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = { children?: ReactNode; [key: string]: unknown };

const siteAt = (path: string, enclosing: string, component: string, ordinal = 1) => ({ path, enclosing, component, ordinal });
const at = (component: string, n = 1) => callSiteId(siteAt("app/page.tsx", "Page", component, n));
const loader = (component: string, n = 1) => ({
  [ANCHOR_ATTRIBUTE]: at(component, n),
  [SOURCE_ATTRIBUTE]: callSiteHint(siteAt("app/page.tsx", "Page", component, n), { line: 10, column: 5, total: 1 }),
});

function DsButton(props: Props) {
  return h("button", props);
}
const Button = createAdapter("Button", DsButton);
function Slot(props: Props) {
  return h("div", props);
}
/** No Adapter: it forwards the loader's props to Slot, which is never an Instance of its own. */
function Card(props: Props) {
  return h(Slot, props);
}
/** A design-system wrapper that is a call site itself and hands the props to `render` (Base UI's Tooltip.Trigger). */
function Trigger({ render }: { render: ReactNode; [key: string]: unknown }) {
  return render;
}
const MemoCard = memo(function MemoCardInner(props: Props) {
  return h("section", props);
});

const doc = document as unknown as Record<string, unknown>;
const adapted = (): AdaptedInstance[] => [...registry().instances.values()];
const page = () => discover(document, adapted());

describe("with React rendering in the browser", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    // Next hydrates the document; `rootFibers` looks for a container there.
    const key = Object.keys(container).find((name) => name.startsWith("__reactContainer$")) as string;
    doc.__reactContainer$test = (container as unknown as Record<string, unknown>)[key];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete doc.__reactContainer$test;
  });

  const render = (element: ReactNode) => act(() => root.render(h("main", null, element)));

  it("lists adapted Instances first, as given, then the unadapted ones, each once", () => {
    render([h(Card, { key: "card", title: "Hi", ...loader("Card") }), h(Button, { key: "b", ...loader("Button") }, "Save")]);
    expect(page().instances).toEqual([
      { kind: "adapted", id: instanceId(at("Button"), "b") },
      {
        kind: "unadapted",
        id: instanceId(at("Card"), "card"),
        component: "Card",
        anchor: at("Card"),
        hint: callSiteHint(siteAt("app/page.tsx", "Page", "Card"), { line: 10, column: 5, total: 1 }),
        env: "Client",
        props: { title: "Hi" },
        raw: { title: "Hi", ...loader("Card") },
      },
    ]);
  });

  it("takes the outermost fiber carrying an anchor, past anchored wrappers between", () => {
    function Inner(props: Props) {
      return h("a", props);
    }
    function Outer(props: Props) {
      return h(Trigger, { [ANCHOR_ATTRIBUTE]: callSiteId(siteAt("ui/outer.tsx", "Outer", "Trigger")), render: h(Inner, props) });
    }
    render(h(Outer, loader("Outer")));
    expect(page().instances.map((instance) => [instance.kind, instance.id])).toEqual([
      ["unadapted", at("Outer")],
      ["unadapted", callSiteId(siteAt("ui/outer.tsx", "Outer", "Trigger"))],
    ]);
  });

  it("never finds an adapted Instance again as the component its Adapter renders", () => {
    function MenuButton(props: Props) {
      return h(Trigger, { [ANCHOR_ATTRIBUTE]: callSiteId(siteAt("ui/sidebar.tsx", "SidebarMenuButton", "Trigger")), render: h("a", props) });
    }
    const Menu = createAdapter("MenuButton", MenuButton);
    render(["a", "b"].map((key) => h(Menu, { key, ...loader("MenuButton") })));
    expect(page().instances.filter((instance) => instance.id.startsWith(at("MenuButton")))).toEqual([
      { kind: "adapted", id: instanceId(at("MenuButton"), "a") },
      { kind: "adapted", id: instanceId(at("MenuButton"), "b") },
    ]);
  });

  it("keys repeated Instances by the app's keys, and numbers ones that share an id", () => {
    render([
      h("ul", { key: "list" }, ["m1", "m2"].map((key) => h("li", { key }, h(MemoCard, loader("Card"))))),
      h(MemoCard, { key: "x", ...loader("Card", 2) }),
      h("div", { key: "y" }, h(MemoCard, loader("Card", 2))),
    ]);
    // `x` is the only app key above both of the second call site's Instances.
    expect(page().instances.map((instance) => instance.id)).toEqual([
      instanceId(at("Card"), "list/m1"),
      instanceId(at("Card"), "list/m2"),
      instanceId(at("Card", 2), "x"),
      instanceId(at("Card", 2), "y"),
    ]);
  });

  it("finds an Instance by id, adapted ones without walking the fibers", () => {
    render([h(Card, { key: "card", ...loader("Card") }), h(Button, { key: "b", ...loader("Button") }, "Save")]);
    const throwing = new Proxy(document, {
      get() {
        throw new Error("walked");
      },
    });
    const lazy = discover(throwing, adapted());
    const button = instanceId(at("Button"), "b");
    expect(lazy.find(button)).toEqual({ kind: "adapted", id: button });
    expect(lazy.nodes(button)).toEqual([container.querySelector("button")]);
    expect(lazy.ancestors(button)).toEqual([]);
    expect(() => lazy.find(instanceId(at("Card"), "card"))).toThrow("walked");
    expect(page().find(instanceId(at("Card"), "card"))).toMatchObject({ kind: "unadapted", component: "Card" });
    expect(page().find("nothing")).toBeUndefined();
  });

  it("finds the nearest Instance of any kind from a DOM node", () => {
    render(h(Card, loader("Card"), h(Button, loader("Button"), h("span", null, "Save"))));
    expect(page().at(container.querySelector("span") as Element)).toBe(at("Button"));
    expect(page().at(container.querySelector("div") as Element)).toBe(at("Card"));
    expect(page().at(container.querySelector("main") as Element)).toBeNull();
  });

  it("gives each Instance's outermost DOM nodes, and the adapted Instances around an adapted one", () => {
    render(h(Button, loader("Button"), h(Card, loader("Card"), h(Button, loader("Button", 2), "Inner"))));
    const outer = at("Button");
    const inner = at("Button", 2);
    expect(page().nodes(at("Card"))).toEqual([container.querySelector("div")]);
    expect(page().nodes(inner)).toEqual([container.querySelector("div > button")]);
    expect(page().ancestors(inner)).toEqual([outer]);
    expect(page().ancestors(at("Card"))).toEqual([]);
    expect(page().nodes("nothing")).toEqual([]);
  });

  it("lists nothing for unanchored components or plain elements", () => {
    render([h(Card, { key: "c", title: "Hi" }), h("div", { key: "d", ...loader("Div") })]);
    expect(page().instances).toEqual([]);
  });
});

/** A fiber built by hand, for what React only records under RSC. */
type Spec = {
  tag?: number;
  type?: unknown;
  key?: string | null;
  props?: Record<string, unknown>;
  server?: DebugInfo[];
  node?: Element;
  children?: Spec[];
};

/** Builds the fibers for `children` under a HostRoot and mounts them on the document. */
function mount(...children: Spec[]): Fiber {
  const build = (spec: Spec, parent: Fiber | null): Fiber => {
    const fiber: Fiber = {
      tag: spec.tag ?? (spec.node ? 5 : 0),
      key: spec.key ?? null,
      type: spec.type ?? (spec.node ? spec.node.tagName.toLowerCase() : function Component() {}),
      memoizedProps: spec.props ?? {},
      return: parent,
      child: null,
      sibling: null,
      alternate: null,
      stateNode: spec.node ?? null,
      _debugInfo: spec.server ?? null,
    };
    if (spec.node) (spec.node as unknown as Record<string, unknown>).__reactFiber$test = fiber;
    link(fiber, spec.children ?? []);
    return fiber;
  };
  const link = (parent: Fiber, specs: Spec[]): void => {
    let previous: Fiber | null = null;
    for (const spec of specs) {
      const fiber = build(spec, parent);
      if (previous) previous.sibling = fiber;
      else parent.child = fiber;
      previous = fiber;
    }
  };
  const host: Fiber = { tag: 3, key: null, type: null, memoizedProps: {}, return: null, child: null, sibling: null, alternate: null, stateNode: null };
  host.stateNode = { current: host };
  link(host, children);
  doc.__reactContainer$test = host;
  return host;
}

describe("with Server Components, as React records them", () => {
  afterEach(() => {
    delete doc.__reactContainer$test;
    document.body.replaceChildren();
  });

  const badge = { [ANCHOR_ATTRIBUTE]: at("Badge"), variant: "muted" };

  it("finds a server-rendered Instance once, however many fibers carry React's record of it", () => {
    const record = { name: "Badge", env: "Server", props: badge };
    mount({ tag: 5, type: "span", server: [record] }, { tag: 5, type: "span", server: [record] });
    expect(page().instances).toEqual([
      { kind: "server", id: at("Badge"), component: "Badge", anchor: at("Badge"), hint: null, env: "Server", props: { variant: "muted" }, raw: badge },
    ]);
  });

  it("skips pages and layouts, which the loader doesn't anchor, and defaults the environment", () => {
    mount({ tag: 5, type: "div", server: [{ name: "Page", env: "Server", props: {} }, { name: "Badge", props: badge }] });
    expect(page().instances).toMatchObject([{ kind: "server", component: "Badge", env: "Server" }]);
  });

  it("leaves a Server Component's client child to the server record, so it is found once", () => {
    mount({ tag: 0, props: badge, server: [{ name: "Badge", env: "Server", props: badge }] });
    expect(page().instances.map((instance) => instance.kind)).toEqual(["server"]);
  });

  it("lists unadapted Instances before server-rendered ones", () => {
    mount({ server: [{ name: "Badge", env: "Server", props: badge }], children: [{ tag: 5, type: "i" }] }, { props: loader("Card") });
    expect(page().instances.map((instance) => [instance.kind, instance.id])).toEqual([
      ["unadapted", at("Card")],
      ["server", at("Badge")],
    ]);
  });

  it("finds the innermost of several Server Components on one fiber, and one inside an unadapted Instance", () => {
    const panel = callSiteId(siteAt("app/shell.tsx", "Shell", "Panel"));
    const span = document.createElement("span");
    const div = document.createElement("div");
    div.append(span);
    document.body.append(div);
    mount({
      props: { [ANCHOR_ATTRIBUTE]: at("Shell") },
      children: [
        {
          node: div,
          server: [
            { name: "Badge", env: "Server", props: badge },
            { name: "Panel", env: "Server", props: { [ANCHOR_ATTRIBUTE]: panel } },
          ],
          children: [{ node: span }],
        },
      ],
    });
    expect(page().at(span)).toBe(panel);
  });

  it("falls back to the nearest anchor in the DOM for a server-rendered Instance off the fiber path", () => {
    const outside = document.createElement("p");
    outside.setAttribute(ANCHOR_ATTRIBUTE, at("Badge"));
    const inner = document.createElement("b");
    outside.append(inner);
    document.body.append(outside);
    mount({ tag: 5, type: "span", server: [{ name: "Badge", env: "Server", props: badge }] });
    expect(page().at(inner)).toBe(at("Badge"));
  });

  it("finds nothing without a document, but still knows the adapted Instances", () => {
    const empty = discover(undefined, [{ id: "a", fiber: null }]);
    expect(empty.instances).toEqual([{ kind: "adapted", id: "a" }]);
    expect(empty.find("b")).toBeUndefined();
  });

  it("follows each fiber's `return` chain once, so the walk stays linear in the tree's depth", () => {
    const depth = 2000;
    let spec: Spec = { tag: 5, type: "i" };
    for (let level = depth; level > 0; level--) spec = { key: `k${level}`, props: loader(`C${level}`), children: [spec] };
    const host = mount(spec);
    let reads = 0;
    const count = (fiber: Fiber | null): void => {
      for (let node = fiber; node; node = node.child) {
        let parent = node.return;
        Object.defineProperty(node, "return", {
          get: () => {
            reads++;
            return parent;
          },
          set: (value: Fiber | null) => {
            parent = value;
          },
        });
      }
    };
    count(host.child);
    expect(page().instances).toHaveLength(depth);
    // Walking up from every Instance would read about depth² / 2 = 2,000,000.
    expect(reads).toBeLessThan(depth * 10);
  });
});
