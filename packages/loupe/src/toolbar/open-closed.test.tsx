// @vitest-environment jsdom
// The collapsed pill costs the page little (2026-11-23, candidate 7 of the
// architecture review): the open panel is a module of its own (`open.tsx`) that
// loads on the first open, or earlier, on idle or with the pointer over the pill;
// whether the panel was left open is kept in this browser; and the trackers the
// Proposal reads start on the first open, or the first change, not at mount.
//
// Each test loads the Toolbar afresh (`vi.resetModules()`), so each starts with the
// panel's module not loaded by it. That the pill's own modules never import it is
// `build.test.ts`'s, on what the build emits. Loupe's page state is on `globalThis` (`slot.ts`), so
// the fresh modules and this file's share it.

import { act, type ComponentType, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoupeDebug } from "../runtime/debug.js";
import { resetLoupe } from "../runtime/slot.js";
import { OPEN_KEY } from "./launcher-place.js";
import { HOST_ATTRIBUTE } from "./styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Fixture = typeof import("./members.fixture.js");

let container: HTMLDivElement;
let root: Root;
let LoupeMount: () => ReactElement | null;
let Page: Fixture["Page"];
let debugOf: () => LoupeDebug;
let start: typeof import("./start.js");
/** The page's idle callbacks, run only when a test says the page is idle. */
let idle: (() => void)[] = [];
/** Whether this Toolbar has loaded the open panel's module. */
const loaded = () => start.loadedPanel() !== null;

beforeEach(async () => {
  vi.resetModules();
  idle = [];
  vi.stubGlobal("requestIdleCallback", (run: () => void) => idle.push(run));
  vi.stubGlobal("cancelIdleCallback", () => {});
  localStorage.clear();
  resetLoupe();
  const [{ devMount }, toolbar, fixture, debug, startModule] = await Promise.all([
    import("../mount.js"),
    import("./index.js"),
    import("./members.fixture.js"),
    import("../runtime/debug.js"),
    import("./start.js"),
  ]);
  start = startModule;
  LoupeMount = devMount(toolbar.default as ComponentType);
  Page = fixture.Page;
  debugOf = debug.debugOf;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  vi.unstubAllGlobals();
});

/** Lets the lazy Toolbar, its effects and its once-a-frame refresh settle. */
const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));

async function mount() {
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
}

/** A page load: the page unmounts, Loupe starts over, the page mounts again. Storage stays. */
async function reload() {
  act(() => root.unmount());
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  resetLoupe();
  root = createRoot(container);
  await mount();
}

const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const pill = () => shadow().querySelector<HTMLButtonElement>(".launcher");
const panel = () => shadow().querySelector(".panel");
const heading = () => shadow().querySelector<HTMLElement>("h2.name");
const click = async (element: Element) => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
  await settle();
};
/** Until the condition holds: the panel's module loads through Vite in a test, which can take longer than a settle. */
async function until(condition: () => boolean) {
  for (let tries = 0; tries < 100 && !condition(); tries += 1) await settle();
  expect(condition()).toBe(true);
}
const trackersStarted = () => {
  const state = (globalThis as Record<symbol, Map<string, unknown> | undefined>)[Symbol.for("loupe.state")];
  return state?.has("tracker") === true && state.has("changeNumbers");
};

describe("the collapsed pill", () => {
  it("starts closed on a first visit, loading nothing of the panel and starting no tracker", async () => {
    await mount();
    expect(pill()?.getAttribute("aria-label")).toBe("Show Loupe");
    expect(panel()).toBeNull();
    expect(loaded()).toBe(false);
    expect(trackersStarted()).toBe(false);
    // The acceptance surface is there all the same.
    expect(typeof (debugOf() as unknown as Record<string, unknown>).proposal).toBe("function");
  });

  it("loads the panel on the first open, then starts the trackers and gives its heading focus", async () => {
    await mount();
    const button = pill() as HTMLButtonElement;
    act(() => button.focus());
    expect(loaded()).toBe(false);
    await click(button);
    await until(() => heading() !== null);
    expect(loaded()).toBe(true);
    expect(trackersStarted()).toBe(true);
    // Focus was on the pill: it goes to the heading once the panel is there, as it does when it opens in the click.
    expect(shadow().activeElement).toBe(heading());
  });

  it("loads the panel's module with the pointer over the pill, so the click opens it at once", async () => {
    await mount();
    // jsdom has no PointerEvent: React makes its pointer-enter from a `pointerover` from outside.
    act(() => pill()?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true, composed: true, relatedTarget: null })));
    await until(loaded);
    // Loaded, not opened: nothing watches the page yet.
    expect(panel()).toBeNull();
    expect(trackersStarted()).toBe(false);
    act(() => pill()?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
    // In the click itself: no wait for a module.
    expect(panel()).not.toBeNull();
  });

  it("loads the panel's module once the page is idle", async () => {
    await mount();
    expect(loaded()).toBe(false);
    expect(idle).toHaveLength(1);
    act(() => idle.forEach((run) => run()));
    await until(loaded);
    expect(panel()).toBeNull();
  });

  it("starts the trackers on the first change made through __loupe with the panel closed", async () => {
    await mount();
    const [row] = debugOf().list("Button");
    act(() => {
      debugOf().set(row?.id as string, "variant", "outline");
    });
    await until(trackersStarted);
    expect(panel()).toBeNull();
    const proposal = await (debugOf() as unknown as { proposal(): Promise<{ routes: { changes: unknown[] }[] }> }).proposal();
    expect(proposal.routes.flatMap((route) => route.changes)).toHaveLength(1);
  });
});

describe("open or closed, kept in this browser", () => {
  it("opens on a reload once it was left open, and stays closed once it was hidden", async () => {
    await mount();
    await click(pill() as HTMLButtonElement);
    await until(() => panel() !== null);
    expect(localStorage.getItem(OPEN_KEY)).toBe("open");

    await reload();
    await until(() => panel() !== null);
    expect(pill()).toBeNull();

    const hide = [...shadow().querySelectorAll("button")].find((button) => button.textContent === "Hide panel") as HTMLButtonElement;
    await click(hide);
    expect(panel()).toBeNull();
    expect(localStorage.getItem(OPEN_KEY)).toBe("closed");

    await reload();
    expect(panel()).toBeNull();
    expect(pill()).not.toBeNull();
  });

  it("starts closed when storage can't be read", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    try {
      await mount();
      expect(panel()).toBeNull();
      expect(pill()).not.toBeNull();
    } finally {
      read.mockRestore();
    }
  });
});
