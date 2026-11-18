// @vitest-environment jsdom
// The Toolbar's wiring (PER-214): that the panel redraws as the page changes, that
// selecting, Pick, Hide and the outline work, and that each button makes the
// `__loupe` call its data names. What the panel shows is `panel-view.test.tsx`'s,
// asked of `panelView()` directly.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { resetLoupe } from "../runtime/slot.js";
import { disableOverrides, onRegistryChange } from "../runtime/registry.js";
import Toolbar from "./index.js";
import { ANA, BIA, Button, CONFIRM, DIALOG, members, MENU, Page, site } from "./members.fixture.js";
import { HOST_ATTRIBUTE } from "./styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LoupeMount = devMount(Toolbar);

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;

beforeEach(() => {
  resetLoupe();
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

async function mount(onRowClick: (member: string) => void = () => {}, page: { confirmTotal?: number } = {}) {
  act(() =>
    root.render(
      <>
        <Page onRowClick={onRowClick} {...page} />
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
const hover = async (element: Element) => {
  act(() => element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true })));
  await settle();
};
const pageButton = (text: string) => [...container.querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;
const panelButton = (text: string) =>
  [...shadow().querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;
const select = async (id: string) =>
  clickInPanel(instanceButtons().find((button) => button.dataset.instance === id) as HTMLButtonElement);
const backToList = async () => clickInPanel(panelButton("All components"));
const row = (prop: string) => shadow().querySelector<HTMLElement>(`[data-prop=${prop}]`) as HTMLElement;
const inRow = (prop: string, text: string) =>
  [...row(prop).querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;
const pill = (prop: string, option: string) =>
  row(prop).querySelector<HTMLButtonElement>(`button[data-option='${option}']`) as HTMLButtonElement;
const textField = () => row("children").querySelector("textarea") as HTMLTextAreaElement;
const type = async (field: HTMLTextAreaElement, text: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
};
const scopeButton = (scope: string) => shadow().querySelector<HTMLButtonElement>(`[data-scope=${scope}]`) as HTMLButtonElement;
const member = (id: string) => shadow().querySelector<HTMLInputElement>(`input[data-member="${id}"]`) as HTMLInputElement;
const ringKinds = () => [...shadow().querySelectorAll<HTMLElement>(".ring")].map((ring) => ring.dataset.ring);
const variants = () => ["ana", "bia", "caio", "dani"].map((name) => pageButton(name).dataset.variant);

describe("the Toolbar", () => {
  it("redraws the list as a menu mounts and unmounts", async () => {
    await mount();
    expect(panelText()).toContain("Button ×5");
    expect(panelText()).not.toContain("MenuItem");

    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).toContain("MenuItem ×1");

    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).not.toContain("MenuItem ×1");
  });

  it("selects from the list, and goes back to it", async () => {
    await mount();
    await select(BIA);
    expect(shadow().querySelector("[data-testid=instance-id]")?.textContent).toBe(BIA);
    // What a library set: one collapsed line.
    const injected = [...shadow().querySelectorAll("details")].at(-1) as HTMLDetailsElement;
    expect(injected.querySelector("summary")?.textContent).toBe("1 set by the library");
    expect(injected.open).toBe(false);
    await backToList();
    expect(shadow().querySelector("[data-testid=instance-id]")).toBeNull();
    expect(panelText()).toContain("On this page");
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

  it("shows the Overrides-off banner and turns Reset all off when the React self-check fails", async () => {
    await mount();
    act(() => {
      loupe.set(ANA, "variant", "default");
    });
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    await settle();
    expect(shadow().querySelector(".banner")?.textContent).toContain("Everything is inspect-only");
    expect(panelButton("Reset all").disabled).toBe(true);
  });

  it("Reset all drops every record, including one whose Instance isn't mounted", async () => {
    await mount();
    act(() => pageButton("Menu").click());
    await settle();
    const item = loupe.list("MenuItem")[0]?.id as string;
    act(() => {
      loupe.set(item, "children", "Sair");
      loupe.set(ANA, "variant", "default");
    });
    act(() => pageButton("Menu").click());
    await settle();
    expect(() => loupe.reset(item)).toThrow(/No mounted Instance/);
    expect(panelText()).toContain("2 Overrides on this page");

    await clickInPanel(panelButton("Reset all"));
    expect(loupe.records()).toEqual([]);
    expect(panelText()).toContain("0 Overrides on this page");
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

describe("controls at This instance", () => {
  it("overrides an option on one Instance and resets it", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(pill("variant", '"default"'));
    expect(loupe.props(BIA).overrides).toEqual({ variant: "default" });
    expect(pageButton("bia").dataset.variant).toBe("default");
    // Only this Instance: the other rows keep the app's value.
    expect(pageButton("ana").dataset.variant).toBe("ghost");
    expect(row("variant").querySelector("[data-testid=current]")?.textContent).toBe('Current: "ghost"');

    await clickInPanel(inRow("variant", "Reset"));
    expect(loupe.props(BIA).overrides).toEqual({});
    expect(pageButton("bia").dataset.variant).toBe("ghost");
  });

  it("edits label text in a field and resets the whole Instance", async () => {
    await mount();
    await select(BIA);
    const field = textField();
    expect(field.value).toBe("bia");
    await type(field, "Bianca");
    await clickInPanel(pill("variant", '"default"'));
    expect(loupe.props(BIA).overrides).toEqual({ children: "Bianca", variant: "default" });
    expect(container.textContent).toContain("Bianca");

    const resetInstance = panelButton("Reset this Instance");
    expect(resetInstance.disabled).toBe(false);
    await clickInPanel(resetInstance);
    expect(loupe.records()).toEqual([]);
    expect(pageButton("bia")).toBeTruthy();
    expect(resetInstance.disabled).toBe(true);
  });

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
    await clickInPanel(panelButton("Reset this Instance"));
    expect(loupe.records()).toEqual([]);
    expect(loupe.lastSeen(item)).toBeNull();
  });

  it("resets a held State prop from its notice", async () => {
    await mount();
    await select(DIALOG);
    await clickInPanel(pill("open", "true"));
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
    act(() => pageButton("Abrir").click());
    await settle();
    // The app tries to close it: the Override holds, and the row says so, with its Reset.
    act(() => pageButton("Fechar").click());
    await settle();
    const notice = row("open").querySelector("[data-testid=held]") as HTMLElement;
    expect(notice.textContent).toBe("Your Override holds this at true; the app tried to set false. Reset");
    await clickInPanel([...notice.querySelectorAll("button")].find((button) => button.textContent === "Reset") as HTMLButtonElement);
    expect(container.querySelector("[role=dialog]")).toBeNull();
    expect(row("open").querySelector("[data-testid=held]")).toBeNull();
  });
});

describe("group and page scopes", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
  });

  it("switches to a group, rings and changes all four, and opens a new selection at This instance", async () => {
    await mount();
    await select(BIA);
    expect(ringKinds()).toEqual(["ring"]);
    await clickInPanel(scopeButton("group"));
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    expect(ringKinds()).toEqual(["ring", "ring", "ring", "ring"]);

    await clickInPanel(pill("variant", '"default"'));
    expect(variants()).toEqual(["default", "default", "default", "default"]);
    expect(loupe.records().map((record) => record.target)).toEqual([{ scope: "group", anchor: members("Button", 1) }]);
    expect(loupe.props(MENU).overrides).toEqual({});

    // Hovering one row of the Instances list rings only that one.
    await hover(member(ANA).closest("li") as HTMLElement);
    expect(ringKinds()).toEqual(["ring"]);

    await backToList();
    await select(ANA);
    expect(scopeButton("instance").getAttribute("aria-pressed")).toBe("true");
  });

  it("leaves one Instance out with its box, rings it dashed, and resetting the group keeps an Instance Override", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await clickInPanel(pill("variant", '"default"'));
    await clickInPanel(member(BIA));
    expect(member(BIA).checked).toBe(false);
    expect(variants()).toEqual(["default", "ghost", "default", "default"]);
    expect(ringKinds().filter((kind) => kind === "out")).toHaveLength(1);
    // Hovering the left-out row rings it alone, still dashed.
    await hover(member(BIA).closest("li") as HTMLElement);
    expect(ringKinds()).toEqual(["out"]);

    // Ana gets her own value on top of the group's.
    await backToList();
    await select(ANA);
    await clickInPanel(pill("variant", '"ghost"'));
    expect(inRow("variant", "Reset to group value")).toBeTruthy();

    await clickInPanel(scopeButton("group"));
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

  it("leaves a whole call site out of the page scope in one click", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("page"));
    expect(ringKinds()).toHaveLength(5);
    await clickInPanel(shadow().querySelector(`input[data-site="${MENU}"]`) as HTMLInputElement);
    expect(loupe.records()[0]?.excluded).toEqual([MENU]);
    await clickInPanel(pill("variant", '"default"'));
    expect(loupe.props(MENU).overrides).toEqual({});
    expect(variants()).toEqual(["default", "default", "default", "default"]);
  });
});

describe("the Text row (PER-137)", () => {
  it("is a single-line field that grows, applies live, and may be left empty", async () => {
    await mount();
    await select(BIA);
    expect(row("children").querySelector(".name")?.textContent).toBe("Text children");
    const field = textField();
    // It grows to its text: the height follows the content.
    Object.defineProperty(field, "scrollHeight", { configurable: true, get: () => 42 });
    await type(field, "Bianca Souza");
    expect(loupe.props(BIA).overrides).toEqual({ children: "Bianca Souza" });
    // The same field: the first keystroke makes an Override, and typing must not lose focus to a remount.
    expect(textField()).toBe(field);
    expect(pageButton("Bianca Souza")).toBeTruthy();
    expect(textField().style.height).toBe("42px");

    // Enter inserts no line break, and a pasted one becomes a space.
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => textField().dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    await type(textField(), "Bianca\nSouza");
    expect(loupe.props(BIA).overrides).toEqual({ children: "Bianca Souza" });

    await type(textField(), "");
    expect(loupe.props(BIA).overrides).toEqual({ children: "" });
    expect(row("children").querySelector("[data-testid=empty]")?.textContent).toBe("empty");

    await clickInPanel(inRow("children", "Reset"));
    expect(loupe.props(BIA).overrides).toEqual({});
    expect(textField().value).toBe("bia");
    expect(row("children").querySelector("[data-testid=empty]")).toBeNull();
  });

  it("is changed for a whole call site, and reset", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    const field = textField();
    await type(field, "Membro");
    expect(textField()).toBe(field);
    expect(loupe.records().map((record) => [record.target, record.values])).toEqual([
      [{ scope: "group", anchor: members("Button", 1) }, { children: "Membro" }],
    ]);
    expect([...container.querySelectorAll("li button")].map((button) => button.textContent)).toEqual(["Membro", "Membro", "Membro", "Membro"]);
    await clickInPanel(inRow("children", "Reset"));
    expect(loupe.records()).toEqual([]);
    expect(pageButton("ana")).toBeTruthy();
  });
});

describe("held for review", () => {
  it("Discard clears a record held for review", async () => {
    await mount();
    act(() => pageButton("Abrir").click());
    await settle();
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    act(() => pageButton("Fechar").click());
    await settle();
    // A same-component call was added above it: the call site now has four uses, which
    // its next render finds.
    await mount(() => {}, { confirmTotal: 4 });
    act(() => pageButton("Abrir").click());
    await settle();
    const review = shadow().querySelector("[data-testid=held-for-review]") as HTMLElement;
    expect(review.textContent).toContain("Code changed here");
    await clickInPanel([...review.querySelectorAll("button")].find((button) => button.textContent === "Discard") as HTMLButtonElement);
    expect(loupe.records()).toEqual([]);
    expect(shadow().querySelector("[data-testid=held-for-review]")).toBeNull();
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
