// @vitest-environment jsdom
import { act, createElement as h, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteId, instanceId } from "../call-site.js";
import { createAdapter } from "../runtime/adapter.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { disableOverrides, registry } from "../runtime/registry.js";
import type { FixedPixelsOptions } from "./snapshots.fixture.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// What the page looked like each time it was rasterized: the rasterizer is the
// browser's job, so the test records what it would have drawn.
type Seen = { variants: string[]; dialog: string | null; covered: boolean; transitions: boolean };
const rasterized: Seen[] = [];

vi.mock("./project-server.js", () => ({
  readProjectContext: async () => ({ repo: "orbix-ai", commit: "abcdef1", dirty: false, playgroundVersion: "0.0.3" }),
}));

const {
  captureForExport,
  captureScreen,
  exportCaptureBytes,
  exportableSnapshots,
  removeSnapshot,
  retakeSnapshot,
  setRasterizer,
  snapshots,
} = await import("./snapshots.js");
const { fixedPixels } = await import("./snapshots.fixture.js");
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
const row = (n: number) => instanceId(TRIGGER, `user_${n}`);

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;

/** jsdom lays nothing out: each node says where it is. */
function layout(node: Element) {
  const box = node.getAttribute("data-box");
  if (box === null) return null;
  const [top = 0, left = 0, width = 0, height = 0] = box.split(",").map(Number);
  return { top, left, bottom: top + height, right: left + width };
}

/** Each drawing records what the page showed; its image is its number. */
function draw(): string {
  rasterized.push({
    variants: [...document.querySelectorAll("button")].map((node) => node.dataset.variant ?? ""),
    dialog: document.querySelector("[data-open]")?.getAttribute("data-open") ?? null,
    covered: document.querySelector("div[data-loupe-capture]") !== null,
    transitions: ![...document.querySelectorAll("style")].some((style) => style.textContent?.includes("transition: none")),
  });
  return String(rasterized.length);
}

/**
 * Starts over as a page load does, with no Snapshots, drawing fixed pixels with
 * `layout` and `draw` unless the test says otherwise.
 */
function startOver(options: FixedPixelsOptions = {}) {
  setRasterizer(fixedPixels({ layout, draw, ...options }));
}

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  startOver();
  rasterized.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  history.pushState(null, "", "/");
  vi.restoreAllMocks();
});

// Four member rows; the fourth is below the fold (jsdom's viewport is 1024×768).
const rows: Box[] = [
  [100, 600, 32, 32],
  [150, 600, 32, 32],
  [200, 600, 32, 32],
  [900, 600, 32, 32],
];

function membros(boxes: readonly Box[]): ReactElement {
  return h(
    "div",
    null,
    boxes.map((box, index) =>
      h("section", { key: `user_${index + 1}` }, h(Button, { variant: "ghost", box, [ANCHOR_ATTRIBUTE]: TRIGGER } as ButtonProps)),
    ),
    h("aside", { key: "dialog" }, h(Dialog, { open: false, onOpenChange: () => {}, box: [300, 300, 400, 200], [ANCHOR_ATTRIBUTE]: DIALOG } as DialogProps)),
  );
}

/** Runs a capture, or anything that takes one, inside `act`: it switches the view and back. */
async function run<T>(job: () => Promise<T>): Promise<T> {
  let result: T | undefined;
  await act(async () => {
    result = await job();
  });
  return result as T;
}

/** The rows, every one outlined as a group, and the dialog held open: a State prop. */
function setUp(boxes: readonly Box[] = rows) {
  act(() => root.render(membros(boxes)));
  act(() => {
    loupe.set(row(1), "variant", "outline", "group");
    loupe.set(DIALOG_ID, "open", true);
  });
}

const ids = () => snapshots().map((snapshot) => [snapshot.id, snapshot.auto]);

function renderCard() {
  const card = document.createElement("div");
  document.body.append(card);
  const cardRoot = createRoot(card);
  act(() => cardRoot.render(h(SnapshotsCard)));
  return {
    card,
    rerender: () => act(() => cardRoot.render(h(SnapshotsCard))),
    button: (text: string) => [...card.querySelectorAll("button")].find((node) => node.textContent === text),
    remove: () => {
      act(() => cardRoot.unmount());
      card.remove();
    },
  };
}

