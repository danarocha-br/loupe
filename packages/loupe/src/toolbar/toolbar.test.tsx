// @vitest-environment jsdom
// The Toolbar's wiring (PER-214): that the panel redraws as the page changes, that
// selecting, the select tools, Hide and the outline work, and that each button makes the
// `__loupe` call its data names. What the panel shows is `panel-view.test.tsx`'s,
// asked of `panelView()` directly.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import { disableOverrides, onRegistryChange } from "../runtime/registry.js";
import { resetLoupe } from "../runtime/slot.js";
import { LINGER, tagPlace } from "./highlight.js";
import Toolbar from "./index.js";
import { ANA, BIA, Button, CONFIRM, DIALOG, members, MENU, Page, site } from "./members.fixture.js";
import { HOST_ATTRIBUTE } from "./styles.js";
import { dismissUndo } from "./undo.js";

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
  loupe = debugOf();
});

afterEach(() => {
  // The offer has no timer (undo.ts): one test's must not reach the next.
  act(() => dismissUndo());
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
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
/** An option of the row's table; for a true/false prop, its switch, which sets the other value. */
const pill = (prop: string, option: string) =>
  (row(prop).querySelector<HTMLButtonElement>(`button[data-option='${option}']`) ??
    row(prop).querySelector<HTMLButtonElement>(`[role=switch][aria-checked="${option === "true" ? "false" : "true"}"]`)) as HTMLButtonElement;
const textField = () => row("children").querySelector("textarea") as HTMLTextAreaElement;
const type = async (field: HTMLTextAreaElement, text: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
};
const scopeButton = (scope: string) => shadow().querySelector<HTMLButtonElement>(`[data-scope=${scope}]`) as HTMLButtonElement;
/** Ends picking, which a select tool arms, so the page's own clicks go through again. */
const escape = async () => {
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  await settle();
};
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
    // A component's name is never cut short: it may break only where its words meet, "Menu·Item".
    const menuItem = [...shadow().querySelectorAll(".group summary .cname")].find((name) => name.textContent === "MenuItem");
    expect(menuItem?.querySelectorAll("wbr")).toHaveLength(1);

    act(() => pageButton("Menu").click());
    await settle();
    expect(panelText()).not.toContain("MenuItem ×1");
  });

  it("selects from the list, and goes back to it", async () => {
    await mount();
    await select(BIA);
    expect(shadow().querySelector("[data-testid=instance-id]")?.getAttribute("data-id")).toBe(BIA);
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
    const pick = [...shadow().querySelectorAll("button")].find((button) => button.textContent === "Select one") as HTMLButtonElement;
    await clickInPanel(pick);
    expect(pick.classList.contains("armed")).toBe(true);

    act(() => {
      pageButton("caio").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
      pageButton("caio").click();
    });
    await settle();
    expect(clicked).toEqual([]);
    expect(shadow().querySelector("[data-testid=instance-id]")?.getAttribute("data-id")).toBe("app/members.tsx › Members › Button[1]#caio");
    expect(pick.classList.contains("armed")).toBe(false);

    // Picking is off again: the page's own clicks go through.
    act(() => pageButton("dani").click());
    expect(clicked).toEqual(["dani"]);
  });

  it("lets Esc and Hide end picking, after which the page's clicks go through", async () => {
    const clicked: string[] = [];
    await mount((member) => clicked.push(member));
    const button = (text: string) => [...shadow().querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;
    await clickInPanel(button("Select one"));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    await settle();
    expect(button("Select one").classList.contains("armed")).toBe(false);
    act(() => pageButton("ana").click());
    expect(clicked).toEqual(["ana"]);

    await clickInPanel(button("Select one"));
    await clickInPanel(button("Hide panel"));
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
    expect(panelText()).toContain("2 changes");

    const before = loupe.records();
    await clickInPanel(panelButton("Reset all"));
    expect(loupe.records()).toEqual([]);
    expect(panelText()).toContain("0 changes");

    // It asked nothing, so the footer offers to put them back.
    expect(shadow().querySelector(".undo")?.textContent).toBe("Reset 2 OverridesUndo");
    await clickInPanel(panelButton("Undo"));
    expect(loupe.records().map((record) => record.values)).toEqual(before.map((record) => record.values));
    expect(panelText()).toContain("2 changes");
    expect(shadow().querySelector(".undo")?.textContent).toBe("");
  });

  it("outlines every Instance a change reaches, a few pixels out, numbered in the panel", async () => {
    await mount();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
    act(() => {
      loupe.set(ANA, "variant", "outline");
    });
    await settle();
    const marks = [...shadow().querySelectorAll<HTMLElement>(".mark")];
    expect(marks.map((mark) => mark.dataset.mark)).toEqual(["1"]);
    expect([marks[0]?.style.top, marks[0]?.style.left, marks[0]?.style.width, marks[0]?.style.height]).toEqual(["7px", "17px", "86px", "30px"]);
    // No number on the page: it is on the change's row.
    expect(marks[0]?.textContent).toBe("");
    expect(shadow().querySelector(".keylist")?.textContent).toContain("1variant");
  });

  it("rings the selected Instance on the page", async () => {
    await mount();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
    await clickInPanel(instanceButtons()[0] as HTMLButtonElement);
    const ring = shadow().querySelector<HTMLElement>(".ring");
    expect(ring?.style.top).toBe("7px");
    // Tagged with its component and the size of its box.
    expect(ring?.textContent).toBe("Button · 80 × 24");
  });

  it("outlines what a row names when the pointer comes straight from the page", async () => {
    await mount();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
    // React skips an enter whose pointer left an element it renders: only `mouseover` sees it.
    const fromPage = async (element: Element) => {
      act(() => element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true, relatedTarget: pageButton("ana") })));
      await settle();
    };
    const leave = async (element: Element) => {
      act(() => element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, composed: true, relatedTarget: pageButton("ana") })));
      await settle();
    };
    const buttonRow = [...shadow().querySelectorAll("summary")].find((summary) => summary.querySelector(".cname")?.textContent === "Button");
    await fromPage(buttonRow as HTMLElement);
    expect(ringKinds()).toEqual(["hover", "hover", "hover", "hover", "hover"]);
    await leave(buttonRow as HTMLElement);
    expect(ringKinds()).toEqual([]);

    const instance = instanceButtons().find((button) => button.dataset.instance === BIA) as HTMLButtonElement;
    await fromPage(instance);
    expect(ringKinds()).toEqual(["hover"]);
    await leave(instance);

    // The selection card's Instances, and a page scope's call sites.
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await escape();
    await fromPage(member(ANA).closest("li") as HTMLElement);
    expect(ringKinds()).toEqual(["member"]);
    await leave(member(ANA).closest("li") as HTMLElement);
    await clickInPanel(scopeButton("page"));
    const menuSite = shadow().querySelector(`input[data-site="${MENU}"]`)?.closest("label") as HTMLElement;
    await fromPage(menuSite);
    expect(ringKinds()).toEqual(["member"]);
  });

  it("adds its methods to __loupe as it mounts, and again after resetLoupe()", async () => {
    const methods = ["proposal", "proposalText"];
    const onLoupe = () => methods.filter((name) => typeof (debugOf() as unknown as Record<string, unknown>)[name] === "function");
    await mount();
    expect(onLoupe()).toEqual(methods);
    act(() => root.unmount());
    resetLoupe();
    expect(onLoupe()).toEqual([]);
    root = createRoot(container);
    await mount();
    expect(onLoupe()).toEqual(methods);
  });
});

