// @vitest-environment jsdom
// The keyboard's way into Loupe (shortcut.ts): Alt+Shift+L moves focus to the pill or
// the open panel, and the same keys or Esc give it back. Run against the real Toolbar,
// read by role inside its shadow root.

import { within } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { resetLoupe } from "../runtime/slot.js";
import { useEscape } from "./escape.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { Page } from "./members.fixture.js";
import { isShortcut, SHORTCUT_ARIA } from "./shortcut.js";
import { loadPanel } from "./start.js";
import { HOST_ATTRIBUTE } from "./styles.js";
import { axeViolations } from "./surface/render.fixture.js";

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
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));

/** A page with a field of its own before Loupe, and any other claim on Esc a test adds. */
function App({ onSelectionEsc }: { onSelectionEsc?: () => void }) {
  useEscape("selection", onSelectionEsc !== undefined, () => onSelectionEsc?.());
  return (
    <>
      <button type="button">Before</button>
      <Page onRowClick={() => {}} />
      <LoupeMount />
    </>
  );
}

async function mount(state: "open" | "closed", props: Parameters<typeof App>[0] = {}) {
  localStorage.setItem(OPEN_KEY, state);
  act(() => root.render(<App {...props} />));
  await settle();
  await settle();
}

const host = () => document.querySelector(`[${HOST_ATTRIBUTE}]`) as HTMLElement;
const screen = () => within(host().shadowRoot as unknown as HTMLElement);
const before = () => within(container).getByRole("button", { name: "Before" });
const inLoupe = () => host().shadowRoot?.activeElement ?? null;

/** Alt+Shift+L, from wherever focus is: `code` is the physical key, as a browser reports it. */
function shortcut(init: KeyboardEventInit = {}) {
  const target = inLoupe() ?? document.activeElement ?? document.body;
  const event = new KeyboardEvent("keydown", { code: "KeyL", key: "Ò", altKey: true, shiftKey: true, bubbles: true, cancelable: true, composed: true, ...init });
  act(() => void target.dispatchEvent(event));
  return event;
}

function esc() {
  const target = inLoupe() ?? document.activeElement ?? document.body;
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, composed: true });
  act(() => void target.dispatchEvent(event));
  return event;
}

