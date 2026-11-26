// @vitest-environment jsdom
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Launcher } from "./launcher.js";
import { PLACE_KEY } from "./launcher-place.js";
import { LAUNCHER_WORDS } from "./panel-view/chrome.js";
import { axeViolations, cleanup, renderInSurface } from "./surface/render.fixture.js";
import { listen } from "@loupe/ui/listen";

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

const pill = () => container.querySelector<HTMLButtonElement>("[data-launcher]") as HTMLButtonElement;

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
    expect(pill().querySelector("[data-launcher-mark] svg")).not.toBeNull();
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
  });

  it("moves to a side with the arrow keys, without a pointer", () => {
    act(() => {
      pill().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(pill().dataset.edge).toBe("left");
    // Docked, it floats a few px off the side, held to it by the neck.
    expect(pill().style.translate.startsWith("6px ")).toBe(true);
  });

  it("stays rigid and exactly under the pointer while held, with no lean", () => {
    const [left = "0", top = "0"] = pill().style.translate.split(" ");
    const [x0, y0] = [Number.parseFloat(left), Number.parseFloat(top)];
    fire("pointerdown", { clientX: x0 + 10, clientY: y0 + 10 });
    const [x, y] = [window.innerWidth / 2, window.innerHeight - 16 - 30];
    fire("pointermove", { clientX: x, clientY: y });
    expect(pill().hasAttribute("data-dragging")).toBe(true);
    expect(pill().style.translate).toBe(`${x - 10}px ${y - 10}px`);
  });

  it("draws no copy of itself while held: nothing but the pill, and the edge's goo", () => {
    pressAndMove(window.innerWidth / 2, window.innerHeight - 16 - 30 - 6);
    expect(container.querySelector(".dock-ghost")).toBeNull();
    expect(container.querySelectorAll("[data-launcher]").length).toBe(1);
  });

  it("docks on the side it is let go in reach of", () => {
    pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
    const pointerY = window.innerHeight - 16 - 30 - 6;
    fire("pointermove", { clientX: window.innerWidth / 2, clientY: pointerY });
    fire("pointerup", { clientX: window.innerWidth / 2, clientY: pointerY });
    expect(pill().dataset.edge).toBe("bottom");
    expect(pill().hasAttribute("data-dragging")).toBe(false);
    expect(pill().hasAttribute("data-settling")).toBe(true);
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

  it("docks on the side it is let go in reach of, however fast it was moving", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
      now.mockReturnValue(1200);
      fire("pointermove", { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
      now.mockReturnValue(1250);
      // 300px sideways in 50ms, ending 30px off the bottom: in reach of it.
      const pointerY = window.innerHeight - 16 - 30 - 6;
      fire("pointermove", { clientX: window.innerWidth / 2 - 300, clientY: pointerY });
      fire("pointerup", { clientX: window.innerWidth / 2 - 300, clientY: pointerY });
      expect(pill().dataset.edge).toBe("bottom");
    } finally {
      now.mockRestore();
    }
  });

  it("draws a body for each side of the window as far out as the pill's gap to it, so the two run together only close to (2026-11-23)", () => {
    const wall = (index: number) => pill().querySelectorAll<SVGRectElement>("[data-launcher-wall]")[index] as SVGRectElement;
    // Parked on the right, 6px off it: the right side's body (EDGES order: left, right, top, bottom) is drawn back 24px more, so no neck.
    expect(wall(1).style.translate).toBe("30px 0px");
    // Held: every side's body is the pill's real gap away, so they join once it is close.
    pressAndMove(window.innerWidth / 2, window.innerHeight / 2);
    const [x] = pill().style.translate.split(" ").map(Number.parseFloat);
    expect(wall(1).style.translate).toBe(`${window.innerWidth - (x as number) - 44}px 0px`);
    expect(wall(0).style.translate).toBe(`${-(x as number)}px 0px`);
    // The L stays outside the blur, crisp.
    expect(pill().querySelector("[data-launcher-goo] [data-launcher-mark]")).toBeNull();
  });

  it("is placed by translate, so its travel stays off layout", () => {
    expect(pill().style.translate).toMatch(/px .*px/);
    expect(pill().style.left).toBe("");
  });

  it("tucks away as the panel opens, and can't be pressed while it does", () => {
    act(() => root.render(<Launcher onOpen={opened} leaving />));
    expect(pill().hasAttribute("data-leaving")).toBe(true);
    act(() => pill().click());
    expect(opened).not.toHaveBeenCalled();
  });
});

describe("the collapsed Toolbar by keyboard, in its surface", () => {
  afterEach(cleanup);

  it("is described by what its arrow keys do, says where a key docked it, and passes axe", async () => {
    const user = userEvent.setup({ document });
    // In a surface, which the beforeEach's bare root isn't: its announcer is there to listen to.
    const screen = renderInSurface(<Launcher onOpen={() => {}} />);
    const heard = listen(screen.shadow);
    const pill = screen.getByRole("button", { name: "Show Loupe", description: LAUNCHER_WORDS.keys });
    act(() => pill.focus());
    await user.keyboard("{ArrowLeft}");
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 200)));
    await user.keyboard("{ArrowUp}");
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 200)));
    expect(pill.dataset.edge).toBe("top");
    expect(heard.polite).toEqual(["Docked on the left", "Docked at the top"]);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});