describe("controls at This instance", () => {
  it("moves through a table of options with the arrow keys, one Tab stop for the table (critique 2026-11-20)", async () => {
    await mount();
    await select(BIA);
    const radios = () => [...row("variant").querySelectorAll<HTMLButtonElement>("[role=radio]")];
    expect(row("variant").querySelector("[role=radiogroup]")).not.toBeNull();
    // One stop: the chosen option, the app's ghost.
    expect(radios().filter((radio) => radio.tabIndex === 0).map((radio) => radio.dataset.option)).toEqual(['"ghost"']);
    const at = radios().findIndex((radio) => radio.dataset.option === '"ghost"');
    const next = radios()[(at + 1) % radios().length] as HTMLButtonElement;
    act(() => {
      radios()[at]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true }));
    });
    await settle();
    expect(next.getAttribute("aria-checked")).toBe("true");
    expect(loupe.props(BIA).overrides).toEqual({ variant: JSON.parse(next.dataset.option as string) });
  });

  it("overrides an option on one Instance and resets it", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(pill("variant", '"default"'));
    expect(loupe.props(BIA).overrides).toEqual({ variant: "default" });
    expect(pageButton("bia").dataset.variant).toBe("default");
    // Only this Instance: the other rows keep the app's value.
    expect(pageButton("ana").dataset.variant).toBe("ghost");
    // The row reads from the app's value to the Override's.
    expect(row("variant").querySelector("[data-testid=change]")?.textContent).toBe('"ghost" → "default"');

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
    // With nothing left to reset, the button goes rather than sitting disabled (critique 2026-11-20).
    expect(panelButton("Reset this Instance")).toBeUndefined();

    // It asked nothing, so the footer offers to put both back (review 2026-11-20).
    expect(shadow().querySelector(".undo")?.textContent).toBe("Reset 2 OverridesUndo");
    await clickInPanel(panelButton("Undo"));
    expect(loupe.props(BIA).overrides).toEqual({ children: "Bianca", variant: "default" });
    expect(shadow().querySelector(".undo")?.textContent).toBe("");
  });

  it("keeps the undo offer until the Overrides change some other way", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(pill("variant", '"default"'));
    await clickInPanel(panelButton("Reset all"));
    expect(shadow().querySelector(".undo")?.textContent).toBe("Reset 1 OverrideUndo");
    // Redraws that change no Override leave it (it has no timer either: undo.test.ts).
    await settle();
    expect(shadow().querySelector(".undo")?.textContent).toBe("Reset 1 OverrideUndo");
    // A new change ends it: putting the old records back would undo this one too.
    await type(textField(), "Bianca");
    await settle();
    expect(shadow().querySelector(".undo")?.textContent).toBe("");
    expect(loupe.props(BIA).overrides).toEqual({ children: "Bianca" });
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

  it("switches to a group with Select multiple, rings and changes all four, and keeps the tool for the next selection", async () => {
    await mount();
    await select(BIA);
    expect(ringKinds()).toEqual(["ring"]);
    await clickInPanel(scopeButton("group"));
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    // The selected one solid, the others from its call site dashed.
    expect(ringKinds()).toEqual(["member", "ring", "member", "member"]);

    await clickInPanel(pill("variant", '"default"'));
    expect(variants()).toEqual(["default", "default", "default", "default"]);
    expect(loupe.records().map((record) => record.target)).toEqual([{ scope: "group", anchor: members("Button", 1) }]);
    expect(loupe.props(MENU).overrides).toEqual({});

    // Hovering one row of the Instances list outlines only that one.
    await hover(member(ANA).closest("li") as HTMLElement);
    expect(ringKinds()).toEqual(["member"]);

    // The select tool is kept: the next selection opens at its call site too.
    await backToList();
    await select(ANA);
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    expect(member(BIA).checked).toBe(true);
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

    // Ana gets her own value on top of the group's, with Select one.
    await backToList();
    await select(ANA);
    await clickInPanel(scopeButton("instance"));
    await clickInPanel(pill("variant", '"ghost"'));
    expect(inRow("variant", "Reset to group value")).toBeTruthy();

    await clickInPanel(scopeButton("group"));
    await clickInPanel(panelButton("Reset this scope"));
    expect(loupe.records().map((record) => record.target)).toEqual([{ scope: "instance", id: ANA }]);
    expect(variants()).toEqual(["ghost", "ghost", "ghost", "ghost"]);
    expect(loupe.props(ANA).overrides).toEqual({ variant: "ghost" });
    expect(shadow().querySelector(".undo")?.textContent).toBe("Reset 1 OverrideUndo");
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
    expect(shadow().querySelector("[data-testid=instance-id]")?.getAttribute("data-id")).toBe(ANA);
    expect(scopeButton("instance").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps Select multiple when a scoped Instance comes back after unmounting", async () => {
    await mount();
    act(() => pageButton("Menu").click());
    await settle();
    const item = loupe.list("MenuItem")[0]?.id as string;
    await select(item);
    await clickInPanel(scopeButton("group"));
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    await escape();
    act(() => pageButton("Menu").click());
    await settle();
    act(() => pageButton("Menu").click());
    await settle();
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    expect(shadow().querySelector("[data-testid=members]")).not.toBeNull();
  });

  it("widens Select multiple to the page, and leaves a whole call site out of it in one click", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await clickInPanel(scopeButton("page"));
    expect(ringKinds()).toHaveLength(5);
    await clickInPanel(shadow().querySelector(`input[data-site="${MENU}"]`) as HTMLInputElement);
    expect(loupe.records()[0]?.excluded).toEqual([MENU]);
    await clickInPanel(pill("variant", '"default"'));
    expect(loupe.props(MENU).overrides).toEqual({});
    expect(variants()).toEqual(["default", "default", "default", "default"]);
  });
});