describe("Alt+Shift+L, collapsed", () => {
  it("moves focus to the pill, which names the shortcut for a screen reader and in its tooltip", async () => {
    await mount("closed");
    act(() => before().focus());
    const event = shortcut();
    const pill = screen().getByRole("button", { name: "Show Loupe" });
    expect(inLoupe()).toBe(pill);
    // The key is Loupe's: the browser and the page don't also act on it.
    expect(event.defaultPrevented).toBe(true);
    expect(pill.getAttribute("aria-keyshortcuts")).toBe(SHORTCUT_ARIA);
    expect(pill.title).toMatch(/Alt\+Shift\+L|⌥⇧L/);
  });

  it("gives focus back to where it was on the same keys, and on Esc", async () => {
    await mount("closed");
    act(() => before().focus());
    shortcut();
    expect(inLoupe()).not.toBeNull();
    shortcut();
    expect(document.activeElement).toBe(before());
    expect(inLoupe()).toBeNull();

    shortcut();
    expect(inLoupe()).not.toBeNull();
    esc();
    expect(document.activeElement).toBe(before());
  });

  it("works from the page itself, with nothing focused, and lets go on the way back", async () => {
    await mount("closed");
    expect(document.activeElement).toBe(document.body);
    shortcut();
    expect(inLoupe()).not.toBeNull();
    shortcut();
    expect(inLoupe()).toBeNull();
  });

  it("leaves Esc to the app when focus got to the pill any other way", async () => {
    await mount("closed");
    act(() => screen().getByRole("button", { name: "Show Loupe" }).focus());
    const event = esc();
    expect(inLoupe()).not.toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it("forgets where focus came from once it goes to the page by any other way", async () => {
    await mount("closed");
    act(() => before().focus());
    shortcut();
    // A click elsewhere on the page, then back into Loupe by the pointer: Esc is no longer a way "back".
    act(() => before().focus());
    act(() => screen().getByRole("button", { name: "Show Loupe" }).focus());
    esc();
    expect(inLoupe()).not.toBeNull();
  });

  it("forgets where focus came from on a press on the page, which moves no focus", async () => {
    await mount("closed");
    act(() => before().focus());
    shortcut();
    // A click on blank page content blurs Loupe without a focusin on the page.
    act(() => void before().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true })));
    act(() => screen().getByRole("button", { name: "Show Loupe" }).focus());
    esc();
    expect(inLoupe()).not.toBeNull();
  });

  it("brings focus to the pill, not off it, when focus got there by a Tab", async () => {
    await mount("closed");
    const pill = screen().getByRole("button", { name: "Show Loupe" });
    act(() => pill.focus());
    shortcut();
    expect(inLoupe()).toBe(pill);
  });

  it("lets go when the element focus came from won't take it back", async () => {
    await mount("closed");
    act(() => before().focus());
    shortcut();
    // Loupe's own inspector can disable the page control that lent it focus.
    act(() => before().setAttribute("disabled", ""));
    esc();
    expect(inLoupe()).toBeNull();
  });

  it("answers only Alt, Shift and the L key", async () => {
    await mount("closed");
    expect(isShortcut(new KeyboardEvent("keydown", { code: "KeyL", altKey: true, shiftKey: true }))).toBe(true);
    for (const init of [
      { code: "KeyL", altKey: true },
      { code: "KeyL", shiftKey: true },
      { code: "KeyL", altKey: true, shiftKey: true, ctrlKey: true },
      { code: "KeyL", altKey: true, shiftKey: true, metaKey: true },
      { code: "KeyK", altKey: true, shiftKey: true },
      { code: "KeyL", altKey: true, shiftKey: true, repeat: true },
      { code: "KeyL", altKey: true, shiftKey: true, isComposing: true },
    ]) {
      expect(isShortcut(new KeyboardEvent("keydown", init))).toBe(false);
    }
    act(() => before().focus());
    shortcut({ altKey: false });
    expect(document.activeElement).toBe(before());
  });

  it("works under a layout where the key types something else, since it reads the physical key", async () => {
    await mount("closed");
    shortcut({ key: "ł" });
    expect(inLoupe()).not.toBeNull();
  });
});

describe("Alt+Shift+L, open", () => {
  it("moves focus to the panel's heading, and back", async () => {
    await mount("open");
    act(() => before().focus());
    shortcut();
    expect(inLoupe()).toBe(screen().getByRole("heading", { level: 2 }));
    shortcut();
    expect(document.activeElement).toBe(before());
  });

  it("brings focus to the heading from elsewhere in the panel, not off it", async () => {
    await mount("open");
    act(() => screen().getAllByRole("radio")[0]?.focus());
    expect(inLoupe()?.getAttribute("role")).toBe("radio");
    shortcut();
    expect(inLoupe()).toBe(screen().getByRole("heading", { level: 2 }));
  });

  it("takes Esc before the selection does, which goes on the Esc after", async () => {
    const onSelectionEsc = vi.fn();
    await mount("open", { onSelectionEsc });
    act(() => before().focus());
    shortcut();
    esc();
    expect(document.activeElement).toBe(before());
    expect(onSelectionEsc).not.toHaveBeenCalled();
    esc();
    expect(onSelectionEsc).toHaveBeenCalledTimes(1);
  });

  it("leaves Esc to a text field with focus", async () => {
    await mount("open");
    act(() => before().focus());
    shortcut();
    const field = document.createElement("textarea");
    host().shadowRoot?.append(field);
    act(() => field.focus());
    const event = esc();
    expect(inLoupe()).toBe(field);
    expect(event.defaultPrevented).toBe(false);
    field.remove();
  });

  it("has no axe violations with focus on the heading", async () => {
    await mount("open");
    shortcut();
    expect(await axeViolations(host())).toEqual([]);
  });
});