describe("Capture screen", () => {
  it("rasterizes after, then before under a still of the page, with the dialog held open in both", async () => {
    setUp();
    const snapshot = await run(captureScreen);

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
      before: "data:image/png;base64,2",
      after: "data:image/png;base64,1",
      failedImages: 0,
    });
    // One crop pair for the group change, cut from both images around the three
    // rows on screen, 24px of padding around them; State props make no crop of their own.
    const rect = "76,576,256,656";
    expect(snapshot.crops).toEqual([
      {
        change: `group:${TRIGGER}`,
        keyPath: null,
        more: 0,
        before: `data:image/png;base64,2@${rect}`,
        after: `data:image/png;base64,1@${rect}`,
        failedImages: 0,
      },
    ]);
    expect(snapshot.shown.map((entry) => entry.identity.id)).toEqual([row(1), row(2), row(3), DIALOG_ID]);
    expect(snapshot.bytes).toBe(2 * "data:image/png;base64,1".length + 2 * `data:image/png;base64,1@${rect}`.length);
    expect(snapshots()).toEqual([{ ...snapshot, outdated: false, elsewhere: false }]);
  });

  it("counts the images that didn't load on the viewport pair, the more of the two, and none on crops", async () => {
    startOver({ failed: [1, 3] });
    setUp();
    const snapshot = await run(captureScreen);
    expect(snapshot.viewport.failedImages).toBe(3);
    expect(snapshot.crops.map((crop) => crop.failedImages)).toEqual([0]);
  });

  it("leaves the page as it was, and the list, when a drawing fails", async () => {
    startOver({
      draw: () => {
        const image = draw();
        if (image === "4") throw new Error("The canvas is tainted.");
        return image;
      },
    });
    setUp();
    const first = await run(captureScreen);
    await act(async () => {
      await expect(captureScreen()).rejects.toThrow("The canvas is tainted.");
    });
    // It failed drawing "before", under the still.
    expect(rasterized.map((seen) => seen.covered)).toEqual([false, true, false, true]);
    expect(registry().store.view).toBe("proposed");
    expect([...container.querySelectorAll("button")].map((node) => node.dataset.variant)).toEqual(Array(4).fill("outline"));
    expect(document.querySelector("[data-loupe-capture]")).toBeNull();
    expect(document.querySelector("style")).toBeNull();
    expect(snapshots().map((snapshot) => snapshot.capturedAt)).toEqual([first.capturedAt]);

    // The next capture isn't held up by it.
    await run(captureScreen);
    expect(ids()).toEqual([
      [1, false],
      [2, false],
    ]);
  });

  it("is Outdated, and not exported, once an Override it showed changes", async () => {
    setUp();
    await run(captureScreen);
    expect(snapshots()[0]?.outdated).toBe(false);
    expect(exportableSnapshots()).toHaveLength(1);

    act(() => loupe.set(row(1), "variant", "secondary", "group"));
    expect(snapshots()[0]?.outdated).toBe(true);
    expect(exportableSnapshots()).toEqual([]);

    // A State prop it showed counts too: closing the dialog changes the screen.
    act(() => loupe.set(row(1), "variant", "outline", "group"));
    expect(snapshots()[0]?.outdated).toBe(false);
    act(() => loupe.reset(DIALOG_ID, "open"));
    expect(snapshots()[0]?.outdated).toBe(true);
  });

  it("is Outdated once Overrides drop to inspect-only: the page no longer shows what it showed", async () => {
    setUp();
    await run(captureScreen);
    expect(snapshots()[0]?.outdated).toBe(false);
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    expect(snapshots()[0]?.outdated).toBe(true);
    expect(exportableSnapshots()).toEqual([]);
  });

  it("ignores an Override on an Instance it didn't show", async () => {
    setUp();
    await run(captureScreen);
    act(() => loupe.set(row(4), "variant", "secondary"));
    expect(snapshots()[0]?.outdated).toBe(false);
  });

  it("Retake keeps the place and number, Remove drops it, and an export replaces its own last one", async () => {
    setUp();
    const first = await run(captureScreen);
    const second = await run(captureScreen);
    expect(snapshots().map((snapshot) => snapshot.id)).toEqual([1, 2]);

    const retaken = await run(() => retakeSnapshot(first.id));
    expect(retaken.id).toBe(1);
    expect(snapshots().map((snapshot) => [snapshot.id, snapshot.capturedAt])).toEqual([
      [1, retaken.capturedAt],
      [2, second.capturedAt],
    ]);

    expect(await run(captureForExport)).toEqual({ failed: null });
    expect(await run(captureForExport)).toEqual({ failed: null });
    expect(ids()).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);

    removeSnapshot(2);
    expect(snapshots().map((snapshot) => snapshot.id)).toEqual([1, 3]);
    await expect(retakeSnapshot(2)).rejects.toThrow("There is no Snapshot 2 to retake.");
  });

  it("won't retake a Snapshot taken on another page, and the card says so", async () => {
    setUp();
    await run(captureScreen);
    history.pushState(null, "", "/elsewhere");
    // A Retake here would replace it with a picture of the wrong page.
    expect(snapshots()[0]?.elsewhere).toBe(true);
    await expect(retakeSnapshot(1)).rejects.toThrow("Snapshot 1 was taken on /: open that page to retake it.");
    expect(rasterized).toHaveLength(2);

    const card = renderCard();
    expect(card.button("Retake")?.disabled).toBe(true);
    expect(card.card.textContent).toContain("Taken on /: open that page to retake it.");
    card.remove();
  });

  it("estimates what an export's own Snapshot adds: nothing where this route has one, else the newest kept one", async () => {
    setUp();
    const snapshot = await run(captureScreen);
    expect(exportCaptureBytes()).toBe(0);
    history.pushState(null, "", "/elsewhere");
    expect(exportCaptureBytes()).toBe(snapshot.bytes);
    act(() => loupe.set(row(1), "variant", "secondary", "group"));
    expect(exportCaptureBytes()).toBe(0);
  });

  it("runs one capture at a time", async () => {
    setUp();
    const both = await run(() => Promise.all([captureScreen(), captureScreen()]));
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

describe("crops", () => {
  it("cover where an Instance is in both views", async () => {
    // Ghost buttons draw 200px wider: "before" reaches further right than "after".
    startOver({
      layout: (node) => {
        const box = layout(node);
        return box && node.getAttribute("data-variant") === "ghost" ? { ...box, right: box.right + 200 } : box;
      },
    });
    setUp();
    const snapshot = await run(captureScreen);
    expect(snapshot.crops.map((crop) => crop.after)).toEqual(["data:image/png;base64,1@76,576,256,856"]);
  });

  it("split a change taller than the viewport into one per Instance, top first, four at most, kept to the viewport", async () => {
    setUp([0, 150, 300, 450, 600, 750].map((top): Box => [top, 600, 32, 40]));
    const snapshot = await run(captureScreen);
    expect(snapshot.crops.map((crop) => [crop.keyPath, crop.more, crop.after])).toEqual([
      ["user_1", 0, "data:image/png;base64,1@0,576,64,656"],
      ["user_2", 0, "data:image/png;base64,1@126,576,214,656"],
      ["user_3", 0, "data:image/png;base64,1@276,576,364,656"],
      ["user_4", 2, "data:image/png;base64,1@426,576,514,656"],
    ]);
  });

  it("make none for a record held back as ambiguous", async () => {
    setUp();
    act(() => loupe.set(row(2), "variant", "secondary"));
    const before = await run(captureScreen);
    expect(before.crops.map((crop) => crop.change)).toEqual([`instance:${row(2)}`, `group:${TRIGGER}`]);

    // As the registry does once two Instances turn out to share the id.
    act(() => registry().store.suspendAmbiguous((id) => id === row(2)));
    const after = await run(captureScreen);
    expect(after.crops.map((crop) => crop.change)).toEqual([`group:${TRIGGER}`]);
  });

  it("leave out an Instance excluded from the change", async () => {
    setUp();
    act(() => loupe.exclude(row(3), "group"));
    const snapshot = await run(captureScreen);
    expect(snapshot.crops.map((crop) => [crop.change, crop.after])).toEqual([
      [`group:${TRIGGER}`, "data:image/png;base64,1@76,576,206,656"],
    ]);
  });
});

describe("in the Proposal and the Toolbar", () => {
  it("exports the Snapshots that aren't Outdated, and an export can take one of its own", async () => {
    setUp();
    await run(captureScreen);
    let proposal = await collectProposal({ title: "t" });
    expect(proposal.routes[0]?.screenshots.map((shot) => shot.id)).toEqual(["s1", "s2"]);
    expect(proposal.routes[0]?.changes.map((change) => change.screenshots)).toEqual([["s2"]]);

    act(() => loupe.set(row(1), "variant", "secondary", "group"));
    proposal = await collectProposal({ title: "t" });
    expect(proposal.routes[0]?.screenshots).toEqual([]);

    proposal = await run(() => collectProposal({ title: "t", capture: true }));
    expect(proposal.routes[0]?.screenshots.map((shot) => shot.caption)).toEqual([
      "Screen 1: /, 1024×768 at 1x",
      "c1: variant on 1st <Button> in MemberRowMenu, every Instance, screen 1",
    ]);
    expect(ids()).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("drops an export's own Snapshot that repeats a manual one, and the last export's own with it", async () => {
    let image = "a";
    startOver({
      draw: () => {
        draw();
        return image;
      },
    });
    setUp();
    await run(captureScreen);
    image = "b";
    await run(captureForExport);
    expect(ids()).toEqual([
      [1, false],
      [2, true],
    ]);

    // The screen is as the manual Snapshot shows it again: that one stands for it.
    image = "a";
    const proposal = await run(() => collectProposal({ title: "t", capture: true }));
    expect(ids()).toEqual([[1, false]]);
    expect(proposal.routes[0]?.screenshots.map((shot) => shot.kind)).toEqual(["viewport", "crop"]);
  });

  it("lists each Snapshot, marked Outdated once an Override it showed changes", async () => {
    setUp();
    await run(captureScreen);
    const card = renderCard();
    expect(card.card.textContent).toContain("Snapshot 1");
    expect(card.card.textContent).toContain("/ · 1024×768 · 1 crop");
    expect(card.card.textContent).not.toContain("Outdated");

    act(() => loupe.set(row(1), "variant", "secondary", "group"));
    card.rerender();
    expect(card.card.textContent).toContain("Outdated");

    act(() => card.button("Remove")?.click());
    card.rerender();
    expect(snapshots()).toEqual([]);
    expect(card.card.textContent).toBe("");
    card.remove();
  });
});
