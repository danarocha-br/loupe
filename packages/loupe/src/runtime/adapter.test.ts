// @vitest-environment jsdom
import {
  act,
  cloneElement,
  createContext,
  createElement as h,
  type ReactElement,
  type Ref,
  memo,
  useContext,
  useRef,
  useState,
} from "react";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdapter } from "./adapter.js";
import { createDebug, type LoupeDebug } from "./debug.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ButtonProps = {
  variant?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  ref?: Ref<HTMLButtonElement>;
  onClick?: () => void;
};

function DsButton({ variant = "default", ref, ...props }: ButtonProps) {
  return h("button", { ...props, ref, "data-variant": variant });
}
DsButton.slot = "button";

const Button = createAdapter("Button", DsButton);
const anchor = (n: number) => `app/page.tsx › Page › Button[${n}]`;

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const render = (element: ReactElement) => act(() => root.render(element));
const buttons = () => [...container.querySelectorAll("button")];

describe("createAdapter", () => {
  it("registers each Instance as anchor plus app-authored key path, and repeated Instances stay independent", () => {
    render(
      h(
        "ul",
        null,
        ["m1", "m2"].map((id) =>
          h("li", { key: id }, h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps)),
        ),
      ),
    );
    expect(loupe.list().map((row) => row.id)).toEqual([`${anchor(1)}#m1`, `${anchor(1)}#m2`]);
    expect(loupe.status).toEqual({ overrides: true });

    act(() => {
      loupe.set(`${anchor(1)}#m2`, "variant", "destructive");
    });
    expect(buttons().map((button) => button.dataset.variant)).toEqual(["ghost", "destructive"]);

    act(() => {
      loupe.reset(`${anchor(1)}#m2`);
    });
    expect(buttons().map((button) => button.dataset.variant)).toEqual(["ghost", "ghost"]);
  });

  it("reports the live Current value next to the Override, and keeps the anchor in the DOM", () => {
    function Page() {
      const [count, setCount] = useState(0);
      return h(
        Button,
        { disabled: count > 0, onClick: () => setCount(count + 1), "data-ds-anchor": anchor(1) } as ButtonProps,
        `clicked ${count}`,
      );
    }
    render(h(Page));
    act(() => {
      loupe.set(anchor(1), "variant", "outline");
    });
    expect(loupe.props(anchor(1))).toMatchObject({
      current: { disabled: false, children: "clicked 0" },
      overrides: { variant: "outline" },
      sources: { variant: "instance", disabled: "app" },
    });

    act(() => buttons()[0]?.click());
    expect(loupe.props(anchor(1)).current).toMatchObject({ disabled: true, children: "clicked 1" });
    expect(buttons()[0]?.dataset.variant).toBe("outline");
    expect(buttons()[0]?.getAttribute("data-ds-anchor")).toBe(anchor(1));
  });

  it("passes refs through, with an Override applied", () => {
    let node: HTMLButtonElement | null = null;
    function Page() {
      const ref = useRef<HTMLButtonElement>(null);
      node = null;
      React.useEffect(() => {
        node = ref.current;
      });
      return h(Button, { ref, "data-ds-anchor": anchor(1) } as ButtonProps);
    }
    render(h(Page));
    act(() => {
      loupe.set(anchor(1), "variant", "outline");
    });
    expect(node).toBe(buttons()[0]);
  });

  it("works as a cloned `render` element: library keys and props pass through, the key is not app-authored", () => {
    // Shaped like Base UI's useRender: clones the element with a generated key,
    // its own ref and its own props.
    function Trigger({ render: element }: { render: ReactElement<ButtonProps> }) {
      const ref = useRef<HTMLButtonElement>(null);
      return cloneElement(element, {
        key: "base-ui-_R_abc_",
        ref,
        onClick: () => {},
        "aria-haspopup": "menu",
      } as ButtonProps & { key: string });
    }
    render(
      h(
        "div",
        { key: "row-1" },
        h(Trigger, { render: h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps) }),
      ),
    );
    // `row-1` is the app's key; Base UI's generated one is left out.
    const [row] = loupe.list();
    expect(row?.id).toBe(`${anchor(1)}#row-1`);
    act(() => {
      loupe.set(`${anchor(1)}#row-1`, "variant", "destructive");
    });
    expect(buttons()[0]?.getAttribute("aria-haspopup")).toBe("menu");
    expect(buttons()[0]?.dataset.variant).toBe("destructive");
  });

  it("leaves context alone", () => {
    const Theme = createContext("light");
    const Themed = createAdapter("Themed", (props: { label: string }) =>
      h("span", null, `${props.label}:${useContext(Theme)}`),
    );
    render(h(Theme.Provider, { value: "dark" }, h(Themed, { label: "a", "data-ds-anchor": "x › X › Themed[1]" } as { label: string })));
    act(() => {
      loupe.set("x › X › Themed[1]", "label", "b");
    });
    expect(container.textContent).toBe("b:dark");
  });

  it("applies an Override behind a React.memo parent that does not rerender", () => {
    const Row = memo(function Row() {
      return h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps);
    });
    render(h(Row));
    act(() => {
      loupe.set(anchor(1), "variant", "destructive");
    });
    expect(buttons()[0]?.dataset.variant).toBe("destructive");
  });

  it("adapts a memo component without becoming one, and hoists its statics", () => {
    const renders = vi.fn();
    const MemoButton = memo(function MemoButton(props: ButtonProps) {
      renders();
      return h("button", { "data-variant": props.variant });
    });
    const Adapted = createAdapter("MemoButton", MemoButton);
    expect(typeof Adapted).toBe("function");
    expect((Adapted as unknown as { $$typeof?: unknown }).$$typeof).toBeUndefined();
    expect((Button as unknown as typeof DsButton).slot).toBe("button");

    render(h(Adapted, { variant: "ghost", "data-ds-anchor": "x › X › MemoButton[1]" } as ButtonProps));
    act(() => {
      loupe.set("x › X › MemoButton[1]", "variant", "outline");
    });
    expect(buttons()[0]?.dataset.variant).toBe("outline");
  });

  it("re-registers under the new id when the call site's anchor changes", () => {
    render(h(Button, { "data-ds-anchor": anchor(1) } as ButtonProps));
    render(h(Button, { "data-ds-anchor": anchor(2) } as ButtonProps));
    expect(loupe.list().map((row) => row.id)).toEqual([anchor(2)]);
  });

  it("keeps an Override across an unmount and remount under the same id", () => {
    render(h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps));
    act(() => {
      loupe.set(anchor(1), "variant", "destructive");
    });
    render(h("div"));
    render(h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps));
    expect(buttons()[0]?.dataset.variant).toBe("destructive");
  });

  it("names a picked DOM node's Instance", () => {
    render(h("div", { key: "a" }, h(Button, { "data-ds-anchor": anchor(1) } as ButtonProps, h("i", null, "x"))));
    const icon = container.querySelector("i") as Element;
    expect(loupe.pick(icon)).toBe(`${anchor(1)}#a`);
  });

  it("tells apart Instances from one call site with no key, and lends neither the other's Override", () => {
    const row = () => h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps);
    render(h("div", null, row()));
    act(() => {
      loupe.set(anchor(1), "variant", "destructive");
    });
    render(h("div", null, row(), h("span", null, row())));
    expect(loupe.list().map((r) => r.id)).toEqual([anchor(1), `${anchor(1)}~2`]);
    expect(buttons().map((button) => button.dataset.variant)).toEqual(["destructive", "ghost"]);
  });

  it("lists server-rendered Instances from _debugInfo, inspect-only, with their key path", () => {
    const fiber = (key: string | null, extra: object = {}) => ({
      tag: 5,
      key,
      type: "span",
      memoizedProps: {},
      return: null,
      child: null,
      sibling: null,
      alternate: null,
      stateNode: null,
      ...extra,
    });
    const badge = fiber(null, {
      _debugInfo: [
        { name: "MembersPage", env: "Server", props: {} },
        {
          name: "Badge",
          env: "Server",
          props: { variant: "muted", "data-ds-anchor": "app/page.tsx › MembersPage › Badge[1]", "data-ds-source": "app/page.tsx:26:13 1/1" },
        },
      ],
    });
    const row = fiber("m2", { child: badge });
    badge.return = row as never;
    const host = fiber(null, { tag: 3, child: row });
    (host as { stateNode: unknown }).stateNode = { current: host };
    row.return = host as never;
    const doc = document as unknown as Record<string, unknown>;
    doc.__reactContainer$test = host;
    try {
      expect(loupe.scan()).toEqual([
        {
          id: "app/page.tsx › MembersPage › Badge[1]#m2",
          component: "Badge",
          anchor: "app/page.tsx › MembersPage › Badge[1]",
          hint: "app/page.tsx:26:13 1/1",
          env: "Server",
          props: { variant: "muted" },
        },
      ]);
      expect(loupe.list()).toMatchObject([{ rendered: "server", editable: false }]);
      expect(() => loupe.set("app/page.tsx › MembersPage › Badge[1]#m2", "variant", "default")).toThrow(
        /Server Component/,
      );
    } finally {
      delete doc.__reactContainer$test;
    }
  });

  it("goes inspect-only when React names a different fiber than the rendering Adapter", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const internals = (React as unknown as Record<string, Record<string, unknown>>)
      .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as Record<string, unknown>;
    let dispatcher: unknown = internals.A;
    const stranger = { tag: 0, key: null, type: () => null, memoizedProps: {}, return: null };
    Object.defineProperty(internals, "A", {
      configurable: true,
      get: () => (dispatcher ? { ...(dispatcher as object), getOwner: () => stranger } : dispatcher),
      set: (value) => {
        dispatcher = value;
      },
    });
    try {
      render(h(Button, { "data-ds-anchor": anchor(1) } as ButtonProps));
      await act(async () => {});
      expect(loupe.status).toEqual({
        overrides: false,
        reason: "React reported a different fiber than the Adapter rendering.",
      });
    } finally {
      Object.defineProperty(internals, "A", { configurable: true, writable: true, value: dispatcher });
    }
  });

  it("goes inspect-only when React's internals don't identify the rendering Adapter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // React installs its dispatcher only for the length of a render: break
    // getOwner() on whatever dispatcher it installs.
    const internals = (React as unknown as Record<string, Record<string, unknown>>)
      .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as Record<string, unknown>;
    let dispatcher: unknown = internals.A;
    Object.defineProperty(internals, "A", {
      configurable: true,
      get: () => (dispatcher ? { ...(dispatcher as object), getOwner: () => null } : dispatcher),
      set: (value) => {
        dispatcher = value;
      },
    });

    render(h(Button, { variant: "ghost", "data-ds-anchor": anchor(1) } as ButtonProps));
    await act(async () => {});
    expect(loupe.status.overrides).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("This React build isn't supported"));
    expect(loupe.list()[0]).toMatchObject({ editable: false });
    expect(() => loupe.set(anchor(1), "variant", "destructive")).toThrow(/inspect-only/);
    expect(buttons()[0]?.dataset.variant).toBe("ghost");
    Object.defineProperty(internals, "A", { configurable: true, writable: true, value: dispatcher });
  });
});
