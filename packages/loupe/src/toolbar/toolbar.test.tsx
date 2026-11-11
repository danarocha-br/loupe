// @vitest-environment jsdom
import { act, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropMeta } from "../meta/types.js";
import { devMount } from "../mount.js";
import { createAdapter } from "../runtime/adapter.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { disableOverrides, onRegistryChange } from "../runtime/registry.js";
import Toolbar from "./index.js";
import { HOST_ATTRIBUTE } from "./styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const META: Record<string, PropMeta> = {
  children: { editable: true, from: "@types/react", kind: "text" },
  variant: { editable: true, from: "repo", kind: "options", status: "verified", options: ["default", "ghost"] },
  render: { editable: false, from: "@base-ui/react", reason: "STRUCTURAL" },
};

type ButtonProps = { variant?: string; children?: ReactNode; onClick?: () => void; "aria-expanded"?: boolean };
const Button = createAdapter(
  "Button",
  ({ variant = "default", ...props }: ButtonProps) => <button type="button" {...props} data-variant={variant} />,
  { props: META },
);
type DialogProps = { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode };
const Dialog = createAdapter(
  "Dialog",
  ({ open, onOpenChange, children }: DialogProps) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" onClick={() => onOpenChange?.(false)}>
          Fechar
        </button>
      </div>
    ) : null,
  {
    props: {
      open: { editable: true, from: "@base-ui/react", kind: "options", status: "type-only", options: [false, true], state: true },
      onOpenChange: { editable: false, from: "@base-ui/react", reason: "FUNCTION" },
      // The two sources of its default disagree: no pill may be guessed.
      modal: {
        editable: true,
        from: "repo",
        kind: "options",
        status: "verified",
        options: [false, true],
        default: { source: "conflict", value: true, defaultVariants: false },
      },
    },
  },
);
const MenuItem = createAdapter("MenuItem", (props: { children?: ReactNode }) => <div role="menuitem">{props.children}</div>);

// What the loader writes at a call site.
const site = (n: number, names: string[], children = "text") => ({
  "data-ds-anchor": `app/members.tsx › Members › Button[${n}]`,
  "data-ds-source": `app/members.tsx:${10 + n}:9 ${n}/2`,
  "data-ds-writes": JSON.stringify({ attributes: names.map((name) => ({ name, writtenAs: "literal" })), spreads: false, children }),
});

const LoupeMount = devMount(Toolbar);

function Page({ onRowClick }: { onRowClick: (member: string) => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <main>
      <ul>
        {["ana", "bia", "caio", "dani"].map((member) => (
          <li key={member}>
            <Button {...(site(1, ["variant", "onClick"]) as object)} variant="ghost" onClick={() => onRowClick(member)} aria-expanded={false}>
              {member}
            </Button>
          </li>
        ))}
      </ul>
      <Button {...(site(2, ["onClick"]) as object)} onClick={() => setOpen(!open)}>
        Menu
      </Button>
      {open && (
        <MenuItem {...({ "data-ds-anchor": "app/members.tsx › Members › MenuItem[1]" } as object)}>Remover</MenuItem>
      )}
      <button type="button" onClick={() => setConfirming(true)}>
        Abrir
      </button>
      <Dialog
        {...({
          "data-ds-anchor": "app/members.tsx › Members › Dialog[1]",
          "data-ds-writes": JSON.stringify({
            attributes: [
              { name: "open", writtenAs: "expression", expression: "confirming" },
              { name: "onOpenChange", writtenAs: "expression", expression: "setConfirming" },
            ],
            spreads: false,
            children: "text",
          }),
        } as object)}
        open={confirming}
        onOpenChange={setConfirming}
      >
        Remover membro?
      </Dialog>
    </main>
  );
}

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
  (window as { __loupe?: LoupeDebug }).__loupe = loupe;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  delete (window as { __loupe?: LoupeDebug }).__loupe;
  vi.restoreAllMocks();
});

