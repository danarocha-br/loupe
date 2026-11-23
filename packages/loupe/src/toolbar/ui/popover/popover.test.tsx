// @vitest-environment jsdom
// Popover, by role, inside a real shadow root (ADR 0003): a named, non-modal dialog over
// its anchor that Escape and a press outside close, that a press on its toggle leaves to
// the toggle, and that hands focus back to what opened it.

import { userEvent } from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Popover, type PopoverCaret, PopoverPanel } from "./popover.js";
import CSS from "./popover.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

/** A footer, its toggle and the popover over it, as Copy Proposal draws them. */
function Harness({ focusTitle = false, caret, onOpenChange = () => {} }: { focusTitle?: boolean; caret?: PopoverCaret; onOpenChange?(open: boolean): void }) {
  const [open, setOpen] = useState(false);
  const footer = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const change = (next: boolean) => {
    onOpenChange(next);
    setOpen(next);
  };
  return (
    <>
      <button type="button">Elsewhere</button>
      <div ref={footer}>
        <button ref={toggle} type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
          Details
        </button>
      </div>
      <Popover open={open} onOpenChange={change} inside={toggle}>
        <PopoverPanel label="Copy with details" anchor={footer} returnFocus={toggle} initialFocus={focusTitle ? title : undefined} caret={caret}>
          <button type="button">First</button>
          <input ref={title} aria-label="Title" defaultValue="A suggested title" />
          <button type="button" onClick={() => change(false)}>
            Done
          </button>
        </PopoverPanel>
      </Popover>
    </>
  );
}

describe("Popover", () => {
  it("opens as a dialog named by its label, focusing the first thing in it", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Details" }));
    const dialog = screen.getByRole("dialog", { name: "Copy with details" });
    expect(screen.shadow.activeElement).toBe(screen.getByRole("button", { name: "First" }));
    // In place, beside what opened it, and in the top layer.
    expect(dialog.parentElement).toBe(screen.getByRole("button", { name: "Details" }).parentElement?.parentElement);
    expect(dialog.getAttribute("popover")).toBe("manual");
  });

  it("focuses the caller's choice as it opens, without selecting a field's text", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness focusTitle />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const title = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    expect(screen.shadow.activeElement).toBe(title);
    expect(title.selectionEnd! - title.selectionStart!).toBe(0);
  });

  it("closes on Escape and hands focus back to what opened it", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(<Harness onOpenChange={asked} />);
    const toggle = screen.getByRole("button", { name: "Details" });
    await user.click(toggle);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(asked).toHaveBeenLastCalledWith(false);
    expect(screen.shadow.activeElement).toBe(toggle);
  });

  it("takes Escape after the window's capture, so a layer claimed there keeps the key from those beneath", async () => {
    // escape.ts claims the popover's layer at the window, in capture: it hears the key
    // first, unhandled, and the selection beneath never does. The app hears it handled.
    const user = setup();
    const heard: string[] = [];
    const capture = (event: KeyboardEvent) => heard.push(`capture ${event.defaultPrevented}`);
    const bubble = (event: KeyboardEvent) => heard.push(`bubble ${event.defaultPrevented}`);
    window.addEventListener("keydown", capture, true);
    window.addEventListener("keydown", bubble);
    try {
      const screen = renderInSurface(<Harness />);
      await user.click(screen.getByRole("button", { name: "Details" }));
      await user.keyboard("{Escape}");
      expect(heard).toEqual(["capture false", "bubble true"]);
    } finally {
      window.removeEventListener("keydown", capture, true);
      window.removeEventListener("keydown", bubble);
    }
  });

  it("closes on a press outside, leaving focus where the press put it", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    await user.click(elsewhere);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.shadow.activeElement).toBe(elsewhere);
  });

  it("leaves a press on its toggle to the toggle, and stays open for a press inside", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    const toggle = screen.getByRole("button", { name: "Details" });
    await user.click(toggle);
    await user.click(screen.getByRole("textbox", { name: "Title" }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    // Not an outside press: the toggle's own click closes it, once.
    await user.click(toggle);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("hands focus back when the caller closes it with focus inside", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    const toggle = screen.getByRole("button", { name: "Details" });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.shadow.activeElement).toBe(toggle);
  });

  it("draws its caret where the caller says, under its middle by default", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-caret")).toBe("center");
    expect(dialog.querySelector("[data-popover-caret]")?.getAttribute("aria-hidden")).toBe("true");
    screen.rerender(<Harness caret="end" />);
    expect(screen.getByRole("dialog").getAttribute("data-caret")).toBe("end");
  });

  it("passes axe, open", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Popover's CSS", () => {
  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its values from the tokens", () => {
    const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .map((chunk) => chunk.split("}").pop()?.trim() ?? "")
      .filter((selector) => selector && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/(^|[\s>+~,(])\.[a-z]/i);
      expect(selector, selector).not.toMatch(/aria-/);
    }
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CSS).not.toMatch(/\d+ms|border-radius: *\d/);
    expect(CSS).not.toMatch(/(gap|padding)[^;]*\b\d+px/);
    expect(CSS).toContain("var(--radius-card)");
    expect(CSS).toContain("var(--popover-shadow)");
    // The browser's `[popover]` would scroll it, and clip the caret.
    expect(CSS).toContain("overflow: visible");
  });
});