describe("hovering the page while a select tool is armed", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
  });

  /** Moves the pointer onto an element, of the page or of the panel. */
  const pointTo = async (element: Element) => {
    act(() => element.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, composed: true })));
    await settle();
  };
  const tag = () => shadow().querySelector<HTMLElement>(".pick-tag");
  const CAIO = "app/members.tsx › Members › Button[1]#caio";

  it("outlines and tags the Instance under the pointer, in place of the selection, until the pointer leaves the page", async () => {
    await mount();
    await select(BIA);
    expect(ringKinds()).toEqual(["ring"]);
    await clickInPanel(panelButton("Select one"));

    await pointTo(pageButton("caio"));
    expect(ringKinds()).toEqual(["pick"]);
    expect(tag()?.textContent).toBe("Button");
    expect(tag()?.dataset.tag).toBe(CAIO);

    // Onto another one, then onto the panel: nothing on the page is hovered there.
    await pointTo(pageButton("Menu"));
    expect(tag()?.dataset.tag).toBe(MENU);
    await pointTo(panelButton("Select one"));
    expect(ringKinds()).toEqual(["ring"]);
    expect(tag()).toBeNull();

    // Out of the window, and Esc: the selection's outline is back, untagged.
    await pointTo(pageButton("dani"));
    act(() => window.dispatchEvent(new MouseEvent("pointerout", { relatedTarget: null })));
    await settle();
    expect(tag()).toBeNull();
    await pointTo(pageButton("dani"));
    await escape();
    expect(ringKinds()).toEqual(["ring"]);
    expect(tag()).toBeNull();
  });

  it("in Select multiple, outlines every Instance a click would select and counts them on the tag", async () => {
    await mount();
    await clickInPanel(panelButton("Select multiple"));

    await pointTo(pageButton("caio"));
    expect(ringKinds()).toEqual(["pick", "pick", "pick", "pick"]);
    expect(tag()?.textContent).toBe("Button · 4 from this call site");
    expect(tag()?.dataset.tag).toBe(CAIO);

    // Along the same call site, the outlines stay and the tag moves.
    await pointTo(pageButton("ana"));
    expect(ringKinds()).toEqual(["pick", "pick", "pick", "pick"]);
    expect(tag()?.dataset.tag).toBe(ANA);

    // The Menu's call site has one.
    await pointTo(pageButton("Menu"));
    expect(ringKinds()).toEqual(["pick"]);
    expect(tag()?.textContent).toBe("Button · 1 from this call site");

    // The click selects what was outlined.
    act(() => pageButton("caio").click());
    await settle();
    expect(scopeButton("group").getAttribute("aria-pressed")).toBe("true");
    expect(ringKinds()).toEqual(["member", "member", "ring", "member"]);
    expect(tag()).toBeNull();
  });

  it("dashes an Instance left out of the call site's group, as the click will", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await clickInPanel(pill("variant", '"default"'));
    await clickInPanel(member(BIA));
    await backToList();
    // Re-scoping armed Select multiple, and it stays armed.
    expect(panelButton("Select multiple").classList.contains("armed")).toBe(true);

    await pointTo(pageButton("ana"));
    expect(ringKinds()).toEqual(["pick", "out", "pick", "pick"]);
    expect(tag()?.textContent).toBe("Button · 4 from this call site");
  });

  it("says Inspect only of an Instance no Override can reach, and previews it alone in Select multiple", async () => {
    await mount();
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    await settle();
    await clickInPanel(panelButton("Select multiple"));

    await pointTo(pageButton("caio"));
    expect(ringKinds()).toEqual(["pick"]);
    expect(tag()?.textContent).toBe("Button · Inspect only");
    expect(tag()?.querySelector(".detail")?.textContent).toBe(" · Inspect only");
  });
});

