// @vitest-environment jsdom
// The page's outlines through a scroll (highlight.tsx, page-signal.ts): while it runs,
// they follow their Instances by the scroller's offset, with no box read and no render
// a frame where every one moves with it, and read on every frame where one can't (a
// sticky box); once it settles they are read again and land on their Instances,
// whichever scroller moved them. jsdom lays nothing out: the boxes here are worked out
// from the scroll offsets, as a browser would place them.

import { within } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { Button, site } from "./members.fixture.js";
import { SCROLL_SETTLE } from "./page-signal.js";
import { loadPanel } from "./start.js";
import { HOST_ATTRIBUTE } from "./styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LoupeMount = devMount(Toolbar);
/** How far an outline stands off its Instance (highlight.tsx). */
const GAP = 3;

/**
 * Four row Buttons from one call site: Ana in the page's flow, Bia and Caio in a list
 * that scrolls on its own, Dani in a header that sticks to the window's top.
 */
function ScrollPage() {
  const row = site(1, ["variant"]) as object;
  return (
    <main>
      <p key="ana">
        <Button {...row}>ana</Button>
      </p>
      <div data-testid="list" style={{ overflow: "auto", height: "100px" }}>
        {["bia", "caio"].map((name) => (
          <p key={name}>
            <Button {...row}>{name}</Button>
          </p>
        ))}
      </div>
      <header key="dani" style={{ position: "sticky", top: "0px" }}>
        <Button {...row}>dani</Button>
      </header>
    </main>
  );
}

/** Where the page and the list have scrolled to. */
const offset = { page: 0, list: 0 };
/** Each Button's top in the window, as a browser would lay it out at those offsets. */
const TOPS: Record<string, () => number> = {
  ana: () => 200 - offset.page,
  bia: () => 300 - offset.page + 10 - offset.list,
  caio: () => 300 - offset.page + 60 - offset.list,
  dani: () => Math.max(0, 500 - offset.page),
};

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
let rect: { mock: { calls: unknown[][]; contexts: unknown[] } };

beforeAll(async () => {
  await loadPanel();
});

beforeEach(() => {
  resetLoupe();
  localStorage.setItem(OPEN_KEY, "open");
  offset.page = 0;
  offset.list = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = debugOf();
  Object.defineProperty(document.documentElement, "scrollTop", { configurable: true, get: () => offset.page });
  rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.localName === "button" ? TOPS[this.textContent ?? ""] : undefined;
    return { top: top ? top() : 10, left: 20, width: 80, height: 24 } as DOMRect;
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  delete (document.documentElement as { scrollTop?: number }).scrollTop;
  vi.restoreAllMocks();
});

const wait = (ms: number) => act(async () => await new Promise((resolve) => setTimeout(resolve, ms)));
/** Lets the lazy Toolbar, its effects and its once-a-frame refresh settle. */
const settle = () => wait(50);
/** Past the frame the page signal ticks in. */
const nextFrame = () => wait(40);

const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const screen = () => within(shadow() as unknown as HTMLElement);
const list = () => container.querySelector<HTMLElement>("[data-testid=list]") as HTMLElement;
const clickInPanel = async (element: Element) => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
  await settle();
};
/** The Instance whose Button says `name`. */
const idOf = (name: string) => loupe.list("Button").find((row) => loupe.nodes(row.id)[0]?.textContent === name)?.id as string;

async function mount() {
  act(() =>
    root.render(
      <>
        <ScrollPage />
        <LoupeMount />
      </>,
    ),
  );
  await settle();
  await settle();
  const scroller = list();
  Object.defineProperty(scroller, "scrollTop", { configurable: true, get: () => offset.list });
}

/** Selects the Instance whose Button says `name`, from its component's row in the list. */
async function select(name: string) {
  const id = idOf(name);
  const dot = () => shadow().querySelector<HTMLButtonElement>(`button[data-instance="${id}"]`) as HTMLButtonElement;
  const trigger = dot().closest("[data-fold]")?.querySelector<HTMLButtonElement>(":scope > [data-fold-trigger]");
  if (trigger?.getAttribute("aria-expanded") === "false") {
    await clickInPanel(trigger);
    act(() => trigger.blur());
    await settle();
  }
  await clickInPanel(dot());
}

const selectMultiple = () =>
  clickInPanel(within(screen().getByRole("radiogroup", { name: "Select" })).getByRole("radio", { name: "Select multiple" }));