/** Lets the lazy Toolbar, its effects and its once-a-frame refresh settle. */
const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));

async function mount(onRowClick: (member: string) => void = () => {}) {
  act(() =>
    root.render(
      <>
        <Page onRowClick={onRowClick} />
        <LoupeMount />
      </>,
    ),
  );
  await settle();
  await settle();
}

const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const panelText = () => shadow().querySelector(".panel")?.textContent ?? "";
const instanceButtons = () => [...shadow().querySelectorAll<HTMLButtonElement>("button[data-instance]")];
const clickInPanel = async (element: Element) => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
  await settle();
};
const pageButton = (text: string) => [...container.querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;

describe("the Toolbar", () => {
  it("lists every Instance on the page and updates as a menu mounts and unmounts", async () => {
    await mount();
    expect(panelText()).toContain("Button ×5");
    expect(panelText()).not.toContain("MenuItem");

    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).toContain("MenuItem ×1");

    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).not.toContain("MenuItem ×1");
    expect(panelText()).toContain("Appears on interaction");
  });

  it("selects from the list and shows identity, call site, Coverage and the library's props in one line", async () => {
    await mount();
    const bia = instanceButtons().find((button) => button.dataset.instance?.endsWith("#bia")) as HTMLButtonElement;
    await clickInPanel(bia);

    expect(shadow().querySelector("[data-testid=instance-id]")?.textContent).toBe("app/members.tsx › Members › Button[1]#bia");
    expect(panelText()).toContain("app/members.tsx:11:9 · use 1 of 2");
    expect(shadow().querySelector("[data-testid=coverage]")?.textContent).toBe("2 editable props · 2 inspect only");
    const onClick = shadow().querySelector("[data-prop=onClick]")?.textContent ?? "";
    expect(onClick).toContain("FUNCTION");
    expect(shadow().querySelector("[data-prop=render]")?.textContent).toContain("STRUCTURAL");
    // Injected by "the library": one collapsed line, not a row.
    expect(shadow().querySelector("[data-prop=aria-expanded]")).toBeNull();
    const injected = [...shadow().querySelectorAll("details")].at(-1) as HTMLDetailsElement;
    expect(injected.querySelector("summary")?.textContent).toBe("1 set by the library");
    expect(injected.open).toBe(false);
  });

  it("picks the right one of four repeated row Instances by clicking the page, without the page reacting", async () => {
    const clicked: string[] = [];
    await mount((member) => clicked.push(member));
    const pick = [...shadow().querySelectorAll("button")].find((button) => button.textContent === "Pick") as HTMLButtonElement;
    await clickInPanel(pick);
    expect(pick.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      pageButton("caio").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
      pageButton("caio").click();
    });
    await settle();
    expect(clicked).toEqual([]);
    expect(shadow().querySelector("[data-testid=instance-id]")?.textContent).toBe("app/members.tsx › Members › Button[1]#caio");
    expect(pick.getAttribute("aria-pressed")).toBe("false");

    // Pick is off again: the page's own clicks go through.
    act(() => pageButton("dani").click());
    expect(clicked).toEqual(["dani"]);
  });

  it("lets Esc and Hide end Pick, after which the page's clicks go through", async () => {
    const clicked: string[] = [];
    await mount((member) => clicked.push(member));
    const button = (text: string) => [...shadow().querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;
    await clickInPanel(button("Pick"));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    await settle();
    expect(button("Pick").getAttribute("aria-pressed")).toBe("false");
    act(() => pageButton("ana").click());
    expect(clicked).toEqual(["ana"]);

    await clickInPanel(button("Pick"));
    await clickInPanel(button("Hide"));
    act(() => pageButton("bia").click());
    expect(clicked).toEqual(["ana", "bia"]);
    expect(shadow().querySelector(".panel")).toBeNull();
  });

  it("keeps showing a selected Instance's place while its menu is closed", async () => {
    await mount();
    act(() => pageButton("Menu").click());
    await settle();
    const item = instanceButtons().find((button) => button.dataset.instance?.includes("MenuItem")) as HTMLButtonElement;
    await clickInPanel(item);
    expect(panelText()).toContain("MenuItem");

    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).toContain("Not on the page now");
  });

  it("goes inspect-only as a whole when the React self-check fails", async () => {
    await mount();
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    await settle();
    expect(shadow().querySelector(".banner")?.textContent).toContain("everything is inspect-only");
    const reset = [...shadow().querySelectorAll("button")].find((button) => button.textContent === "Reset all") as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    await clickInPanel(instanceButtons()[0] as HTMLButtonElement);
    expect(shadow().querySelector("[data-testid=coverage]")?.textContent).toBe("0 editable props · 4 inspect only");
  });

  it("Reset all drops every record, including one whose Instance isn't mounted", async () => {
    await mount();
    act(() => pageButton("Menu").click());
    await settle();
    const item = loupe.list("MenuItem")[0]?.id as string;
    act(() => {
      loupe.set(item, "children", "Sair");
      loupe.set("app/members.tsx › Members › Button[1]#ana", "variant", "default");
    });
    act(() => pageButton("Menu").click());
    await settle();
    expect(() => loupe.reset(item)).toThrow(/No mounted Instance/);
    expect(panelText()).toContain("2 overrides");

    const reset = [...shadow().querySelectorAll("button")].find((button) => button.textContent === "Reset all") as HTMLButtonElement;
    await clickInPanel(reset);
    expect(loupe.records()).toEqual([]);
    expect(panelText()).toContain("0 overrides");
  });

  it("rings the selected Instance on the page", async () => {
    await mount();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
    await clickInPanel(instanceButtons()[0] as HTMLButtonElement);
    const ring = shadow().querySelector<HTMLElement>(".ring");
    expect(ring?.style.top).toBe("8px");
    expect(ring?.textContent).toBe("Button");
  });
});

