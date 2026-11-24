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

import { act, type ComponentType, type ReactElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

// Vite transforms the panel's module graph once per file; the first test to open the panel
// would otherwise spend its wait on that, not on the Toolbar. Importing it here only warms
// the transforms: `vi.resetModules()` gives each test a fresh `start.js`, its panel unloaded.
beforeAll(async () => {
  await import("./open.js");
}, 60_000);

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

/** Takes the page's Instances off it, or puts them back, as a route change would. */
let showPage: (shown: boolean) => void = () => {};

function Harness() {
  const [shown, setShown] = useState(true);
  showPage = setShown;
  return (
    <>
      {shown && <Page onRowClick={() => {}} />}
      <LoupeMount />
    </>
  );
}

async function mount() {
  act(() => root.render(<Harness />));
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
const heading = () => shadow().querySelector<HTMLElement>("h2");
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

describe("changes made through __loupe with the panel closed", () => {
  type Change = { id: string; scope: string; onScreenAtExport: boolean; props: { current?: unknown; proposed?: unknown }[] };
  const proposal = () =>
    (debugOf() as unknown as { proposal(): Promise<{ routes: { changes: Change[] }[] }> }).proposal().then((made) => made.routes.flatMap((route) => route.changes));
  const buttons = () => debugOf().list("Button").map((row) => row.id);

  it("keeps an edited Instance as last seen when it unmounts before the panel's module has loaded", async () => {
    await mount();
    const [ana] = buttons();
    act(() => {
      debugOf().set(ana as string, "variant", "outline");
      // In the same task: nothing async has run since the change.
      showPage(false);
    });
    await settle();
    const [change] = await proposal();
    expect(change).toMatchObject({ scope: "instance", onScreenAtExport: false, props: [{ current: "ghost", proposed: "outline" }] });
  });

  it("numbers changes made in one batch in the order they were made, the module cold or loaded", async () => {
    for (const preload of [false, true]) {
      resetLoupe();
      await reload();
      if (preload) await start.loadPanel();
      const [ana, , , , menu] = buttons();
      act(() => {
        debugOf().set(ana as string, "variant", "outline", "group");
        debugOf().set(menu as string, "variant", "outline");
      });
      await settle();
      const changes = await proposal();
      expect(changes.map((change) => [change.id, change.scope]), preload ? "preloaded" : "cold").toEqual([
        ["c1", "call-site"],
        ["c2", "instance"],
      ]);
    }
  });
});

describe("a panel that can't load", () => {
  /** The panel's module fails to load, as when its chunk is gone or the dev server restarts. */
  const breakPanel = () => {
    vi.doMock("./open.js", () => {
      throw new Error("chunk gone");
    });
  };
  /** An error the host's page would see: React reports one that no boundary caught here. */
  const uncaught: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    uncaught.push(event.error);
    event.preventDefault();
  };
  beforeEach(() => {
    uncaught.length = 0;
    window.addEventListener("error", onError);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    window.removeEventListener("error", onError);
    vi.doUnmock("./open.js");
    vi.restoreAllMocks();
  });

  it("folds back to the pill on a click, gives the page its column back, and loads on the next click", async () => {
    breakPanel();
    await mount();
    act(() => pill()?.focus());
    await click(pill() as HTMLButtonElement);
    await until(() => pill() !== null);
    expect(panel()).toBeNull();
    expect(document.documentElement.style.marginRight).toBe("");
    expect(shadow().activeElement).toBe(pill());
    expect(uncaught).toEqual([]);
    expect(console.warn).toHaveBeenCalled();

    vi.doUnmock("./open.js");
    await click(pill() as HTMLButtonElement);
    await until(() => panel() !== null);
    expect(uncaught).toEqual([]);
  });

  it("shows the pill when a panel left open can't load on a fresh page load", async () => {
    breakPanel();
    localStorage.setItem(OPEN_KEY, "open");
    await mount();
    await until(() => pill() !== null);
    expect(panel()).toBeNull();
    expect(document.documentElement.style.marginRight).toBe("");
    expect(uncaught).toEqual([]);
    // Still kept open: the next page load tries again.
    expect(localStorage.getItem(OPEN_KEY)).toBe("open");
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

  it("opens a panel left open on a fresh page load, the page making room while its module loads", async () => {
    localStorage.setItem(OPEN_KEY, "open");
    // The panel's module is held until the test lets it go, so "before it has loaded" is
    // true by construction: a bare tick races the import, which CI's runner won (2026-11-23).
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.doMock("./open.js", async () => {
      await gate;
      return await vi.importActual("./open.js");
    });
    try {
      act(() => root.render(<Harness />));
      // Before the module has loaded: the column is already the panel's.
      await act(async () => {});
      await settle();
      expect(loaded()).toBe(false);
      expect(document.documentElement.style.marginRight).not.toBe("");
      expect(panel()).toBeNull();
      release();
      await until(() => panel() !== null);
      expect(pill()).toBeNull();
      expect(trackersStarted()).toBe(true);
    } finally {
      release();
      vi.doUnmock("./open.js");
    }
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
