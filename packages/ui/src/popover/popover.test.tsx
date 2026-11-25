// @vitest-environment jsdom
// Popover, by role, inside a real shadow root (ADR 0003): a named, non-modal dialog over
// its anchor that Escape and a press outside close, that a press on its toggle leaves to
// the toggle, and that hands focus back to what opened it.

import { userEvent } from "@testing-library/user-event";
import { act, useLayoutEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_STYLESHEET as STYLESHEET } from "../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../surface/render.fixture.js";
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

  it("focuses the first thing in it without selecting a field's text", async () => {
    const user = setup();
    function FieldFirst() {
      const [open, setOpen] = useState(false);
      const footer = useRef<HTMLDivElement>(null);
      const toggle = useRef<HTMLButtonElement>(null);
      return (
        <>
          <div ref={footer}>
            <button ref={toggle} type="button" onClick={() => setOpen(true)}>
              Rename
            </button>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverPanel label="Rename" anchor={footer} returnFocus={toggle}>
              <input aria-label="Name" defaultValue="A saved name" />
            </PopoverPanel>
          </Popover>
        </>
      );
    }
    const screen = renderInSurface(<FieldFirst />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    expect(screen.shadow.activeElement).toBe(name);
    expect(name.selectionEnd! - name.selectionStart!).toBe(0);
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

  it("closes on Escape with focus on its toggle, which counts as inside only for a press or focus", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    const toggle = screen.getByRole("button", { name: "Details" });
    await user.click(toggle);
    // Focus moved from inside to the toggle (Shift+Tab, in a browser): the popover stays open.
    act(() => toggle.focus());
    expect(screen.shadow.activeElement).toBe(toggle);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("has its anchor and its width when UI SDK first measures it, as it opens", async () => {
    // UI SDK places the box as it mounts, and again only on its next frame, which a
    // throttled tab may not run for a second. It measures the box first and only then
    // writes `--anchor-width`: a box sized by that stood 41px off-centre until that frame,
    // and Copy Proposal's details landed at x = 694 or x = 735 from run to run. A box
    // mounted before its anchor was known stood at the viewport's corner. So UI SDK
    // measures it as the open's click lands, and whatever its width reads, a token
    // aside, is the anchor's width by then: its layout width, which a zoom around them
    // both would scale again, on every open, however it has changed since the last.
    const declarations = /\[data-popover\]\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    const width = /(?:^|[\s;])width:\s*([^;]+);/.exec(declarations)?.[1] ?? "";
    const variables = [...width.matchAll(/var\((--[\w-]+)\)/g)].map(([, name]) => name!).filter((name) => !STYLESHEET.includes(`${name}:`));
    expect(variables.length, width).toBeGreaterThan(0);
    // jsdom lays nothing out: the footer Copy Proposal stands over, drawn at a zoom of 1.5.
    let footerWidth = 332;
    const ZOOM = 1.5;
    let footer: HTMLElement | null = null;
    let measured: Record<string, string> | undefined;
    const offsetWidth = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      if (this === footer) return footerWidth;
      if (!measured && this.hasAttribute("data-popover")) {
        measured = Object.fromEntries(variables.map((name) => [name, this.style.getPropertyValue(name)]));
      }
      return 0;
    });
    function Footer() {
      const [open, setOpen] = useState(false);
      const anchor = useRef<HTMLDivElement>(null);
      const toggle = useRef<HTMLButtonElement>(null);
      useLayoutEffect(() => {
        footer = anchor.current!;
        footer.getBoundingClientRect = () => {
          const drawn = footerWidth * ZOOM;
          return { x: 942, y: 684, left: 942, top: 684, right: 942 + drawn, bottom: 786, width: drawn, height: 102, toJSON: () => ({}) };
        };
      }, []);
      return (
        <div ref={anchor}>
          <button ref={toggle} type="button" onClick={() => setOpen(!open)}>
            Details
          </button>
          <Popover open={open} onOpenChange={setOpen} inside={toggle}>
            <PopoverPanel label="Copy with details" anchor={anchor} returnFocus={toggle} caret="end">
              <button type="button">First</button>
            </PopoverPanel>
          </Popover>
        </div>
      );
    }
    try {
      const user = setup();
      const screen = renderInSurface(<Footer />);
      const toggle = screen.getByRole("button", { name: "Details" });
      // Opened, then opened again after the footer widened while it was closed, with no
      // ResizeObserver to say so (jsdom has none; a browser's may not have reported yet).
      // No waiting: measured on UI SDK's next frame would be too late.
      for (const next of [332, 372]) {
        footerWidth = next;
        measured = undefined;
        await user.click(toggle);
        screen.getByRole("dialog", { name: "Copy with details" });
        expect(measured).toEqual(Object.fromEntries(variables.map((name) => [name, `${next}px`])));
        await user.click(toggle);
        expect(screen.queryByRole("dialog")).toBeNull();
      }
    } finally {
      offsetWidth.mockRestore();
    }
  });

  it("passes axe, open", async () => {
    const user = setup();
    const screen = renderInSurface(<Harness />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("what Popover leaves in the host's document", () => {
  it("is UI SDK's two documented styles, in its lowest layer, each matching only UI SDK's own parts", async () => {
    // UI SDK writes these to the document, never a shadow root: they don't reach Loupe's
    // shadow tree, and in the host they match only `data-slot` elements, at zero specificity.
    // A new one fails here: a style that reaches the app is a decision, not a side effect.
    const user = setup();
    const screen = renderInSurface(<Harness />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const styles = [...document.querySelectorAll<HTMLStyleElement>("style[id^='ui-sdk-']")];
    const adopted = (document.adoptedStyleSheets ?? []).flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText));
    const css = [...styles.map((style) => style.textContent ?? ""), ...adopted];
    expect(styles.map((style) => style.id).sort()).toEqual(["ui-sdk-hidden", "ui-sdk-popover-reset"]);
    for (const text of css) {
      expect(text, text).toMatch(/^\s*@layer ui-sdk\s*\{\s*:where\(\[data-slot/);
    }
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
