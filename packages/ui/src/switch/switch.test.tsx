// @vitest-environment jsdom
// Switch, by role, inside a real shadow root (ADR 0003): a named switch that says
// whether it's on, asks the caller for the other value on a click, Space or Enter,
// and draws on through its thumb's state attribute.

import { userEvent } from "@testing-library/user-event";
import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_STYLESHEET as STYLESHEET } from "../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../surface/render.fixture.js";
import { Switch } from "./switch.js";
import CSS from "./switch.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

function Modal({ initial = false, onCheckedChange = () => {} }: { initial?: boolean; onCheckedChange?(checked: boolean): void }) {
  const [checked, setChecked] = useState(initial);
  return (
    <Switch
      label="modal"
      checked={checked}
      onCheckedChange={(next) => {
        onCheckedChange(next);
        setChecked(next);
      }}
    />
  );
}

describe("Switch", () => {
  it("is a switch named by its prop, that says whether it's on", () => {
    const screen = renderInSurface(<Modal initial />);
    const control = screen.getByRole("switch", { name: "modal" });
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("turns on a click, on Space and on Enter, focus staying on it", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(<Modal onCheckedChange={asked} />);
    const control = screen.getByRole("switch", { name: "modal" });
    await user.click(control);
    expect(control.getAttribute("aria-checked")).toBe("true");
    control.focus();
    await user.keyboard(" ");
    expect(control.getAttribute("aria-checked")).toBe("false");
    await user.keyboard("{Enter}");
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(screen.shadow.activeElement).toBe(control);
    expect(asked.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("turns once for Enter held down", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(<Modal onCheckedChange={asked} />);
    const control = screen.getByRole("switch", { name: "modal" });
    control.focus();
    await user.keyboard("{Enter}");
    // The browser's auto-repeat: keydowns that say so. user-event doesn't mark its repeats.
    for (let i = 0; i < 3; i++) act(() => void control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, composed: true })));
    expect(asked.mock.calls).toEqual([[true]]);
  });

  it("follows the caller: nothing turns until the caller passes the new value", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(<Switch label="open" checked={false} onCheckedChange={asked} />);
    const control = screen.getByRole("switch", { name: "open" });
    await user.click(control);
    expect(asked).toHaveBeenCalledWith(true);
    expect(control.getAttribute("aria-checked")).toBe("false");
  });

  it("draws on through its thumb's state, and passes data attributes through", () => {
    const screen = renderInSurface(<Switch label="open" checked onCheckedChange={() => {}} data-prop-switch="open" />);
    const control = screen.getByRole("switch", { name: "open" });
    expect(control.getAttribute("data-prop-switch")).toBe("open");
    const thumb = control.querySelector("[data-switch-thumb]");
    expect(thumb?.hasAttribute("data-checked")).toBe(true);
  });

  it("leaves Escape to the app", async () => {
    const user = setup();
    const heard: KeyboardEvent[] = [];
    const listen = (event: KeyboardEvent) => heard.push(event);
    window.addEventListener("keydown", listen);
    try {
      const screen = renderInSurface(<Modal />);
      screen.getByRole("switch", { name: "modal" }).focus();
      await user.keyboard("{Escape}");
      expect(heard.map((event) => [event.key, event.defaultPrevented])).toEqual([["Escape", false]]);
    } finally {
      window.removeEventListener("keydown", listen);
    }
  });

  it("passes axe, on and off", async () => {
    const off = renderInSurface(<Modal />);
    expect(await axeViolations(off.host)).toEqual([]);
    off.unmount();
    const on = renderInSurface(<Modal initial />);
    expect(await axeViolations(on.host)).toEqual([]);
  });
});

describe("Switch's CSS", () => {
  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its motion and colours from the tokens", () => {
    const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .map((chunk) => chunk.split("}").pop()?.trim() ?? "")
      .filter((selector) => selector && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(4);
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/(^|[\s>+~,(])\.[a-z]/i);
      expect(selector, selector).not.toMatch(/aria-/);
    }
    expect(CSS).toContain("[data-checked]");
    expect(CSS).not.toMatch(/\d+ms|cubic-bezier|#[0-9a-f]{3,8}\b/i);
    expect(CSS).toContain("var(--duration-toast) var(--ease-thumb)");
  });
});