describe("leaving a selection, and hiding the marks", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
  });

  const selectedId = () => shadow().querySelector("[data-testid=instance-id]")?.getAttribute("data-id") ?? null;
  /** A click with the pointer: a keyboard's or a script's has no `detail`. */
  const press = async (element: Element) => {
    act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 })));
    await settle();
  };
  const keyEscape = async (target: EventTarget) => {
    act(() => target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true })));
    await settle();
  };
  const hideMarks = () => shadow().querySelector<HTMLButtonElement>("button[data-marks]") as HTMLButtonElement;
  const changeOutlines = () => shadow().querySelectorAll(".mark").length;
  const status = () => shadow().querySelector(".status-line")?.textContent ?? "";

  it("goes back to the list on Esc, and the app still gets the key", async () => {
    await mount();
    const keys: string[] = [];
    const listen = (event: KeyboardEvent) => keys.push(event.key);
    document.addEventListener("keydown", listen);
    await select(BIA);
    await keyEscape(document.body);
    document.removeEventListener("keydown", listen);
    expect(selectedId()).toBeNull();
    expect(panelText()).toContain("On this page");
    expect(ringKinds()).toEqual([]);
    expect(keys).toEqual(["Escape"]);
  });

  it("leaves Esc to a select tool first, to the app's open dialog, and to a text field", async () => {
    await mount();
    await select(ANA);
    // Armed, Esc stops picking and keeps the selection; the next Esc deselects.
    await clickInPanel(panelButton("Select one"));
    await escape();
    expect(panelButton("Select one").classList.contains("armed")).toBe(false);
    expect(selectedId()).toBe(ANA);

    // The app's dialog closes on its own Esc.
    act(() => pageButton("Abrir").click());
    await settle();
    await escape();
    expect(selectedId()).toBe(ANA);
    act(() => pageButton("Fechar").click());
    await settle();

    await keyEscape(textField());
    expect(selectedId()).toBe(ANA);

    await escape();
    expect(selectedId()).toBeNull();
  });

  it("goes back to the list on a click on the page outside the selection, which still reaches the app", async () => {
    const clicked: string[] = [];
    await mount((member) => clicked.push(member));
    await select(BIA);
    await press(pageButton("ana"));
    expect(clicked).toEqual(["ana"]);
    expect(selectedId()).toBeNull();
  });

  it("keeps the selection on a click on a selected Instance, in the panel, or from the keyboard", async () => {
    const clicked: string[] = [];
    await mount((member) => clicked.push(member));
    await select(BIA);
    await press(pageButton("bia"));
    await press(shadow().querySelector(".panel") as HTMLElement);
    act(() => pageButton("ana").click());
    await settle();
    expect(clicked).toEqual(["bia", "ana"]);
    expect(selectedId()).toBe(BIA);

    // With Select multiple, every Instance from the call site is selected; another one isn't.
    await clickInPanel(scopeButton("group"));
    await escape();
    await press(pageButton("dani"));
    expect(selectedId()).toBe(BIA);
    await press(pageButton("Menu"));
    expect(selectedId()).toBeNull();
    expect(clicked).toEqual(["bia", "ana", "dani"]);
  });

  it("hides the selection's outlines and the changes', keeping the selection, the preview and a hovered row", async () => {
    await mount();
    act(() => {
      loupe.set(MENU, "variant", "default");
    });
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await escape();
    expect(ringKinds()).toEqual(["member", "ring", "member", "member"]);
    expect(changeOutlines()).toBe(1);

    await clickInPanel(hideMarks());
    expect(hideMarks().getAttribute("aria-pressed")).toBe("true");
    expect(ringKinds()).toEqual([]);
    expect(changeOutlines()).toBe(0);
    expect(selectedId()).toBe(BIA);
    expect(status()).toBe("Outlines are hidden on the page");

    // What follows the pointer still shows: a hovered row of the Instances list, and a pick's preview.
    await hover(member(ANA).closest("li") as HTMLElement);
    expect(ringKinds()).toEqual(["member"]);
    act(() => member(ANA).closest("li")?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, composed: true })));
    await settle();
    expect(ringKinds()).toEqual([]);
    await clickInPanel(panelButton("Select one"));
    act(() => pageButton("caio").dispatchEvent(new MouseEvent("pointermove", { bubbles: true, composed: true })));
    await settle();
    expect(ringKinds()).toEqual(["pick"]);
    await escape();

    // Select one re-scoped the selection to BIA alone.
    await clickInPanel(hideMarks());
    expect(hideMarks().getAttribute("aria-pressed")).toBe("false");
    expect(ringKinds()).toEqual(["ring"]);
    expect(changeOutlines()).toBe(1);
    expect(status()).toBe("");
  });
});

