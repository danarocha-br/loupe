// @vitest-environment jsdom
// Button, by role, inside a real shadow root (ADR 0003): a native button named by its
// text, pressed by a click, Enter or Space, never left pending, disabled out of reach,
// and its look drawn as attributes.

import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Button } from "./button.js";
import CSS from "./button.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

describe("Button", () => {
  it("is a native button named by its text, that never submits a form by default", () => {
    const screen = renderInSurface(<Button>Reset all</Button>);
    const button = screen.getByRole("button", { name: "Reset all" }) as HTMLButtonElement;
    expect(button.type).toBe("button");
  });

  it("runs its action on a click, on Enter and on Space", async () => {
    const user = setup();
    const pressed = vi.fn();
    const screen = renderInSurface(<Button onClick={pressed}>Discard</Button>);
    const button = screen.getByRole("button", { name: "Discard" });
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(pressed).toHaveBeenCalledTimes(3);
  });

  it("is never left pending by an action that returns a Promise", async () => {
    const user = setup();
    const copied = vi.fn();
    // The command's Copy returns the clipboard's Promise; a second press must still copy.
    const screen = renderInSurface(<Button onClick={() => void new Promise(() => copied())}>Copy</Button>);
    const button = screen.getByRole("button", { name: "Copy" });
    await user.click(button);
    await user.click(button);
    expect(copied).toHaveBeenCalledTimes(2);
    expect(button.hasAttribute("data-pending")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
  });

  it("does nothing while disabled, and says so", async () => {
    const user = setup();
    const pressed = vi.fn();
    const screen = renderInSurface(
      <Button disabled onClick={pressed}>
        Reset all
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Reset all" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(pressed).not.toHaveBeenCalled();
  });

  it("submits its form when it is the form's submit button", async () => {
    const user = setup();
    const submitted = vi.fn((event: SubmitEvent) => event.preventDefault());
    const screen = renderInSurface(
      <form onSubmit={(event) => submitted(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" look="primary">
          Copy with these details
        </Button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Copy with these details" }));
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it("passes the caller's aria-disabled through, for a press that waits its turn and keeps focus", () => {
    // Copy Proposal's popover: while a copy runs, its buttons say so and stay focusable.
    const screen = renderInSurface(
      <Button look="primary" aria-disabled>
        Copy with these details
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Copy with these details" }) as HTMLButtonElement;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.disabled).toBe(false);
  });

  it("hands its element to a ref, for a view that moves focus to it", () => {
    const ref = createRef<HTMLButtonElement>();
    const screen = renderInSurface(<Button ref={ref}>Retry</Button>);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Retry" }));
  });

  it("draws its look as attributes: soft by default, a size for each look", () => {
    const screen = renderInSurface(
      <>
        <Button>Soft</Button>
        <Button size="small">Small</Button>
        <Button look="primary">Primary</Button>
        <Button look="tool" iconOnly aria-label="Hide panel">
          <svg aria-hidden="true" />
        </Button>
      </>,
    );
    const look = (name: string) => {
      const button = screen.getByRole("button", { name });
      return [button.getAttribute("data-look"), button.getAttribute("data-size"), button.hasAttribute("data-icon-only")];
    };
    expect(look("Soft")).toEqual(["soft", "medium", false]);
    expect(look("Small")).toEqual(["soft", "small", false]);
    expect(look("Primary")).toEqual(["primary", "large", false]);
    expect(look("Hide panel")).toEqual(["tool", "medium", true]);
  });

  it("takes a size on a soft pill only: the primary is always 40px and a tool 30px", () => {
    renderInSurface(
      <>
        {/* @ts-expect-error A tool has one size. */}
        <Button look="tool" size="large">
          Tool
        </Button>
        {/* @ts-expect-error The primary has one size. */}
        <Button look="primary" size="small">
          Primary
        </Button>
      </>,
    );
  });

  it("passes axe", async () => {
    const screen = renderInSurface(
      <>
        <Button>Reset all</Button>
        <Button look="tool" iconOnly>
          <svg aria-hidden="true" />
          <span className="sr-only">Hide panel</span>
        </Button>
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Button's CSS", () => {
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
    expect(selectors.length).toBeGreaterThan(8);
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/(^|[\s>+~,(])\.[a-z]/i);
      expect(selector, selector).not.toMatch(/aria-/);
    }
    expect(CSS).not.toMatch(/font(-size)?: *\d/);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CSS).not.toMatch(/\d+ms|999px|border-radius: *\d/);
    // Spacing that has a step on the scale takes it: 6, 8, 12 and 16px.
    expect(CSS).not.toMatch(/(gap|padding)[^;]*\b(6|8|12|16)px/);
    expect(CSS).toContain("var(--font-control)");
    expect(CSS).toContain("var(--font-action)");
  });
});