const BIA = "app/members.tsx › Members › Button[1]#bia";
const DIALOG = "app/members.tsx › Members › Dialog[1]";
const row = (prop: string) => shadow().querySelector<HTMLElement>(`[data-prop=${prop}]`) as HTMLElement;
const inRow = (prop: string, text: string) =>
  [...row(prop).querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;
const select = async (id: string) =>
  clickInPanel(instanceButtons().find((button) => button.dataset.instance === id) as HTMLButtonElement);

describe("controls at This instance", () => {
  it("overrides an option on one Instance, shows the Current value beside it, and resets it", async () => {
    await mount();
    await select(BIA);
    expect(inRow("variant", '"ghost"').getAttribute("aria-pressed")).toBe("true");
    expect(row("variant").classList.contains("overridden")).toBe(false);

    await clickInPanel(inRow("variant", '"default"'));
    expect(loupe.props(BIA).overrides).toEqual({ variant: "default" });
    expect(pageButton("bia").dataset.variant).toBe("default");
    // Only this Instance: the other rows keep the app's value.
    expect(pageButton("ana").dataset.variant).toBe("ghost");
    expect(row("variant").classList.contains("overridden")).toBe(true);
    expect(inRow("variant", '"default"').getAttribute("aria-pressed")).toBe("true");
    expect(row("variant").querySelector("[data-testid=current]")?.textContent).toBe('Current: "ghost"');

    await clickInPanel(inRow("variant", "Reset"));
    expect(loupe.props(BIA).overrides).toEqual({});
    expect(pageButton("bia").dataset.variant).toBe("ghost");
    expect(row("variant").querySelector("[data-testid=current]")).toBeNull();
  });

  it("edits label text in a field and resets the whole Instance", async () => {
    await mount();
    await select(BIA);
    const field = row("children").querySelector("input") as HTMLInputElement;
    expect(field.value).toBe("bia");
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(field, "Bianca");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    await clickInPanel(inRow("variant", '"default"'));
    expect(loupe.props(BIA).overrides).toEqual({ children: "Bianca", variant: "default" });
    expect(container.textContent).toContain("Bianca");
    expect(row("children").querySelector("[data-testid=current]")?.textContent).toBe('Current: "bia"');

    const resetInstance = [...shadow().querySelectorAll("button")].find((b) => b.textContent === "Reset this Instance") as HTMLButtonElement;
    expect(resetInstance.disabled).toBe(false);
    await clickInPanel(resetInstance);
    expect(loupe.records()).toEqual([]);
    expect(pageButton("bia")).toBeTruthy();
    expect(resetInstance.disabled).toBe(true);
  });

  it("tags a State prop and says when the app tries to change a held value, while Current tracks the app", async () => {
    await mount();
    await select(DIALOG);
    expect(row("open").textContent).toContain("STATE");
    expect(row("modal").querySelectorAll("button[aria-pressed=true]")).toHaveLength(0);
    await clickInPanel(inRow("open", "true"));
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
    expect(row("open").querySelector("[data-testid=current]")?.textContent).toBe("Current: false");
    expect(row("open").querySelector("[data-testid=held]")).toBeNull();

    // The app's own state moves: Current follows it.
    act(() => pageButton("Abrir").click());
    await settle();
    expect(row("open").querySelector("[data-testid=current]")?.textContent).toBe("Current: true");

    // The app tries to close it: the Override holds, and the row says so.
    act(() => pageButton("Fechar").click());
    await settle();
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
    expect(row("open").querySelector("[data-testid=current]")?.textContent).toBe("Current: false");
    expect(row("open").querySelector("[data-testid=held]")?.textContent).toBe(
      "Your Override holds this at true; the app tried to set false. Reset",
    );

    await clickInPanel(inRow("open", "Reset"));
    expect(container.querySelector("[role=dialog]")).toBeNull();
    expect(row("open").querySelector("[data-testid=held]")).toBeNull();
  });
});

describe("controls at This instance, edge cases", () => {
  it("offers Reset this Instance for a selected Instance that isn't mounted, through discard", async () => {
    await mount();
    act(() => pageButton("Menu").click());
    await settle();
    const item = loupe.list("MenuItem")[0]?.id as string;
    await select(item);
    act(() => {
      loupe.set(item, "children", "Sair");
    });
    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).toContain("Not on the page now");
    const reset = [...shadow().querySelectorAll("button")].find((b) => b.textContent === "Reset this Instance") as HTMLButtonElement;
    await clickInPanel(reset);
    expect(loupe.records()).toEqual([]);
  });

  it("shows a group Override as chosen, says where it comes from, with no Instance Reset", async () => {
    await mount();
    act(() => {
      loupe.set(BIA, "variant", "default", "group");
    });
    await select(BIA);
    expect(row("variant").querySelector("[data-testid=source]")?.textContent).toBe("from All in Members · Button 1 of 2");
    expect(row("variant").querySelector("[data-testid=current]")?.textContent).toBe('Current: "ghost"');
    expect(inRow("variant", '"default"').getAttribute("aria-pressed")).toBe("true");
    expect(inRow("variant", "Reset")).toBeUndefined();
  });
});