describe("a change landing on the page", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, left: 20, width: 80, height: 24 } as DOMRect);
    LINGER.ms = 120;
  });
  afterEach(() => {
    LINGER.ms = 2000;
  });

  /** Longer than the shortened linger. */
  const linger = async () => {
    for (let i = 0; i < 4; i++) await settle();
  };
  const quiet = () => [...shadow().querySelectorAll<HTMLElement>(".ring, .mark")].map((outline) => outline.classList.contains("quiet"));
  const changeRow = () => shadow().querySelector<HTMLButtonElement>(".keylist button") as HTMLButtonElement;
  const footerKey = () => shadow().querySelector<HTMLButtonElement>(".footer-keys button") as HTMLButtonElement;
  const leave = async (element: Element) => {
    act(() => element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, composed: true })));
    await settle();
  };

  it("outlines what a change reaches as it lands, then fades the outlines, the selection's too", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await escape();
    // Nothing has changed yet: the selection stays outlined.
    await linger();
    expect(quiet()).toEqual([false, false, false, false]);

    await clickInPanel(pill("variant", '"default"'));
    expect(quiet()).toEqual([false, false, false, false]);
    await linger();
    expect(ringKinds()).toEqual(["member", "ring", "member", "member"]);
    expect(quiet()).toEqual([true, true, true, true]);

    // Pointing at the change in the footer outlines what it reaches again, while pointed.
    await hover(footerKey());
    expect(quiet()).toEqual([false, false, false, false]);
    await leave(footerKey());
    expect(quiet()).toEqual([true, true, true, true]);
    act(() => footerKey().focus());
    await settle();
    expect(quiet()).toEqual([false, false, false, false]);
    act(() => footerKey().blur());
    await settle();
    expect(quiet()).toEqual([true, true, true, true]);

    // Another value lands again, under the same number.
    await clickInPanel(pill("variant", '"ghost"'));
    expect(quiet()).toEqual([false, false, false, false]);
    await linger();
    expect(quiet()).toEqual([true, true, true, true]);
  });

  it("with nothing selected, outlines a change's Instances while its row is pointed at, and on selecting one", async () => {
    await mount();
    await select(BIA);
    await clickInPanel(scopeButton("group"));
    await escape();
    await clickInPanel(pill("variant", '"default"'));
    await backToList();
    await linger();
    expect(shadow().querySelectorAll(".mark").length).toBe(4);
    expect(quiet()).toEqual([true, true, true, true]);

    // Its own dashed outline, not a grey hover one; and pointed at straight from the app's page.
    act(() => changeRow().dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true, relatedTarget: pageButton("ana") })));
    await settle();
    expect(quiet()).toEqual([false, false, false, false]);
    expect(ringKinds()).toEqual([]);
    await leave(changeRow());
    expect(quiet()).toEqual([true, true, true, true]);

    // Focus on the row outlines the same, so a keyboard sees what the change reaches (review 2026-11-20).
    act(() => changeRow().focus());
    await settle();
    expect(quiet()).toEqual([false, false, false, false]);
    act(() => changeRow().blur());
    await settle();
    expect(quiet()).toEqual([true, true, true, true]);

    // Selecting one it reaches shows the selection a moment, then it steps back.
    await select(ANA);
    expect(quiet()).toEqual([false, false, false, false]);
    await linger();
    expect(quiet()).toEqual([true, true, true, true]);
  });
});

