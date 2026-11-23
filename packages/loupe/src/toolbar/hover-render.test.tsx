// @vitest-environment jsdom
// A hover re-renders the outlines, not the whole Panel (ADR 0003's fifth check, ADR 0004:
// React Compiler runs on toolbar/). Panel and Highlight are wrapped to count their renders;
// everything inside them is the real code, compiled as in `dist`.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { Page } from "./members.fixture.js";
import { loadPanel } from "./start.js";
import { HOST_ATTRIBUTE } from "./styles.js";

const renders = vi.hoisted(() => ({ Panel: 0, Highlight: 0 }));

vi.mock("./panel.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./panel.js")>();
  return {
    ...actual,
    Panel(props: Parameters<typeof actual.Panel>[0]) {
      renders.Panel++;

      return actual.Panel(props);
    },
  };
});

vi.mock("./highlight.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./highlight.js")>();
  return {
    ...actual,
    Highlight(props: Parameters<typeof actual.Highlight>[0]) {
      renders.Highlight++;
      return actual.Highlight(props);
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

it("re-renders the outlines on a row's hover, and not the Panel", async () => {
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
  const shadow = document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
  const rows = [...shadow.querySelectorAll<HTMLElement>(".group summary")];
  expect(rows.length).toBeGreaterThan(1);

  const before = { ...renders };
  for (const row of rows.slice(0, 2)) {
    act(() => row.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true })));
    await settle();
    act(() => row.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, composed: true, relatedTarget: document.body })));
    await settle();
  }
  // The page outlines what the row points at: Highlight drew it.
  expect(renders.Highlight).toBeGreaterThan(before.Highlight);
  expect(renders.Panel).toBe(before.Panel);
});
