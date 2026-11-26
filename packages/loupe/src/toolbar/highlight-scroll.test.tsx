// @vitest-environment jsdom
// The page's outlines through a scroll (highlight.tsx, page-signal.ts): while it runs,
// they follow their Instances by the scroller's offset, with no box read and no render
// a frame where every one moves with it, and read on every frame where one can't (a
// sticky box, a scaled scroller); an outlined scroller stays put while its contents
// scroll; the tags keep to the window's edges; once it settles they are read again and
// land on their Instances, whichever scroller moved them. jsdom lays nothing out: the
// boxes here are worked out from the scroll offsets, as a browser would place them.

import { within } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE } from "../call-site.js";
import { devMount } from "../mount.js";
import { createAdapter } from "../runtime/adapter.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { Button, members, site } from "./members.fixture.js";
import { pageWidth } from "./dock.js";
import { scrolledBy, tagPlace } from "./highlight.js";
import { SCROLL_SETTLE } from "./page-signal.js";
import { loadPanel } from "./start.js";
import { HOST_ATTRIBUTE } from "./styles.js";

// Highlight, wrapped to count its renders; everything inside it is the real code.
const renders = vi.hoisted(() => ({ Highlight: 0 }));
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

const LoupeMount = devMount(Toolbar);
/** How far an outline stands off its Instance (highlight.tsx). */
const GAP = 3;

/** A list that scrolls on its own: its node is the scroller. */
const List = createAdapter("List", (props: { children?: React.ReactNode; style?: React.CSSProperties; "data-testid"?: string }) => <div {...props} />);

/**
 * Four row Buttons from one call site: Ana in the page's flow, Bia and Caio in a List
 * that scrolls on its own, Dani in a header that sticks to the window's top.
 */
function ScrollPage() {
  const row = site(1, ["variant"]) as object;
  return (
    <main>
      <p key="ana">
        <Button {...row}>ana</Button>
      </p>
      <List {...({ [ANCHOR_ATTRIBUTE]: members("List", 1) } as object)} data-testid="list" style={{ overflow: "auto", height: "100px" }}>
        {["bia", "caio"].map((name) => (
          <p key={name}>
            <Button {...row}>{name}</Button>
          </p>
        ))}
      </List>
      <header key="dani" style={{ position: "sticky", top: "0px" }}>
        <Button {...row}>dani</Button>
      </header>
    </main>
  );
}

/** Where the page and the list have scrolled to, and the list's scale. */
const offset = { page: 0, list: 0, scale: 1 };
/** Each Button's top in the window, as a browser would lay it out at those offsets. */
const TOPS: Record<string, () => number> = {
  ana: () => 200 - offset.page,
  bia: () => 300 - offset.page + (10 - offset.list) * offset.scale,
  caio: () => 300 - offset.page + (60 - offset.list) * offset.scale,
  dani: () => Math.max(0, 500 - offset.page),
};
/** The List's own top: its box stays put while its contents scroll. */
const LIST_TOP = () => 290 - offset.page;

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
  offset.scale = 1;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = debugOf();
  Object.defineProperty(document.documentElement, "scrollTop", { configurable: true, get: () => offset.page });
  rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.dataset.testid === "list") return { top: LIST_TOP(), left: 20, width: 200, height: 100 } as DOMRect;
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

/** Selects the Instance whose Button says `name` (or with this id), from its component's row in the list. */
async function select(name: string, id = idOf(name)) {
  const dot = () => shadow().querySelector<HTMLButtonElement>(`button[data-instance="${id}"]`) as HTMLButtonElement;
  const trigger = dot().closest("[data-fold]")?.querySelector<HTMLButtonElement>(":scope > [data-fold-trigger]");
  if (trigger?.getAttribute("aria-expanded") === "false") {
    await clickInPanel(trigger);
    act(() => trigger.blur());
    await settle();
  }
  await clickInPanel(dot());
}

const selectTool = (name: "Select one" | "Select multiple") =>
  clickInPanel(within(screen().getByRole("radiogroup", { name: "Select" })).getByRole("radio", { name }));
