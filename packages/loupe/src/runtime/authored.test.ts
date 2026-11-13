// @vitest-environment jsdom
// PER-123 (decided in PER-96): the Current value holds only what the call site
// writes, library-injected props are kept apart, and a State prop (`X` with
// `onXChange`) held by an Override reports the app's attempts to change it.
import { act, cloneElement, createElement as h, type ReactElement, type Ref, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteId } from "../call-site.js";
import { encodeCallSiteWrites, type CallSiteWrites } from "../writes.js";
import { createAdapter } from "./adapter.js";
import { createDebug, type LoupeDebug } from "./debug.js";
import { stateScopeRefusal } from "./state.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Loose = Record<string, unknown>;

function DsButton({ variant = "default", size, ref, ...props }: Loose & { ref?: Ref<HTMLButtonElement> }) {
  return h("button", { ...props, ref, "data-variant": variant, "data-size": size });
}
const Button = createAdapter("Button", DsButton);

/** Shaped like Base UI's useRender on a menu trigger: clones the element with its own props. */
function MenuTrigger({ render: element, children }: { render: ReactElement<Loose>; children?: unknown }) {
  const ref = useRef<HTMLButtonElement>(null);
  return cloneElement(element, {
    key: "base-ui-_R_abc_",
    ref,
    id: "base-ui-_R_abc_",
    onClick: () => {},
    onKeyDown: () => {},
    "aria-expanded": false,
    "aria-haspopup": "menu",
    "data-slot": "dropdown-menu-trigger",
    children,
  } as Loose);
}

const writes = (record: Partial<CallSiteWrites>) =>
  encodeCallSiteWrites({ attributes: [], spreads: false, children: "none", ...record });

const siteAt = (path: string, enclosing: string, component: string, ordinal = 1) =>
  callSiteId({ path, enclosing, component, ordinal });
const triggerAnchor = siteAt("member-row-menu.tsx", "MemberRowMenu", "Button");

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

function renderTrigger(record: string | undefined, extra: Loose = {}) {
  render(
    h(
      MenuTrigger,
      {
        render: h(Button, {
          variant: "ghost",
          size: "icon",
          "aria-label": "Actions for Ana",
          [ANCHOR_ATTRIBUTE]: triggerAnchor,
          ...(record === undefined ? {} : { "data-ds-writes": record }),
          ...extra,
        }),
      },
      "⋯",
    ),
  );
}

describe("authored vs library props", () => {
  const authored = writes({
    attributes: [
      { name: "variant", writtenAs: "literal" },
      { name: "size", writtenAs: "literal" },
      { name: "aria-label", writtenAs: "expression", expression: "`Actions for ${name}`" },
    ],
  });

  it("lists only the props a render-prop trigger's call site writes; the library's are kept apart", () => {
    renderTrigger(authored);
    const described = loupe.props(triggerAnchor);
    expect(described.current).toEqual({ variant: "ghost", size: "icon", "aria-label": "Actions for Ana" });
    expect(described.authorship).toBe("recorded");
    expect(Object.keys(described.injected).sort()).toEqual(
      ["aria-expanded", "aria-haspopup", "children", "data-slot", "id", "onClick", "onKeyDown", "ref"].sort(),
    );
    expect(described.injected["data-slot"]).toBe("dropdown-menu-trigger");
    // Sources cover the app's props only, so nothing injected can reach Coverage.
    expect(Object.keys(described.sources).sort()).toEqual(["aria-label", "size", "variant"]);
    // The component still renders with everything, and says so.
    expect(described.rendered).toMatchObject({ variant: "ghost", "aria-haspopup": "menu", "data-slot": "dropdown-menu-trigger" });
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-haspopup")).toBe("menu");
    expect(button?.id).toBe("base-ui-_R_abc_");
  });

  it("keeps the loader's record out of both halves", () => {
    renderTrigger(authored);
    const described = loupe.props(triggerAnchor);
    expect(described.current).not.toHaveProperty("data-ds-writes");
    expect(described.injected).not.toHaveProperty("data-ds-writes");
    expect(described.injected).not.toHaveProperty(ANCHOR_ATTRIBUTE);
  });

  it("counts children as the app's when the call site writes them", () => {
    const pageButton = siteAt("page.tsx", "Page", "Button");
    render(
      h(
        Button,
        { variant: "ghost", [ANCHOR_ATTRIBUTE]: pageButton, "data-ds-writes": writes({
          attributes: [{ name: "variant", writtenAs: "literal" }],
          children: "text",
        }) },
        "Invite",
      ),
    );
    expect(loupe.props(pageButton).current).toEqual({ variant: "ghost", children: "Invite" });
  });

  it("an Override on a prop the call site didn't write lands among the app's rows, not the library's", () => {
    renderTrigger(authored);
    act(() => {
      loupe.set(triggerAnchor, "disabled", true);
    });
    const described = loupe.props(triggerAnchor);
    expect(described.overrides).toEqual({ disabled: true });
    expect(described.sources.disabled).toBe("instance");
    expect(described.injected).not.toHaveProperty("disabled");
    expect(container.querySelector("button")?.disabled).toBe(true);
  });

  it("reports a spreading call site as one where the two can't be separated", () => {
    renderTrigger(writes({ attributes: [{ name: "variant", writtenAs: "literal" }], spreads: true }));
    const described = loupe.props(triggerAnchor);
    expect(described.authorship).toBe("spreads");
    expect(described.injected).toEqual({});
    expect(described.current).toMatchObject({ variant: "ghost", "data-slot": "dropdown-menu-trigger" });
  });

  it("reports a call site with no record (or a malformed one) as unrecorded, and keeps every live prop", () => {
    renderTrigger(undefined);
    expect(loupe.props(triggerAnchor).authorship).toBe("unrecorded");
    expect(loupe.props(triggerAnchor).current).toHaveProperty("aria-haspopup", "menu");
    act(() => root.unmount());
    root = createRoot(container);
    renderTrigger("{not json");
    expect(loupe.props(triggerAnchor).authorship).toBe("unrecorded");
  });
});

