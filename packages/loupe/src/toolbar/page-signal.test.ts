// @vitest-environment jsdom
// The page signal against a jsdom page: how often the page's fibers are walked per
// version, and that nothing watches or reads the page while it is dormant.
import { act, createElement as h, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteHint, callSiteId, SOURCE_ATTRIBUTE } from "../call-site.js";
import { createAdapter } from "../runtime/adapter.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";
import { resetLoupe } from "../runtime/slot.js";
import { createPageSignal, type PageSignal } from "./page-signal.js";

// Every walk of the page starts by finding its React roots: counting those counts walks.
const walks = vi.hoisted(() => ({ count: 0 }));
vi.mock("../runtime/fiber.js", async (actual) => {
  const fiber = await actual<typeof import("../runtime/fiber.js")>();
  return {
    ...fiber,
    rootFibers: (doc: Document) => {
      walks.count++;
      return fiber.rootFibers(doc);
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = { children?: ReactNode; [key: string]: unknown };

const Button = createAdapter("Button", (props: Props) => h("button", props));
/** No Adapter: only a walk of the fibers finds it. */
function Card(props: Props) {
  return h("section", props);
}

const site = (component: string) => ({ path: "app/page.tsx", enclosing: "Page", component, ordinal: 1 });
const loader = (component: string) => ({
  [ANCHOR_ATTRIBUTE]: callSiteId(site(component)),
  [SOURCE_ATTRIBUTE]: callSiteHint(site(component), { line: 10, column: 5, total: 1 }),
});

let setLabel: (label: string) => void = () => {};
function Page() {
  const [label, set] = useState("Save");
  setLabel = set;
  return h("main", null, h(Button, loader("Button"), label), h(Card, loader("Card"), "Body"));
}

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
let signal: PageSignal;
let toolbar: HTMLElement;
const doc = document as unknown as Record<string, unknown>;

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Past the frame the signal publishes in. */
const nextFrame = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));

beforeEach(() => {
  resetLoupe();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const key = Object.keys(container).find((name) => name.startsWith("__reactContainer$")) as string;
  doc.__reactContainer$test = (container as unknown as Record<string, unknown>)[key];
  toolbar = document.createElement("div");
  toolbar.attachShadow({ mode: "open" });
  document.body.append(toolbar);
  loupe = debugOf();
  act(() => root.render(h(Page)));
  signal = createPageSignal({ doc: document, debug: () => loupe, host: () => toolbar });
  walks.count = 0;
});

/** Wakes the signal until the test ends, whatever it asserts. */
const sleeps: (() => void)[] = [];
function wake(): () => void {
  const sleep = signal.wake();
  sleeps.push(sleep);
  return sleep;
}

afterEach(() => {
  for (const sleep of sleeps.splice(0)) sleep();
  act(() => root.unmount());
  container.remove();
  toolbar.remove();
  delete doc.__reactContainer$test;
});

/** Everything the open panel asks of the page for one version. */
function readAll(): void {
  const rows = loupe.list();
  for (const row of rows) {
    loupe.nodes(row.id);
    signal.boxes(row.id);
  }
  loupe.pick(container.querySelector("section") as Element);
  loupe.scan();
}

describe("the page signal, awake", () => {
  it("walks the page once per version, however many views ask, across tasks", async () => {
    const sleep = wake();
    readAll();
    readAll();
    await nextTask();
    readAll();
    expect(walks.count).toBe(1);
    sleep();
  });

  it("walks again once an Instance commits, and publishes the version once", async () => {
    const sleep = wake();
    const heard = vi.fn();
    signal.subscribe(heard);
    readAll();
    const before = signal.version();
    act(() => setLabel("Send"));
    act(() => setLabel("Sent"));
    await nextFrame();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(signal.version()).toBeGreaterThan(before);
    readAll();
    readAll();
    expect(walks.count).toBe(2);
    sleep();
  });

  it("walks again when an element comes or goes outside the Toolbar, not when only text changes", async () => {
    const sleep = wake();
    readAll();
    const clock = document.createElement("time");
    document.body.append(clock);
    await nextFrame();
    readAll();
    expect(walks.count).toBe(2);
    // An animated counter: text only.
    for (let n = 0; n < 5; n++) {
      clock.textContent = String(n);
      await nextTask();
    }
    // The Toolbar's own nodes.
    toolbar.append(document.createElement("div"));
    toolbar.shadowRoot?.append(document.createElement("div"));
    await nextFrame();
    readAll();
    expect(walks.count).toBe(2);
    clock.remove();
    sleep();
  });

  it("reads boxes again, with no walk, when a text or an attribute on the page changes", async () => {
    const sleep = wake();
    readAll();
    const measure = vi.fn();
    signal.onLayout(measure);
    const label = container.querySelector("button") as HTMLElement;
    label.style.marginLeft = "40px";
    (label.firstChild as Text).data = "Saving changes";
    await nextFrame();
    expect(measure).toHaveBeenCalledTimes(1);
    readAll();
    expect(walks.count).toBe(1);
    sleep();
  });

  it("reads boxes on a scroll, not on a still page", async () => {
    const sleep = wake();
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const measure = vi.fn(() => signal.boxes(loupe.list()[0]?.id ?? ""));
    const stop = signal.onLayout(measure);
    await nextFrame();
    await nextFrame();
    expect(measure).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    await nextFrame();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(rect).toHaveBeenCalled();
    stop();
    rect.mockRestore();
    sleep();
  });

  it("stays awake while anyone holds it", () => {
    const first = wake();
    const second = wake();
    first();
    first();
    expect(signal.awake).toBe(true);
    expect(registry().watchers).toBe(1);
    second();
    expect(signal.awake).toBe(false);
    expect(registry().watchers).toBe(0);
  });
});

describe("the page signal, dormant", () => {
  it("listens to nothing: a commit reaches no listener", async () => {
    const heard = vi.fn();
    signal.subscribe(heard);
    const layout = vi.fn();
    signal.onLayout(layout);
    expect(registry().listeners.size).toBe(0);
    const before = registry().version;
    act(() => setLabel("Send"));
    document.body.append(document.createElement("aside"));
    window.dispatchEvent(new Event("scroll"));
    await nextFrame();
    // The runtime still counts the commit, so a walk from before it isn't reused.
    expect(registry().version).toBeGreaterThan(before);
    expect(heard).not.toHaveBeenCalled();
    expect(layout).not.toHaveBeenCalled();
  });

  it("doesn't walk the page on its own, and a walk serves one task only", async () => {
    await nextFrame();
    expect(walks.count).toBe(0);
    readAll();
    readAll();
    expect(walks.count).toBe(1);
    // Nothing watches the DOM: the next task can't trust it.
    await nextTask();
    readAll();
    expect(walks.count).toBe(2);
  });

  it("publishes what changed while it slept once it wakes", async () => {
    act(() => setLabel("Send"));
    const heard = vi.fn();
    signal.subscribe(heard);
    const sleep = wake();
    await nextFrame();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(signal.version()).toBe(registry().version);
    sleep();
  });
});