describe("tagPlace", () => {
  const page = { width: 1000, height: 700 };
  const size = { width: 120, height: 21 };

  it("sits on the ring's top left", () => {
    expect(tagPlace({ top: 100, left: 40, width: 200, height: 30 }, size, page)).toEqual({ top: 75, left: 40 });
  });

  it("goes below the ring when there is no room above", () => {
    expect(tagPlace({ top: 10, left: 40, width: 200, height: 30 }, size, page)).toEqual({ top: 44, left: 40 });
  });

  it("goes inside the ring's top when it fills the page", () => {
    expect(tagPlace({ top: -50, left: 0, width: 1000, height: 900 }, size, page)).toEqual({ top: 6, left: 6 });
  });

  it("slides back onto the page at either side", () => {
    expect(tagPlace({ top: 100, left: 950, width: 40, height: 30 }, size, page).left).toBe(874);
    expect(tagPlace({ top: 100, left: -30, width: 40, height: 30 }, size, page).left).toBe(6);
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
    const held = loupe.records();
    await clickInPanel([...review.querySelectorAll("button")].find((button) => button.textContent === "Discard") as HTMLButtonElement);
    expect(loupe.records()).toEqual([]);
    expect(shadow().querySelector("[data-testid=held-for-review]")).toBeNull();

    // Discard asks nothing either: the footer offers the held record back, still held.
    expect(shadow().querySelector(".undo")?.textContent).toBe("Discarded 1 held OverrideUndo");
    await clickInPanel(panelButton("Undo"));
    expect(loupe.records().map(({ target, values, suspended }) => ({ target, values, suspended: suspended !== null }))).toEqual(
      held.map(({ target, values }) => ({ target, values, suspended: true })),
    );
  });
});

