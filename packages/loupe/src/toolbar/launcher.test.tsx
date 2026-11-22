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

/** A pointer drag from the pill's body to (x, y), released there, with the click a browser sends after it. */
function dragTo(x: number, y: number) {
  const { left, top } = pill().style;
  const from = { clientX: Number.parseFloat(left) + 10, clientY: Number.parseFloat(top) + 10 };
  const fire = (type: string, at: { clientX: number; clientY: number }) =>
    act(() => {
      pill().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...at }));
    });
  fire("pointerdown", from);
  fire("pointermove", { clientX: x, clientY: y });
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
});
