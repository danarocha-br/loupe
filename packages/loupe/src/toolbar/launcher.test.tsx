// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Launcher } from "./launcher.js";
import { PLACE_KEY } from "./launcher-place.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;
let opened: ReturnType<typeof vi.fn<(from: { x: number; y: number }) => void>>;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  opened = vi.fn<(from: { x: number; y: number }) => void>();
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

/** Presses the pill and moves the pointer to (x, y), still held; returns the body's centre it is dragged to. */
function pressAndMove(x: number, y: number) {
  const { left, top } = pill().style;
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

  it("stays free where it is dropped away from the sides", () => {
    dragTo(window.innerWidth / 2, window.innerHeight / 2);
    expect(pill().dataset.edge).toBe("free");
    expect(pill().style.width).toBe("44px");
  });

  it("moves to a side with the arrow keys, without a pointer", () => {
    act(() => {
      pill().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(pill().dataset.edge).toBe("left");
    expect(pill().style.left).toBe("0px");
  });

  it("lifts while held, and shows the side it nears a rail before it glues", () => {
    // Pulled off the right side into the middle: lifted, free, no rail.
    pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
    expect(pill().classList.contains("dragging")).toBe(true);
    expect(pill().dataset.edge).toBe("free");
    expect(container.querySelector(".dock-rail")).toBeNull();
    // Toward the bottom, within reach but not glued: the bottom's rail fades in.
    fire("pointermove", { clientX: window.innerWidth / 2, clientY: window.innerHeight - 100 });
    const rail = container.querySelector<HTMLElement>(".dock-rail") as HTMLElement;
    expect(rail.dataset.edge).toBe("bottom");
    expect(Number(rail.style.opacity)).toBeGreaterThan(0);
    expect(Number(rail.style.opacity)).toBeLessThan(1);
    expect(pill().dataset.edge).toBe("free");
    // Close enough: it glues while still held, showing the shape it will keep, and the rail is full.
    fire("pointermove", { clientX: window.innerWidth / 2, clientY: window.innerHeight - 30 });
    expect(pill().dataset.edge).toBe("bottom");
    expect(pill().classList.contains("glued")).toBe(true);
    expect((container.querySelector(".dock-rail") as HTMLElement).style.opacity).toBe("1");
    // Let go: it stays as shown, and the rail goes.
    fire("pointerup", { clientX: window.innerWidth / 2, clientY: window.innerHeight - 30 });
    expect(pill().dataset.edge).toBe("bottom");
    expect(pill().classList.contains("dragging")).toBe(false);
    expect(container.querySelector(".dock-rail")).toBeNull();
  });

  it("opens the panel from where the pill is", () => {
    act(() => pill().click());
    const [at] = opened.mock.calls[0] as unknown as [{ x: number; y: number }];
    expect(at.x).toBe(window.innerWidth - 22);
  });
});