// A dialog shaped like Base UI's: controlled when `open` is passed, uncontrolled
// otherwise, and it asks to close through `onOpenChange`.
function DsDialog({
  open,
  defaultOpen = false,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: { reason: string }) => void;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const shown = open ?? own;
  if (!shown) return null;
  return h(
    "div",
    { role: "alertdialog" },
    h(
      "button",
      {
        type: "button",
        onClick: () => {
          if (open === undefined) setOwn(false);
          onOpenChange?.(false, { reason: "close-press" });
        },
      },
      "Cancel",
    ),
  );
}
const Dialog = createAdapter("AlertDialog", DsDialog, { state: ["open"] });
const dialogAnchor = siteAt("member-row-menu.tsx", "MemberRowMenu", "AlertDialog");
const dialogShown = () => container.querySelector("[role=alertdialog]") !== null;
const pressCancel = () => act(() => (container.querySelector("[role=alertdialog] button") as HTMLButtonElement).click());

describe("State props", () => {
  const controlled = writes({
    attributes: [
      { name: "open", writtenAs: "expression", expression: "confirming" },
      { name: "onOpenChange", writtenAs: "expression", expression: "setConfirming" },
    ],
    children: "elements",
  });

  function Page({ onAppChange }: { onAppChange: (open: boolean) => void }) {
    const [confirming, setConfirming] = useState(false);
    return h(Dialog, {
      open: confirming,
      onOpenChange: (open: boolean) => {
        onAppChange(open);
        setConfirming(open);
      },
      [ANCHOR_ATTRIBUTE]: dialogAnchor,
      "data-ds-writes": controlled,
    } as Loose);
  }

  it("marks a State prop as controlled when the call site writes it", () => {
    render(h(Page, { onAppChange: () => {} }));
    expect(loupe.props(dialogAnchor).states).toEqual({ open: { controlled: true } });
  });

  it("an `open` Override holds the dialog open, the app's close attempt is reported, and reset hands control back", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const onAppChange = vi.fn();
    render(h(Page, { onAppChange }));
    expect(dialogShown()).toBe(false);

    act(() => {
      loupe.set(dialogAnchor, "open", true);
    });
    expect(dialogShown()).toBe(true);
    expect(loupe.props(dialogAnchor).states.open).toEqual({ controlled: true, held: { value: true } });

    pressCancel();
    // The app's handler keeps running, and the app's own value tracks it…
    expect(onAppChange).toHaveBeenCalledWith(false);
    expect(loupe.props(dialogAnchor).current.open).toBe(false);
    // …while the Override holds the dialog open and says so.
    expect(dialogShown()).toBe(true);
    expect(loupe.props(dialogAnchor).states.open).toEqual({
      controlled: true,
      held: { value: true, appTried: false },
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toContain("holds open at true; the app tried to set false");
    // Said once per attempt, however often the Instance rerenders.
    act(() => {
      loupe.set(dialogAnchor, "modal", false);
    });
    expect(info).toHaveBeenCalledTimes(1);

    act(() => {
      loupe.reset(dialogAnchor, "open");
    });
    expect(dialogShown()).toBe(false);
    expect(loupe.props(dialogAnchor).states.open).toEqual({ controlled: true });
  });

  it("reports a held controlled value the app changed by another path than the handler", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    let close = () => {};
    function Other() {
      const [confirming, setConfirming] = useState(true);
      close = () => setConfirming(false);
      return h(Dialog, {
        open: confirming,
        onOpenChange: setConfirming,
        [ANCHOR_ATTRIBUTE]: dialogAnchor,
        "data-ds-writes": controlled,
      } as Loose);
    }
    render(h(Other));
    act(() => {
      loupe.set(dialogAnchor, "open", true);
    });
    expect(loupe.props(dialogAnchor).states.open).toEqual({ controlled: true, held: { value: true } });
    act(() => close());
    expect(dialogShown()).toBe(true);
    expect(loupe.props(dialogAnchor).states.open).toEqual({
      controlled: true,
      held: { value: true, appTried: false },
    });
  });

  it("holds an uncontrolled State prop too, and reports the component's attempt through the handler", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    render(h(Dialog, { [ANCHOR_ATTRIBUTE]: dialogAnchor, "data-ds-writes": writes({ children: "elements" }) } as Loose));
    expect(loupe.props(dialogAnchor).states).toEqual({ open: { controlled: false } });
    act(() => {
      loupe.set(dialogAnchor, "open", true);
    });
    pressCancel();
    expect(dialogShown()).toBe(true);
    expect(loupe.props(dialogAnchor).states.open).toEqual({
      controlled: false,
      held: { value: true, appTried: false },
    });
  });

  it("doesn't loop when a component calls the held prop's handler from an effect", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const Eager = createAdapter(
      "Eager",
      ({ onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) => {
        // Every commit, with the handler as a dependency, as some libraries do.
        useLayoutEffect(() => onOpenChange?.(false), [onOpenChange]);
        return null;
      },
      { state: ["open"] },
    );
    const eager = siteAt("e", "E", "Eager");
    render(h(Eager, { [ANCHOR_ATTRIBUTE]: eager } as Loose));
    act(() => {
      loupe.set(eager, "open", true);
    });
    expect(loupe.props(eager).states.open).toEqual({
      controlled: false,
      held: { value: true, appTried: false },
    });
  });

  it("leaves the app's handler untouched while nothing holds the State prop", () => {
    const handler = vi.fn();
    let received: unknown;
    const Probe = createAdapter(
      "Probe",
      (props: { open?: boolean; onOpenChange?: unknown }) => {
        received = props.onOpenChange;
        return null;
      },
      { state: ["open"] },
    );
    render(h(Probe, { open: false, onOpenChange: handler, [ANCHOR_ATTRIBUTE]: siteAt("p", "P", "Probe") } as Loose));
    expect(received).toBe(handler);
  });

  it("refuses a State prop at group and page scope, and allows it at Instance scope", () => {
    expect(stateScopeRefusal("instance", ["open"], "open")).toBeNull();
    expect(stateScopeRefusal("group", ["open"], "open")).toBe("Change it on one Instance.");
    expect(stateScopeRefusal("page", ["open"], "open")).toBe("Change it on one Instance.");
    // Uniform: no State prop is exempt, and any other prop is unaffected.
    expect(stateScopeRefusal("page", ["checked"], "checked")).toBe("Change it on one Instance.");
    expect(stateScopeRefusal("group", ["open"], "variant")).toBeNull();
  });

  it("refuses an `open` Override at group or page scope through __loupe, and sets nothing", () => {
    render(h(Page, { onAppChange: () => {} }));
    for (const scope of ["group", "page"] as const) {
      expect(() => loupe.set(dialogAnchor, "open", true, scope)).toThrow("open is a State prop: Change it on one Instance.");
    }
    expect(loupe.records()).toEqual([]);
    expect(dialogShown()).toBe(false);
    // Any other prop of the same component still goes to a group.
    act(() => {
      loupe.set(dialogAnchor, "modal", false, "group");
    });
    expect(loupe.records()).toHaveLength(1);
  });

  it("names each mounted Instance's State props, for scopes that span Instances", () => {
    render(h(Page, { onAppChange: () => {} }));
    expect(loupe.list().find((row) => row.id === dialogAnchor)?.stateProps).toEqual(["open"]);
  });
});