describe("keyboard focus (review 2026-11-20)", () => {
  const focusIn = (element: HTMLElement) => act(() => element.focus());

  it("follows a selection made in the panel to the new view's heading, and back to the list's", async () => {
    await mount();
    const bia = instanceButtons().find((button) => button.dataset.instance === BIA) as HTMLButtonElement;
    focusIn(bia);
    await clickInPanel(bia);
    expect(shadow().activeElement).toBe(shadow().querySelector("h2.name"));
    const back = panelButton("All components");
    focusIn(back);
    await clickInPanel(back);
    expect(panelText()).toContain("Nothing selected");
    expect(shadow().activeElement).toBe(shadow().querySelector("h2.name"));
  });

  it("leaves focus alone when nothing in the panel had it, as after a pick on the page", async () => {
    await mount();
    await select(BIA);
    expect(shadow().activeElement).toBeNull();
  });

  it("moves focus to Undo after Reset all, and back to Reset all once Undo is taken", async () => {
    await mount();
    act(() => {
      loupe.set(ANA, "variant", "default");
    });
    await settle();
    focusIn(panelButton("Reset all"));
    await clickInPanel(panelButton("Reset all"));
    expect(shadow().activeElement?.textContent).toBe("Undo");
    await clickInPanel(panelButton("Undo"));
    await settle();
    expect(loupe.props(ANA).overrides).toEqual({ variant: "default" });
    expect(shadow().activeElement).toBe(panelButton("Reset all"));
  });

  it("speaks English whatever the app's language, and reads the app's own names in the app's", async () => {
    document.documentElement.lang = "pt-BR";
    try {
      await mount();
      expect(document.querySelector(`[${HOST_ATTRIBUTE}]`)?.getAttribute("lang")).toBe("en");
      await select(BIA);
      expect(shadow().querySelector("h2.name")?.getAttribute("lang")).toBe("pt-BR");
    } finally {
      document.documentElement.removeAttribute("lang");
    }
  });

  it("hands focus between Hide and the tab that shows the panel again", async () => {
    await mount();
    focusIn(panelButton("Hide panel"));
    await clickInPanel(panelButton("Hide panel"));
    const tab = shadow().querySelector<HTMLButtonElement>(".show-tab") as HTMLButtonElement;
    expect(tab.getAttribute("aria-label")).toBe("Show Loupe");
    expect(shadow().activeElement).toBe(tab);
    await clickInPanel(tab);
    expect(shadow().activeElement).toBe(shadow().querySelector("h2.name"));
  });

  it("keeps its live regions in place while they are empty, so what lands in them is announced", async () => {
    await mount();
    expect(shadow().querySelector(".status-region")?.getAttribute("role")).toBe("status");
    expect(shadow().querySelector(".status-region")?.textContent).toBe("");
    expect(shadow().querySelector(".footer .undo")?.getAttribute("role")).toBe("status");
    await clickInPanel(panelButton("Select one"));
    expect(shadow().querySelector(".status-region")?.textContent).toContain("Click an Instance on the page");
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
