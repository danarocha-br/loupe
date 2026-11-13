// @vitest-environment jsdom
import { act, createElement as h, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteId, instanceId } from "../call-site.js";
import { createAdapter } from "../runtime/adapter.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { disableOverrides, registry } from "../runtime/registry.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// What the page looked like each time it was rasterized: the rasterizer is the
// browser's job, so the test records what it would have drawn.
type Seen = { variants: string[]; dialog: string | null; covered: boolean; transitions: boolean };
const rasterized: Seen[] = [];

vi.mock("./project-server.js", () => ({
  readProjectContext: async () => ({ repo: "orbix-ai", commit: "abcdef1", dirty: false, playgroundVersion: "0.0.3" }),
}));
vi.mock("./flags.js", () => ({ previewedFlags: async () => [], FlagsCard: () => null }));

vi.mock("modern-screenshot", () => ({
  domToCanvas: vi.fn(async () => {
    rasterized.push({
      variants: [...document.querySelectorAll("button")].map((node) => node.dataset.variant ?? ""),
      dialog: document.querySelector("[data-open]")?.getAttribute("data-open") ?? null,
      covered: document.querySelector("div[data-loupe-capture]") !== null,
      transitions: ![...document.querySelectorAll("style")].some((style) => style.textContent?.includes("transition: none")),
    });
    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.dataset.raster = String(rasterized.length);
    return canvas;
  }),
}));

const {
  captureScreen,
  changesOnScreen,
  cropRects,
  exportableSnapshots,
  isOutdated,
  removeSnapshot,
  snapshotBytes,
  snapshots,
  CROP_PADDING,
} = await import("./snapshots.js");
const { collectProposal } = await import("./proposal.js");
const { SnapshotsCard } = await import("./snapshots-card.js");

type Box = [top: number, left: number, width: number, height: number];
type ButtonProps = { variant?: string; box: Box };

const Button = createAdapter("Button", ({ variant = "default", box }: ButtonProps) =>
  h("button", { "data-variant": variant, "data-box": box.join(",") }),
);
type DialogProps = { open?: boolean; onOpenChange?: (open: boolean) => void; box: Box };
const Dialog = createAdapter(
  "Dialog",
  ({ open, box }: DialogProps) => h("div", { "data-open": String(open), "data-box": box.join(",") }),
  { state: ["open"] },
);

