// @vitest-environment jsdom
// Fold, by role, inside a real shadow root (ADR 0003): a button that says whether it's
// open, Enter and Space that toggle it with focus kept on it, a closed panel still in
// the page (hidden until found), and Escape left to the app.

import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_STYLESHEET as STYLESHEET } from "../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../surface/render.fixture.js";
import { Fold, FoldChevron, FoldPanel, FoldTrigger } from "./fold.js";
import CSS from "./fold.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

function Order({ defaultOpen, onOpenChange }: { defaultOpen?: boolean; onOpenChange?(open: boolean): void }) {
  return (
    <Fold defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <FoldTrigger>
        Order details
        <FoldChevron />
      </FoldTrigger>
      <FoldPanel>
        <button type="button">Linen shirt</button>
      </FoldPanel>
    </Fold>
  );
}

const panelOf = (trigger: HTMLElement) => trigger.closest("[data-fold]")?.querySelector<HTMLElement>("[data-fold-panel]") ?? null;

describe("Fold", () => {
  it("is a button that says it's closed, its panel hidden but still in the page", () => {
    const screen = renderInSurface(<Order />);
    const trigger = screen.getByRole("button", { name: "Order details", expanded: false });
    const panel = panelOf(trigger);
    expect(panel?.hidden).toBe(true);
    // Like a closed `<details>`: what's in it is still there, for find in page and for its own state.
    expect(screen.getByText("Linen shirt")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Linen shirt" })).toBeNull();
  });

  it("opens and closes on a click, and points the trigger at the panel", async () => {
    const user = setup();
    const screen = renderInSurface(<Order />);
    const trigger = screen.getByRole("button", { name: "Order details" });
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panelOf(trigger)?.hidden).toBe(false);
    expect(trigger.getAttribute("aria-controls")).toBe(panelOf(trigger)?.id);
    expect(screen.getByRole("button", { name: "Linen shirt" })).toBeTruthy();
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles on Enter and on Space, and keeps focus on the trigger", async () => {
    const user = setup();
    const changes = vi.fn();
    const screen = renderInSurface(<Order onOpenChange={changes} />);
    const trigger = screen.getByRole("button", { name: "Order details" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.shadow.activeElement).toBe(trigger);
    await user.keyboard(" ");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.shadow.activeElement).toBe(trigger);
    expect(changes.mock.calls).toEqual([[true], [false]]);
  });

  it("starts open when asked, and draws its state as attributes the CSS turns the chevron by", () => {
    const screen = renderInSurface(<Order defaultOpen />);
    const trigger = screen.getByRole("button", { name: "Order details", expanded: true });
    expect(trigger.hasAttribute("data-open")).toBe(true);
    expect(trigger.closest("[data-fold]")?.hasAttribute("data-open")).toBe(true);
    expect(trigger.querySelector("[data-fold-chevron]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("follows the caller's state when it keeps it, and opens only once the caller says so", async () => {
    const user = setup();
    function Kept() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Fold open={open} onOpenChange={setOpen}>
            <FoldTrigger inline>3 Instances</FoldTrigger>
            <FoldPanel>the list</FoldPanel>
          </Fold>
          <p>{open ? "open" : "closed"}</p>
        </>
      );
    }
    const screen = renderInSurface(<Kept />);
    const trigger = screen.getByRole("button", { name: "3 Instances" });
    expect(trigger.hasAttribute("data-inline")).toBe(true);
    await user.click(trigger);
    expect(screen.getByText("open")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const ignored = vi.fn();
    const still = renderInSurface(
      <Fold open={false} onOpenChange={ignored}>
        <FoldTrigger>Held shut</FoldTrigger>
        <FoldPanel>nothing</FoldPanel>
      </Fold>,
    );
    await user.click(still.getByRole("button", { name: "Held shut" }));
    expect(ignored).toHaveBeenCalledWith(true);
    expect(still.getByRole("button", { name: "Held shut" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("nests: an inner fold opens by itself", async () => {
    const user = setup();
    const screen = renderInSurface(
      <Fold defaultOpen>
        <FoldTrigger>Inspect only</FoldTrigger>
        <FoldPanel>
          <Fold>
            <FoldTrigger>1 set by the library</FoldTrigger>
            <FoldPanel>aria-expanded</FoldPanel>
          </Fold>
        </FoldPanel>
      </Fold>,
    );
    const inner = screen.getByRole("button", { name: "1 set by the library", expanded: false });
    await user.click(inner);
    expect(inner.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Inspect only" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("leaves Escape to the app: not prevented, nothing closed", async () => {
    const user = setup();
    const heard: KeyboardEvent[] = [];
    const listen = (event: KeyboardEvent) => heard.push(event);
    window.addEventListener("keydown", listen);
    try {
      const screen = renderInSurface(<Order defaultOpen />);
      screen.getByRole("button", { name: "Order details" }).focus();
      await user.keyboard("{Escape}");
      expect(heard.map((event) => [event.key, event.defaultPrevented])).toEqual([["Escape", false]]);
      expect(screen.getByRole("button", { name: "Order details" }).getAttribute("aria-expanded")).toBe("true");
    } finally {
      window.removeEventListener("keydown", listen);
    }
  });

  it("passes axe, closed and open", async () => {
    const closed = renderInSurface(<Order />);
    expect(await axeViolations(closed.host)).toEqual([]);
    closed.unmount();
    const open = renderInSurface(<Order defaultOpen />);
    expect(await axeViolations(open.host)).toEqual([]);
  });
});

describe("Fold's CSS", () => {
  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    expect(STYLESHEET).toContain(CSS);
    expect(STYLESHEET.indexOf(CSS)).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(STYLESHEET.indexOf(CSS)).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its motion from the tokens", () => {
    const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .map((chunk) => chunk.split("}").pop()?.trim() ?? "")
      .filter((selector) => selector && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(3);
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/(^|[\s>+~,(])\.[a-z]/i);
      expect(selector, selector).not.toMatch(/aria-/);
    }
    expect(CSS).toContain("[data-open]");
    // A browser without `until-found` hides a closed panel by `display: none`: nothing may undo it.
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[data-fold-panel\][^{]*\{[^}]*display/);
    expect(CSS).toContain("var(--duration-fold)");
    expect(CSS).not.toMatch(/\d+ms/);
  });
});
