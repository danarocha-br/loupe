// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Launcher } from "./launcher.js";
import { PLACE_KEY } from "./launcher-place.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;
let opened: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  opened = vi.fn<() => void>();
  act(() => root.render(<Launcher onOpen={opened} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

const pill = () => container.querySelector<HTMLButtonElement>(".launcher") as HTMLButtonElement;

const fire = (type: string, at: { clientX: number; clientY: number }) =>
  act(() => {
    pill().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...at }));
  });

/** Presses the pill 10px into its box and moves the pointer to (x, y), still held: the body's centre sits 12px right of and 6px below the pointer. */
function pressAndMove(x: number, y: number) {
  const [left = "0", top = "0"] = pill().style.translate.split(" ");
  fire("pointerdown", { clientX: Number.parseFloat(left) + 10, clientY: Number.parseFloat(top) + 10 });
  fire("pointermove", { clientX: x, clientY: y });
}

/** A pointer drag from the pill's body to (x, y), released there, with the click a browser sends after it. */
function dragTo(x: number, y: number) {
  pressAndMove(x, y);
  fire("pointerup", { clientX: x, clientY: y });
  act(() => pill().click());
}

describe("the collapsed Toolbar (2026-11-22)", () => {
  it("starts glued to the right side, the L on a pill named for what it does", () => {
    expect(pill().dataset.edge).toBe("right");
    expect(pill().getAttribute("aria-label")).toBe("Show Loupe");
    expect(pill().querySelector(".mark svg")).not.toBeNull();
  });

  it("opens the panel on a click", () => {
    act(() => pill().click());
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("follows a drag, glues to the side it is dropped by, and remembers it; the drag opens nothing", () => {
    dragTo(500, window.innerHeight - 10);
    expect(pill().dataset.edge).toBe("bottom");
    expect(opened).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(PLACE_KEY) as string)).toMatchObject({ edge: "bottom" });
    // The next click is a click again.
    act(() => pill().click());
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("stays free where it is dropped away from the sides, a stadium again once its fillets have gone back", async () => {
    dragTo(window.innerWidth / 2, window.innerHeight / 2);
    expect(pill().dataset.edge).toBe("free");
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 250)));
    expect(pill().querySelector("path")?.getAttribute("d")).toMatch(/^M16 32A16 16 0 0 1/);
  });

  it("moves to a side with the arrow keys, without a pointer", () => {
    act(() => {
      pill().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(pill().dataset.edge).toBe("left");
    expect(pill().style.translate.startsWith("0px ")).toBe(true);
  });

  it("is drawn in near a side, as to a magnet: closer than the pointer, its facing side flattening, and let go there it docks", () => {
    pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
    expect(pill().classList.contains("dragging")).toBe(true);
    expect(pill().dataset.edge).toBe("free");
    // The pointer puts the body 30px off the bottom: it is shown nearer, not docked yet.
    const pointerY = window.innerHeight - 16 - 30 - 6;
    fire("pointermove", { clientX: window.innerWidth / 2, clientY: pointerY });
    expect(pill().dataset.edge).toBe("free");
    const top = Number.parseFloat(pill().style.translate.split(" ")[1] as string);
    expect(top).toBeGreaterThan(window.innerHeight - 32 - 30);
    // Its bottom corners are tighter than a stadium's 16px.
    const start = Number(/^M(-?[\d.]+) 32/.exec(pill().querySelector("path")?.getAttribute("d") ?? "")?.[1]);
    expect(start).toBeLessThan(16);
    // Let go there: it docks.
    fire("pointerup", { clientX: window.innerWidth / 2, clientY: pointerY });
    expect(pill().dataset.edge).toBe("bottom");
    expect(pill().classList.contains("dragging")).toBe(false);
  });

  it("docks while still held once it meets the edge", () => {
    pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
    fire("pointermove", { clientX: window.innerWidth / 2, clientY: window.innerHeight - 16 - 2 - 6 });
    expect(pill().dataset.edge).toBe("bottom");
    expect(pill().classList.contains("dragging")).toBe(true);
  });

  it("carries on as far as a flick would coast, and docks on the side that takes it there", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
      // Held still a moment in the middle: the pick-up is out of the speed's window.
      now.mockReturnValue(1200);
      fire("pointermove", { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
      now.mockReturnValue(1250);
      // 200px down in 50ms: let go well out of reach, it coasts to the bottom.
      fire("pointermove", { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 + 200 });
      fire("pointerup", { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 + 200 });
      expect(pill().dataset.edge).toBe("bottom");
    } finally {
      now.mockRestore();
    }
  });

  it("is placed by translate, so its travel stays off layout", () => {
    expect(pill().style.translate).toMatch(/px .*px/);
    expect(pill().style.left).toBe("");
  });

  it("tucks away as the panel opens, and can't be pressed while it does", () => {
    act(() => root.render(<Launcher onOpen={opened} leaving />));
    expect(pill().classList.contains("leaving")).toBe(true);
    act(() => pill().click());
    expect(opened).not.toHaveBeenCalled();
  });
});