const selectMultiple = () => selectTool("Select multiple");

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
    const rendered = renders.Highlight;
    for (const to of [80, 120, 160]) {
      await scroll("page", to);
      expect(drawnTops()).toEqual(landed("ana"));
    }
    // Moved by its translate alone: the same place, nothing read, no render.
    expect(drawn().map((ring) => ring.style)).toEqual([placed]);
    expect(buttonReads(reads)).toBe(0);
    expect(renders.Highlight).toBe(rendered);

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

  it("leave an outlined scroller where it is while its contents scroll", async () => {
    await mount();
    await select("", loupe.list("List")[0]?.id);
    const at = () => [...shadow().querySelectorAll<HTMLElement>("[data-ring]")].map((ring) => ring.style.top + " " + ring.style.translate);
    expect(at()).toEqual([`${LIST_TOP() - GAP}px `]);
    await scroll("list", 30);
    const reads = rect.mock.calls.length;
    for (const to of [60, 90]) await scroll("list", to);
    expect(at()).toEqual([`${LIST_TOP() - GAP}px `]);
    expect(rect.mock.calls.length).toBe(reads);
    await scrollEnd("list");
    expect(at()).toEqual([`${LIST_TOP() - GAP}px `]);
  });

  it("read every frame in a scaled scroller, whose offsets aren't the window's pixels", async () => {
    await mount();
    offset.scale = 0.5;
    list().style.transform = "scale(0.5)";
    await select("bia");
    for (const to of [20, 40, 60]) {
      await scroll("list", to);
      expect(drawnTops()).toEqual(landed("bia"));
    }
    expect(drawn().some((ring) => ring.shifted)).toBe(false);
    await scrollEnd("list");
    expect(drawnTops()).toEqual(landed("bia"));
  });

  it("move the size tag under the outline as it nears the window's top, mid-scroll", async () => {
    await mount();
    await select("ana");
    const below = () => shadow().querySelector("[data-ring-label]")?.hasAttribute("data-below");
    for (const to of [40, 100, 160]) {
      await scroll("page", to);
      expect(drawnTops()).toEqual(landed("ana"));
      expect(below()).toBe(false);
    }
    // Ana's top at 10: under 24px from the window's top, the tag goes under the outline.
    await scroll("page", 190);
    expect(drawnTops()).toEqual(landed("ana"));
    expect(below()).toBe(true);
    await scroll("page", 196);
    expect(drawn()[0]?.shifted).toBe(true);
    expect(below()).toBe(true);
  });

  it("place the pick tag again from its moved outline, below it once there is no room above", async () => {
    await mount();
    await selectTool("Select one");
    act(() => (container.querySelector("button") as HTMLButtonElement).dispatchEvent(new MouseEvent("pointermove", { bubbles: true, composed: true })));
    await settle();
    const tag = () => shadow().querySelector<HTMLElement>("[data-pick-tag]") as HTMLElement;
    expect(tag().dataset.pickTag).toBe(idOf("ana"));
    const tagAt = () => {
      const [x = "0", y = "0"] = tag().style.translate === "" ? [] : tag().style.translate.split(" ");
      return { top: Number.parseFloat(tag().style.top) + Number.parseFloat(y), left: Number.parseFloat(tag().style.left) + Number.parseFloat(x) };
    };
    const expected = () =>
      tagPlace({ top: (TOPS.ana?.() ?? 0) - GAP, left: 20 - GAP, width: 80 + GAP * 2, height: 24 + GAP * 2 }, { width: 0, height: 0 }, { width: pageWidth() || window.innerWidth, height: window.innerHeight });
    for (const to of [40, 120, 180, 196, 230]) {
      await scroll("page", to);
      expect(drawnTops()).toEqual(landed("ana"));
      expect(tagAt()).toEqual(expected());
    }
    // Followed, not read: and past the window's top, the tag went under the outline.
    expect(drawn()[0]?.shifted).toBe(true);
    expect(tagAt().top).toBeGreaterThan(landed("ana")[0] ?? 0);
    await scrollEnd("page");
    expect(tag().style.translate).toBe("");
    expect(tagAt()).toEqual(expected());
  });
});

describe("scrolledBy", () => {
  it("finds a node in what a scroller scrolls through a shadow root, and not the scroller itself", () => {
    const scroller = document.createElement("div");
    const host = document.createElement("section");
    const inside = document.createElement("span");
    host.attachShadow({ mode: "open" }).append(inside);
    scroller.append(host);
    document.body.append(scroller);
    expect(scrolledBy(inside, scroller)).toBe(true);
    expect(scrolledBy(host, scroller)).toBe(true);
    expect(scrolledBy(scroller, scroller)).toBe(false);
    expect(scrolledBy(inside, document.createElement("div"))).toBe(false);
    scroller.remove();
  });
});
