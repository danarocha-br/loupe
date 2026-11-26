// @vitest-environment jsdom
// The peek (peek.ts): a lone Alt, held, makes the open panel see-through; Alt as half of
// another key (Loupe's Alt+Shift+L, Alt+Tab, Option-typing in a field) never does. Run
// against the real Toolbar, its panel read by role inside its shadow root.

import { within } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { Page } from "./members.fixture.js";
import { PEEK_DELAY } from "./peek.js";
import { loadPanel } from "./start.js";
import { HOST_ATTRIBUTE } from "./styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LoupeMount = devMount(Toolbar);

let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadPanel();
});

beforeEach(() => {
  resetLoupe();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  localStorage.clear();
});

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));

/** A page with a field of its own, as an app has, and Loupe open over it. */
function App() {
  return (
    <>
      <label>
        Note <input type="text" />
      </label>
      <Page onRowClick={() => {}} />
      <LoupeMount />
    </>
  );
}

/** Loupe open, then the clock held so the peek's wait is the test's to run. */
async function mount() {
  localStorage.setItem(OPEN_KEY, "open");
  act(() => root.render(<App />));
  await settle();
  await settle();
  vi.useFakeTimers();
}

const host = () => document.querySelector(`[${HOST_ATTRIBUTE}]`) as HTMLElement;
const screen = () => within(host().shadowRoot as unknown as HTMLElement);
const panel = () => screen().getByRole("region", { name: "Loupe" });
const peeking = () => panel().hasAttribute("data-peek");
const note = () => within(container).getByRole("textbox", { name: "Note" });

/** Whatever has focus, the page itself when nothing does. */
const focused = () => host().shadowRoot?.activeElement ?? document.activeElement ?? document.body;

function key(type: "keydown" | "keyup", init: KeyboardEventInit) {
  act(() => void focused().dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, composed: true, ...init })));
}
const altDown = (init: KeyboardEventInit = {}) => key("keydown", { key: "Alt", code: "AltLeft", altKey: true, ...init });
const altUp = () => key("keyup", { key: "Alt", code: "AltLeft" });
/** The wait for a lone Alt to stay alone, run out. */
const wait = (ms = PEEK_DELAY) => act(() => void vi.advanceTimersByTime(ms));

describe("the peek", () => {
  it("shows on a lone Alt held, and ends on its release", async () => {
    await mount();
    altDown();
    // Not at once: a chord's next key would come first.
    expect(peeking()).toBe(false);
    wait();
    expect(peeking()).toBe(true);
    altUp();
    expect(peeking()).toBe(false);
  });

  it("doesn't show on Loupe's own Alt+Shift+L, which still moves focus to the panel", async () => {
    await mount();
    altDown();
    key("keydown", { key: "Shift", code: "ShiftLeft", altKey: true, shiftKey: true });
    key("keydown", { key: "Ò", code: "KeyL", altKey: true, shiftKey: true });
    expect(screen().getByRole("heading", { level: 2 })).toBe(host().shadowRoot?.activeElement);
    wait(PEEK_DELAY * 5);
    expect(peeking()).toBe(false);
    key("keyup", { key: "Ò", code: "KeyL", altKey: true, shiftKey: true });
    key("keyup", { key: "Shift", code: "ShiftLeft", altKey: true });
    wait(PEEK_DELAY * 5);
    expect(peeking()).toBe(false);
  });

  it("doesn't show on an Alt pressed with another modifier already held", async () => {
    await mount();
    key("keydown", { key: "Shift", code: "ShiftLeft", shiftKey: true });
    altDown({ shiftKey: true });
    wait();
    expect(peeking()).toBe(false);
  });

  it("doesn't show while Option types in the app's field", async () => {
    await mount();
    act(() => note().focus());
    altDown();
    wait();
    expect(peeking()).toBe(false);
    // Option+E, the accent's first key on a Mac.
    key("keydown", { key: "Dead", code: "KeyE", altKey: true });
    wait();
    expect(peeking()).toBe(false);
  });

  it("doesn't show when a letter follows the Alt, in a field or out of one", async () => {
    await mount();
    altDown();
    key("keydown", { key: "∂", code: "KeyD", altKey: true });
    wait(PEEK_DELAY * 5);
    expect(peeking()).toBe(false);
  });

  it("ends on another key once it shows", async () => {
    await mount();
    altDown();
    wait();
    expect(peeking()).toBe(true);
    key("keydown", { key: "∂", code: "KeyD", altKey: true });
    expect(peeking()).toBe(false);
  });

  it("doesn't show when a pointer button is pressed before the wait is out, and lets clicks through once it shows", async () => {
    await mount();
    altDown();
    act(() => void document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true })));
    wait();
    expect(peeking()).toBe(false);
    act(() => void document.body.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, composed: true })));
    altUp();

    altDown();
    wait();
    act(() => void document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true })));
    expect(peeking()).toBe(true);
  });

  it("doesn't show when the window loses focus, as on Alt+Tab, and never sticks", async () => {
    await mount();
    altDown();
    act(() => void window.dispatchEvent(new Event("blur")));
    wait();
    expect(peeking()).toBe(false);

    // Shown, then the Alt's keyup goes to another window.
    altUp();
    altDown();
    wait();
    expect(peeking()).toBe(true);
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(peeking()).toBe(false);
  });

  it("ends when the tab goes hidden", async () => {
    await mount();
    altDown();
    wait();
    expect(peeking()).toBe(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(peeking()).toBe(false);
  });

  it("shows once at most on a held Alt that repeats, and a repeat doesn't bring back a peek called off", async () => {
    await mount();
    const shown: boolean[] = [];
    const watch = new MutationObserver(() => shown.push(peeking()));
    watch.observe(panel(), { attributes: true, attributeFilter: ["data-peek"] });
    altDown();
    for (let beat = 0; beat < 10; beat += 1) {
      wait(PEEK_DELAY / 2);
      altDown({ repeat: true });
    }
    await act(async () => await Promise.resolve());
    expect(shown).toEqual([true]);
    expect(peeking()).toBe(true);

    key("keydown", { key: "∂", code: "KeyD", altKey: true });
    for (let beat = 0; beat < 10; beat += 1) {
      wait(PEEK_DELAY / 2);
      altDown({ repeat: true });
    }
    expect(peeking()).toBe(false);
    watch.disconnect();
  });
});
