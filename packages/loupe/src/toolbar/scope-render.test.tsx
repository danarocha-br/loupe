// @vitest-environment jsdom
// A scope switch re-renders the rows it changes, not every row (2026-11-24,
// `panel-view/share.ts`): `panelView()` hands back the last view's object for every
// row deeply equal to it, so React Compiler's memoised PropRow skips it. PropRow is
// wrapped to count its renders by prop; everything else is the real code, compiled
// as in `dist`.

import { within } from "@testing-library/dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { BIA, Page } from "./members.fixture.js";
import { loadPanel } from "./start.js";
import { HOST_ATTRIBUTE } from "./styles.js";

const renders = vi.hoisted(() => new Map<string, number>());

vi.mock("./patterns/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patterns/index.js")>();
  return {
    ...actual,
    PropRow(props: Parameters<typeof actual.PropRow>[0]) {
      renders.set(props.item.name, (renders.get(props.item.name) ?? 0) + 1);
      return actual.PropRow(props);
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// The open panel's module, loaded first, so the panel opens in the mount.
beforeAll(async () => {
  await loadPanel();
});

beforeEach(() => {
  resetLoupe();
  renders.clear();
  localStorage.setItem(OPEN_KEY, "open");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
});

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const screen = () => within(shadow() as unknown as HTMLElement);
const click = async (element: Element) => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
  await settle();
};
const selectTool = (name: "Select one" | "Select multiple") =>
  within(screen().getByRole("radiogroup", { name: "Select" })).getByRole("radio", { name });
const counted = () => Object.fromEntries(renders);

/** The panel open on Bia's Inspector, picked from the list as a designer does. */
async function inspectBia(): Promise<void> {
  const LoupeMount = devMount(Toolbar);
  act(() =>
    root.render(
      <>
        <Page onRowClick={() => {}} />
        <LoupeMount />
      </>,
    ),
  );
  await settle();
  await settle();
  const dot = shadow().querySelector<HTMLButtonElement>(`button[data-instance="${BIA}"]`) as HTMLButtonElement;
  const trigger = dot.closest("[data-fold]")?.querySelector<HTMLButtonElement>(":scope > [data-fold-trigger]");
  if (trigger) await click(trigger);
  await click(dot);
  // Escape leaves picking alone: the Inspector shows Bia.
  expect(screen().getByRole("heading", { level: 2 }).textContent).toContain("bia");
}

it("re-renders only the rows a scope switch changes, not every row", async () => {
  await inspectBia();
  expect(Object.keys(counted()).sort()).toEqual(["children", "onClick", "render", "variant"]);
  renders.clear();

  await click(selectTool("Select multiple"));
  expect(selectTool("Select multiple").getAttribute("aria-checked")).toBe("true");
  // At the call site's scope the Editable rows count its four members: they change.
  expect(shadow().querySelector("[data-prop=variant]")?.textContent).toContain("Same on all 4");
  // `onClick`'s source ("from the app") is decided at This instance only; `render`, read
  // the same at either scope, is the last view's own row and skips its render.
  expect(counted()).toEqual({ children: 1, variant: 1, onClick: 1 });

  renders.clear();
  await click(selectTool("Select one"));
  expect(counted()).toEqual({ children: 1, variant: 1, onClick: 1 });
});

it("re-renders none of the selected Instance's rows when something else on the page changes", async () => {
  await inspectBia();
  renders.clear();
  // The Menu opens: a MenuItem mounts, the page's version moves, and Bia's rows read the same.
  act(() => ([...container.querySelectorAll("button")].find((button) => button.textContent === "Menu") as HTMLButtonElement).click());
  await settle();
  await settle();
  expect(container.querySelector("[role=menuitem]")).not.toBeNull();
  expect(counted()).toEqual({});
});