const TRIGGER = callSiteId({ path: "app/membros/menu.tsx", enclosing: "MemberRowMenu", component: "Button", ordinal: 1 });
const DIALOG = callSiteId({ path: "app/membros/menu.tsx", enclosing: "MemberRowMenu", component: "Dialog", ordinal: 1 });
const DIALOG_ID = instanceId(DIALOG, "dialog");

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
const drawn: number[][] = [];

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  delete (globalThis as { __loupeSnapshots?: unknown }).__loupeSnapshots;
  rasterized.length = 0;
  drawn.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
  // jsdom lays nothing out: each node says where it is.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const [top = 0, left = 0, width = 0, height = 0] = (this.getAttribute("data-box") ?? "").split(",").map(Number);
    return { top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON() {} } as DOMRect;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const target = this;
    return {
      drawImage: (source: HTMLCanvasElement, ...args: number[]) => {
        target.dataset.from = source.dataset.raster;
        drawn.push(args);
      },
    } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement, type?: string) {
    return `data:${type ?? "image/png"};base64,${this.dataset.raster ?? `crop-of-${this.dataset.from}`}`;
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

// Four member rows; the fourth is below the fold (jsdom's viewport is 1024×768).
const rows: Box[] = [
  [100, 600, 32, 32],
  [150, 600, 32, 32],
  [200, 600, 32, 32],
  [900, 600, 32, 32],
];

function membros(): ReactElement {
  return h(
    "div",
    null,
    rows.map((box, index) =>
      h("section", { key: `user_${index + 1}` }, h(Button, { variant: "ghost", box, [ANCHOR_ATTRIBUTE]: TRIGGER } as ButtonProps)),
    ),
    h("aside", { key: "dialog" }, h(Dialog, { open: false, onOpenChange: () => {}, box: [300, 300, 400, 200], [ANCHOR_ATTRIBUTE]: DIALOG } as DialogProps)),
  );
}

const capture = async (options?: Parameters<typeof captureScreen>[0]) => {
  let result: Awaited<ReturnType<typeof captureScreen>> | undefined;
  await act(async () => {
    result = await captureScreen(options);
  });
  return result as Awaited<ReturnType<typeof captureScreen>>;
};

function setUp() {
  act(() => root.render(membros()));
  act(() => {
    loupe.set(instanceId(TRIGGER, "user_1"), "variant", "outline", "group");
    loupe.set(DIALOG_ID, "open", true);
  });
}

describe("Capture screen", () => {
  it("rasterizes after, then before under a still of the page, with the dialog held open in both", async () => {
    setUp();
    const snapshot = await capture();

    expect(rasterized).toEqual([
      { variants: ["outline", "outline", "outline", "outline"], dialog: "true", covered: false, transitions: false },
      { variants: ["ghost", "ghost", "ghost", "ghost"], dialog: "true", covered: true, transitions: false },
    ]);
    // Back as it was, and nothing left on the page.
    expect(registry().store.view).toBe("proposed");
    expect([...container.querySelectorAll("button")].map((node) => node.dataset.variant)).toEqual(Array(4).fill("outline"));
    expect(document.querySelector("[data-loupe-capture]")).toBeNull();
    expect(document.querySelector("style")).toBeNull();

    expect(snapshot.viewport).toEqual({
      before: "data:image/webp;base64,2",
      after: "data:image/webp;base64,1",
      failedImages: 0,
    });
    // One crop pair for the group change, around the three rows on screen; State
    // props make no crop of their own.
    expect(snapshot.crops).toEqual([
      {
        change: `group:${TRIGGER}`,
        keyPath: null,
        more: 0,
        before: "data:image/webp;base64,crop-of-2",
        after: "data:image/webp;base64,crop-of-1",
        failedImages: 0,
      },
    ]);
    const p = CROP_PADDING;
    expect(drawn[0]).toEqual([600 - p, 100 - p, 32 + 2 * p, 132 + 2 * p, 0, 0, 32 + 2 * p, 132 + 2 * p]);
    expect(snapshot.shown.map((entry) => entry.identity.id)).toEqual([
      instanceId(TRIGGER, "user_1"),
      instanceId(TRIGGER, "user_2"),
      instanceId(TRIGGER, "user_3"),
      DIALOG_ID,
    ]);
    expect(snapshot.bytes).toBe(snapshot.viewport.before.length * 2 + 2 * "data:image/webp;base64,crop-of-1".length);
    expect(snapshotBytes()).toBe(snapshot.bytes);
  });

  it("is Outdated, and not exported, once an Override it showed changes", async () => {
    setUp();
    const snapshot = await capture();
    expect(isOutdated(snapshot)).toBe(false);
    expect(exportableSnapshots()).toHaveLength(1);

    act(() => loupe.set(instanceId(TRIGGER, "user_1"), "variant", "secondary", "group"));
    expect(isOutdated(snapshot)).toBe(true);
    expect(exportableSnapshots()).toEqual([]);
    expect(snapshotBytes()).toBe(0);

    // A State prop it showed counts too: closing the dialog changes the screen.
    act(() => loupe.set(instanceId(TRIGGER, "user_1"), "variant", "outline", "group"));
    expect(isOutdated(snapshot)).toBe(false);
    act(() => loupe.reset(DIALOG_ID, "open"));
    expect(isOutdated(snapshot)).toBe(true);
  });

  it("is Outdated once Overrides drop to inspect-only: the page no longer shows what it showed", async () => {
    setUp();
    const snapshot = await capture();
    expect(isOutdated(snapshot)).toBe(false);
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    expect(isOutdated(snapshot)).toBe(true);
    expect(exportableSnapshots()).toEqual([]);
  });

  it("ignores an Override on an Instance it didn't show", async () => {
    setUp();
    const snapshot = await capture();
    act(() => loupe.set(instanceId(TRIGGER, "user_4"), "variant", "secondary"));
    expect(isOutdated(snapshot)).toBe(false);
  });

  it("Retake keeps the place and number, Remove drops it, and an export replaces its own last one", async () => {
    setUp();
    const first = await capture();
    const second = await capture();
    expect(snapshots().map((snapshot) => snapshot.id)).toEqual([1, 2]);

    const retaken = await capture({ replace: first.id });
    expect(retaken.id).toBe(1);
    expect(snapshots().map((snapshot) => [snapshot.id, snapshot.capturedAt])).toEqual([
      [1, retaken.capturedAt],
      [2, second.capturedAt],
    ]);

    const auto = await capture({ auto: true });
    const again = await capture({ auto: true });
    expect(again.id).toBe(auto.id);
    expect(snapshots().map((snapshot) => [snapshot.id, snapshot.auto])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);

    removeSnapshot(2);
    expect(snapshots().map((snapshot) => snapshot.id)).toEqual([1, 3]);

    // A Retake on another page would replace it with a picture of the wrong page.
    history.pushState(null, "", "/elsewhere");
    try {
      await expect(captureScreen({ replace: 1 })).rejects.toThrow("Snapshot 1 was taken on /: open that page to retake it.");
    } finally {
      history.pushState(null, "", "/");
    }
  });

  it("runs one capture at a time", async () => {
    setUp();
    let both: unknown[] = [];
    await act(async () => {
      both = await Promise.all([captureScreen(), captureScreen()]);
    });
    expect(both).toHaveLength(2);
    expect(rasterized.map((seen) => seen.covered)).toEqual([false, true, false, true]);
  });

  it("refuses a hidden tab's empty viewport rather than capturing nothing", async () => {
    setUp();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(0);
    await expect(captureScreen()).rejects.toThrow(/no viewport/);
    expect(rasterized).toEqual([]);
  });
});

describe("in the Proposal and the Toolbar", () => {
  it("exports the Snapshots that aren't Outdated, and an export can take one of its own", async () => {
    setUp();
    await capture();
    let proposal = await collectProposal({ title: "t" });
    expect(proposal.routes[0]?.screenshots.map((shot) => shot.id)).toEqual(["s1", "s2"]);
    expect(proposal.routes[0]?.changes.map((change) => change.screenshots)).toEqual([["s2"]]);

    act(() => loupe.set(instanceId(TRIGGER, "user_1"), "variant", "secondary", "group"));
    proposal = await collectProposal({ title: "t" });
    expect(proposal.routes[0]?.screenshots).toEqual([]);

    await act(async () => {
      proposal = await collectProposal({ title: "t", capture: true });
    });
    expect(proposal.routes[0]?.screenshots.map((shot) => shot.caption)).toEqual([
      "Screen 1: /, 1024×768 at 1x",
      "c1: variant on 1st <Button> in MemberRowMenu, every Instance, screen 1",
    ]);
    expect(snapshots().map((snapshot) => [snapshot.id, snapshot.auto])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("lists each Snapshot, marked Outdated once an Override it showed changes", async () => {
    setUp();
    await capture();
    const card = document.createElement("div");
    document.body.append(card);
    const cardRoot = createRoot(card);
    act(() => cardRoot.render(h(SnapshotsCard)));
    expect(card.textContent).toContain("Snapshot 1");
    expect(card.textContent).toContain("/ · 1024×768 · 1 crop");
    expect(card.textContent).not.toContain("Outdated");

    act(() => loupe.set(instanceId(TRIGGER, "user_1"), "variant", "secondary", "group"));
    act(() => cardRoot.render(h(SnapshotsCard)));
    expect(card.textContent).toContain("Outdated");

    act(() => (card.querySelector("button:last-child") as HTMLButtonElement).click());
    act(() => cardRoot.render(h(SnapshotsCard)));
    expect(snapshots()).toEqual([]);
    expect(card.textContent).toBe("");
    act(() => cardRoot.unmount());
    card.remove();
  });
});

describe("crops", () => {
  const entry = (id: string, top: number, height = 40) => ({
    id,
    keyPath: id,
    after: { top, left: 10, bottom: top + height, right: 110 },
    before: null,
  });

  it("is one padded crop around every Instance, kept to the viewport", () => {
    expect(cropRects([entry("a", 10), entry("b", 200)], 800, 600)).toEqual([
      { rect: { top: 0, left: 0, bottom: 264, right: 134 }, keyPath: null, more: 0 },
    ]);
  });

  it("covers where an Instance is in both views", () => {
    const moved = { ...entry("a", 100), before: { top: 100, left: 10, bottom: 140, right: 300 } };
    expect(cropRects([moved], 800, 600)[0]?.rect.right).toBe(300 + CROP_PADDING);
  });

  it("splits a change taller than the viewport into one crop per Instance, four at most", () => {
    const tall = ["a", "b", "c", "d", "e", "f"].map((id, index) => entry(id, index * 150));
    const crops = cropRects(tall, 800, 600);
    expect(crops.map((crop) => [crop.keyPath, crop.more])).toEqual([
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["d", 2],
    ]);
  });

  it("names the changes on screen, skipping left-out Instances and State-only records", () => {
    const mounted = ["user_1", "user_2"].map((key) => ({
      id: instanceId(TRIGGER, key),
      anchor: TRIGGER,
      component: "Button",
      hint: null,
      keyPath: key,
      stateProps: [],
    }));
    const dialog = { id: DIALOG, anchor: DIALOG, component: "Dialog", hint: null, keyPath: "", stateProps: ["open"] };
    const box = { top: 0, left: 0, bottom: 10, right: 10 };
    const boxes = new Map([...mounted, dialog].map((instance) => [instance.id, box]));
    const changes = changesOnScreen(
      [
        { target: { scope: "group", anchor: TRIGGER }, values: { size: "sm" }, excluded: [instanceId(TRIGGER, "user_2")], suspended: null },
        { target: { scope: "instance", id: DIALOG }, values: { open: true }, excluded: [], suspended: null },
        {
          target: { scope: "instance", id: instanceId(TRIGGER, "user_2") },
          values: { variant: "outline" },
          excluded: [],
          suspended: { reason: "ambiguous", ids: [instanceId(TRIGGER, "user_2")] },
        },
      ],
      [...mounted, dialog],
      boxes,
    );
    expect(changes.map((change) => [change.key, change.covered.map((covered) => covered.keyPath)])).toEqual([
      [`group:${TRIGGER}`, ["user_1"]],
    ]);
  });
});