const ANA = "app/members.tsx › Members › Button[1]#ana";
const MENU = "app/members.tsx › Members › Button[2]";
const GROUP = "All in Members · Button 1 of 2";
const scopeButton = (scope: string) => shadow().querySelector<HTMLButtonElement>(`[data-scope=${scope}]`) as HTMLButtonElement;
const pill = (prop: string, option: string) =>
  row(prop).querySelector<HTMLButtonElement>(`button[data-option='${option}']`) as HTMLButtonElement;
const member = (id: string) => shadow().querySelector<HTMLInputElement>(`input[data-member="${id}"]`) as HTMLInputElement;
const panelButton = (text: string) =>
  [...shadow().querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;
const ringKinds = () => [...shadow().querySelectorAll<HTMLElement>(".ring")].map((ring) => ring.dataset.ring);
const variants = () => ["ana", "bia", "caio", "dani"].map((name) => pageButton(name).dataset.variant);
const backToList = async () => clickInPanel(panelButton("← All components"));

describe("group and page scopes", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
  });

  it("opens at This instance and offers each scope with its size", async () => {
    await mount();
    await select(BIA);
    expect(scopeButton("instance").getAttribute("aria-pressed")).toBe("true");
    expect(scopeButton("instance").textContent).toBe("This instance");
    expect(scopeButton("group").textContent).toBe(`${GROUP} · 4`);
    expect(scopeButton("page").textContent).toBe("All on page · 5");
    expect(ringKinds()).toEqual(["ring"]);
  });

  it("rings every Instance of a call-site group, applies to all four, and leaves the other call site alone", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    expect(ringKinds()).toEqual(["ring", "ring", "ring", "ring"]);
    expect(row("variant").querySelector("[data-testid=counts]")?.textContent).toBe("SAME ON ALL 4");
    expect(pill("variant", '"ghost"').getAttribute("aria-pressed")).toBe("true");
    expect(row("variant").querySelector("[data-testid=source]")?.textContent).toBe("from the app");

    await clickInPanel(pill("variant", '"default"'));
    expect(row("variant").querySelector("[data-testid=source]")?.textContent).toBe(`from ${GROUP}`);
    expect(variants()).toEqual(["default", "default", "default", "default"]);
    expect(loupe.records().map((record) => record.target)).toEqual([{ scope: "group", anchor: "app/members.tsx › Members › Button[1]" }]);
    expect(loupe.props(MENU).overrides).toEqual({});
    // The pills keep counting the app's own values after the Override is set.
    expect(pill("variant", '"ghost"').textContent).toBe('"ghost" 4');
    expect(pill("variant", '"default"').getAttribute("aria-pressed")).toBe("true");

    // Hovering one row of the Instances list rings only that one.
    act(() => member(ANA).closest("li")?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true })));
    await settle();
    expect(ringKinds()).toEqual(["ring"]);

    // A new selection opens at This instance again, and says which scope its value comes from.
    await backToList();
    await select(ANA);
    expect(scopeButton("instance").getAttribute("aria-pressed")).toBe("true");
    expect(row("variant").querySelector("[data-testid=source]")?.textContent).toBe(`from ${GROUP}`);
    expect(shadow().querySelector("[data-testid=chips]")?.textContent).toBe(GROUP);
  });

  it("leaves one Instance out at its own value, and resetting the group keeps an Instance Override", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await clickInPanel(pill("variant", '"default"'));
    await clickInPanel(member(BIA));
    expect(member(BIA).checked).toBe(false);
    expect(variants()).toEqual(["default", "ghost", "default", "default"]);
    expect(ringKinds().filter((kind) => kind === "out")).toHaveLength(1);
    expect(pill("variant", '"ghost"').textContent).toBe('"ghost" 3');
    // Hovering the left-out row rings it alone, still dashed.
    act(() => member(BIA).closest("li")?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true })));
    await settle();
    expect(ringKinds()).toEqual(["out"]);

    // Ana gets her own value on top of the group's.
    await backToList();
    await select(ANA);
    await clickInPanel(pill("variant", '"ghost"'));
    expect(inRow("variant", "Reset to group value")).toBeTruthy();
    expect(row("variant").querySelector("[data-testid=source]")?.textContent).toBe("from This instance");

    await clickInPanel(scopeButton("group"));
    expect(row("variant").querySelector(".keeping")?.textContent).toBe("1 of 3 keeps its own value");
    await clickInPanel(panelButton("Reset this scope"));
    expect(loupe.records().map((record) => record.target)).toEqual([{ scope: "instance", id: ANA }]);
    expect(variants()).toEqual(["ghost", "ghost", "ghost", "ghost"]);
    expect(loupe.props(ANA).overrides).toEqual({ variant: "ghost" });
  });

  it("selects the Instances a narrower scope keeps, from the row's note", async () => {
    await mount();
    act(() => {
      loupe.set(ANA, "children", "Ana");
    });
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    act(() => {
      loupe.set(BIA, "children", "Membro", "group");
    });
    await settle();
    await clickInPanel(row("children").querySelector(".keeping") as HTMLButtonElement);
    expect(shadow().querySelector("[data-testid=instance-id]")?.textContent).toBe(ANA);
    expect(scopeButton("instance").getAttribute("aria-pressed")).toBe("true");
    expect(inRow("children", "Reset to group value")).toBeTruthy();
  });

  it("notes a narrower value only where this scope overrides the prop", async () => {
    await mount();
    act(() => {
      loupe.set(ANA, "variant", "default");
    });
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    expect(row("variant").querySelector(".keeping")).toBeNull();
    expect(row("variant").querySelector("[data-testid=counts]")?.textContent).toBe("SAME ON ALL 4");
  });

  it("opens at This instance again when a scoped Instance comes back after unmounting", async () => {
    await mount();
    act(() => pageButton("Menu").click());
    await settle();
    const item = loupe.list("MenuItem")[0]?.id as string;
    await select(item);
    await clickInPanel(scopeButton("group"));
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    act(() => pageButton("Menu").click());
    await settle();
    act(() => pageButton("Menu").click());
    await settle();
    expect(scopeButton("instance").getAttribute("aria-pressed")).toBe("true");
  });

  it("counts differing Current values at page scope and leaves a whole call site out in one click", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("page"));
    expect(row("variant").querySelector("[data-testid=counts]")?.textContent).toBe('"ghost" 4 · not set 1');
    expect(ringKinds()).toHaveLength(5);
    expect(shadow().querySelectorAll("fieldset.site")).toHaveLength(2);

    await clickInPanel(shadow().querySelector(`input[data-site="app/members.tsx › Members › Button[2]"]`) as HTMLInputElement);
    expect(loupe.records()[0]?.excluded).toEqual([MENU]);
    await clickInPanel(pill("variant", '"default"'));
    expect(loupe.props(MENU).overrides).toEqual({});
    expect(variants()).toEqual(["default", "default", "default", "default"]);

    await backToList();
    await select(MENU);
    expect(shadow().querySelector("[data-testid=chips]")?.textContent).toBe("Left out of All on page");
  });

  it("offers a State prop at This instance only", async () => {
    await mount();
    await select(DIALOG);
    await clickInPanel(scopeButton("group"));
    expect(row("open").querySelector("[data-testid=state-only]")?.textContent).toBe("Change it on one Instance.");
    expect(row("open").querySelectorAll(".pills")).toHaveLength(0);
    // `modal` isn't a State prop: it keeps its pills, and its conflicting default selects none.
    expect(row("modal").querySelectorAll(".pills")).toHaveLength(1);
  });
});

describe("onRegistryChange", () => {
  it("fires when an Instance mounts, commits and unmounts", () => {
    const calls = vi.fn();
    const stop = onRegistryChange(calls);
    act(() => root.render(<Button {...(site(1, ["variant"]) as object)} variant="ghost" />));
    const mounted = calls.mock.calls.length;
    expect(mounted).toBeGreaterThan(0);
    act(() => root.render(null));
    expect(calls.mock.calls.length).toBeGreaterThan(mounted);
    stop();
  });
});

describe("LoupeMount", () => {
  it("is the null stub outside development, and loads the Toolbar from inside the NODE_ENV condition", async () => {
    const { LoupeMount: stub } = await import("../mount.js");
    expect(stub()).toBeNull();
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(`${process.cwd()}/src/mount.ts`, "utf8");
    // The bundler folds the condition; the import has to be inside it to be dropped with it.
    expect(source).toMatch(/process\.env\.NODE_ENV === "development"\s*\?\s*devMount\(lazy\(\(\) => import\("\.\/toolbar\/index\.js"\)\)\)/);
    expect(source.match(/import\(/g)).toHaveLength(1);
  });
});