/** Where each outline is drawn now: its place, moved by its `translate`. */
function drawn(): { top: number; style: number; shifted: boolean }[] {
  return [...shadow().querySelectorAll<HTMLElement>("[data-ring]")].map((ring) => {
    const [, y = "0"] = ring.style.translate === "" ? [] : ring.style.translate.split(" ");
    const style = Number.parseFloat(ring.style.top);
    return { top: style + Number.parseFloat(y), style, shifted: ring.style.translate !== "" };
  });
}
/** Each outline's top, sorted: where it shows. */
const drawnTops = () => drawn().map((ring) => ring.top).sort((a, b) => a - b);
/** Where the outlines of these Buttons belong, sorted. */
const landed = (...names: string[]) => names.map((name) => (TOPS[name] as () => number)() - GAP).sort((a, b) => a - b);

async function scroll(target: "page" | "list", to: number) {
  offset[target] = to;
  act(() => (target === "page" ? document : list()).dispatchEvent(new Event("scroll")));
  await nextFrame();
}
async function scrollEnd(target: "page" | "list") {
  act(() => (target === "page" ? document : list()).dispatchEvent(new Event("scrollend")));
  await wait(SCROLL_SETTLE.endMs + 60);
}
/** The Buttons' boxes read since `from`. */
const buttonReads = (from: number) => rect.mock.contexts.slice(from).filter((element: unknown) => (element as Element).localName === "button").length;

describe("the outlines through a scroll", () => {
  it("follow the page's scroll with no box read and no render, then land where the Instance is once it settles", async () => {
    await mount();
    await select("ana");
    expect(drawnTops()).toEqual(landed("ana"));

    // Its first frame reads the boxes where they are now.
    await scroll("page", 40);
    expect(drawnTops()).toEqual(landed("ana"));
    const placed = drawn()[0]?.style;
    const reads = rect.mock.calls.length;
    for (const to of [80, 120, 160]) {
      await scroll("page", to);
      expect(drawnTops()).toEqual(landed("ana"));
    }
    // Moved by its translate alone: the same place, nothing read.
    expect(drawn().map((ring) => ring.style)).toEqual([placed]);
    expect(buttonReads(reads)).toBe(0);

    await scrollEnd("page");
    // Placed again where it is, its translate gone.
    expect(drawn()).toEqual([{ top: landed("ana")[0], style: landed("ana")[0], shifted: false }]);
    expect(buttonReads(reads)).toBeGreaterThan(0);
  });

  it("follow a nested scroller's scroll, and the page's after it, and land once it settles", async () => {
    await mount();
    await select("bia");
    expect(drawnTops()).toEqual(landed("bia"));
    for (const to of [20, 40, 60]) {
      await scroll("list", to);
      expect(drawnTops()).toEqual(landed("bia"));
    }
    expect(drawn()[0]?.shifted).toBe(true);
    // The page takes the scroll on: read again where they are, then followed.
    for (const to of [30, 60, 90]) {
      await scroll("page", to);
      expect(drawnTops()).toEqual(landed("bia"));
    }
    await scrollEnd("page");
    expect(drawn().map((ring) => ring.shifted)).toEqual([false]);
    expect(drawnTops()).toEqual(landed("bia"));
  });

  it("read every frame where one sits in a sticky header, which stays put, and land once it settles", async () => {
    await mount();
    await select("bia");
    await selectMultiple();
    const all = ["ana", "bia", "caio", "dani"];
    expect(drawnTops()).toEqual(landed(...all));
    const reads = rect.mock.calls.length;
    for (const to of [200, 450, 600]) {
      await scroll("page", to);
      expect(drawnTops()).toEqual(landed(...all));
    }
    // Read, not shifted: the sticky header doesn't move by the scroll.
    expect(drawn().some((ring) => ring.shifted)).toBe(false);
    expect(buttonReads(reads)).toBeGreaterThanOrEqual(3 * all.length);
    await scrollEnd("page");
    expect(drawnTops()).toEqual(landed(...all));
    // Dani's header stuck to the window's top.
    expect(drawnTops()).toContain(-GAP);
  });

  it("leave the outlines alone while a scroller beside the Instances scrolls", async () => {
    await mount();
    await select("ana");
    await scroll("list", 30);
    const reads = rect.mock.calls.length;
    for (const to of [60, 90]) await scroll("list", to);
    expect(buttonReads(reads)).toBe(0);
    expect(drawn()).toEqual([{ top: landed("ana")[0], style: landed("ana")[0], shifted: false }]);
    await scrollEnd("list");
    expect(drawnTops()).toEqual(landed("ana"));
  });
});
