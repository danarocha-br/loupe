// @vitest-environment jsdom
// ChipGroup, by role, inside a real shadow root (ADR 0003): one tab stop, arrows that
// move without choosing, Space and Enter that choose, Escape left to the app, and
// the marks drawn through state attributes.

import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Chip, ChipGroup } from "./chip-group.js";
import CSS from "./chip-group.css?inline";

afterEach(cleanup);

const SIZES = ["sm", "md", "lg"];

/** A group the way a caller keeps it: the value is the caller's, chosen through `onChoose`. */
function Sizes({ initial = null, onChoose = () => {} }: { initial?: string | null; onChoose?(value: string): void }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ChipGroup
      label="size"
      value={value}
      onChoose={(next) => {
        onChoose(next);
        setValue(next);
      }}
    >
      {SIZES.map((size) => (
        <Chip key={size} value={size}>
          {size}
        </Chip>
      ))}
    </ChipGroup>
  );
}

const setup = () => userEvent.setup({ document });

describe("ChipGroup", () => {
  it("is a named radio group of chips, with the chosen one checked", () => {
    const screen = renderInSurface(<Sizes initial="md" />);
    const group = screen.getByRole("radiogroup", { name: "size" });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual(SIZES);
    expect(screen.getByRole("radio", { checked: true }).textContent).toBe("md");
    expect(screen.getAllByRole("radio", { checked: false }).map((radio) => radio.textContent)).toEqual(["sm", "lg"]);
  });

  it("checks none while the value is decided elsewhere, and keeps one tab stop on the first chip", () => {
    const screen = renderInSurface(<Sizes />);
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
    expect(screen.getAllByRole("radio").map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
  });

  it("holds the tab stop on the checked chip, and moves it as focus moves", async () => {
    // user-event's Tab doesn't walk into a shadow root: the stop is read from `tabIndex`.
    const user = setup();
    const screen = renderInSurface(<Sizes initial="lg" />);
    const stops = () => screen.getAllByRole("radio").map((radio) => radio.tabIndex);
    expect(stops()).toEqual([-1, -1, 0]);
    screen.getByRole("radio", { name: "lg" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(stops()).toEqual([-1, 0, -1]);
  });

  it("moves focus with the arrow keys without choosing, and wraps (manual activation)", async () => {
    const user = setup();
    const chosen = vi.fn();
    const screen = renderInSurface(<Sizes initial="sm" onChoose={chosen} />);
    screen.getByRole("radio", { name: "sm" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.shadow.activeElement).toBe(screen.getByRole("radio", { name: "md" }));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.shadow.activeElement).toBe(screen.getByRole("radio", { name: "sm" }));
    await user.keyboard("{ArrowLeft}");
    expect(screen.shadow.activeElement).toBe(screen.getByRole("radio", { name: "lg" }));
    expect(chosen).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { checked: true }).textContent).toBe("sm");
  });

  it("chooses the focused chip with Space or Enter", async () => {
    const user = setup();
    const chosen = vi.fn();
    const screen = renderInSurface(<Sizes initial="sm" onChoose={chosen} />);
    screen.getByRole("radio", { name: "sm" }).focus();
    await user.keyboard("{ArrowRight} ");
    expect(chosen).toHaveBeenLastCalledWith("md");
    expect(screen.getByRole("radio", { checked: true }).textContent).toBe("md");
    await user.keyboard("{ArrowRight}{Enter}");
    expect(chosen).toHaveBeenLastCalledWith("lg");
    expect(chosen).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("radio", { checked: true }).textContent).toBe("lg");
  });

  it("chooses on a click, the checked chip again included", async () => {
    const user = setup();
    const chosen = vi.fn();
    const screen = renderInSurface(<Sizes initial="sm" onChoose={chosen} />);
    await user.click(screen.getByRole("radio", { name: "lg" }));
    expect(chosen.mock.calls).toEqual([["lg"]]);
    // A select tool pressed again stops picking: the press means something though nothing changes.
    await user.click(screen.getByRole("radio", { name: "lg" }));
    expect(chosen.mock.calls).toEqual([["lg"], ["lg"]]);
  });

  it("leaves Escape to the app: not prevented, not stopped, nothing chosen", async () => {
    const user = setup();
    const chosen = vi.fn();
    const heard: KeyboardEvent[] = [];
    const listen = (event: KeyboardEvent) => heard.push(event);
    window.addEventListener("keydown", listen);
    try {
      const screen = renderInSurface(<Sizes initial="sm" onChoose={chosen} />);
      screen.getByRole("radio", { name: "md" }).focus();
      await user.keyboard("{Escape}");
      expect(heard.map((event) => [event.key, event.defaultPrevented])).toEqual([["Escape", false]]);
      expect(chosen).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", listen);
    }
  });

  it("draws its marks as state attributes, and says what they mean", () => {
    const screen = renderInSurface(
      <ChipGroup label="variant" value="ghost" onChoose={() => {}}>
        <Chip value="solid" tag="app" description="the app’s value">
          solid
        </Chip>
        <Chip value="ghost" count={3}>
          ghost
        </Chip>
        <Chip value="link" dot description="the design system’s default">
          link
        </Chip>
      </ChipGroup>,
    );
    const [solid, ghost, link] = screen.getAllByRole("radio") as [HTMLElement, HTMLElement, HTMLElement];
    expect(ghost.hasAttribute("data-checked")).toBe(true);
    expect(solid.hasAttribute("data-unchecked")).toBe(true);
    expect(solid.hasAttribute("data-tagged")).toBe(true);
    expect(link.hasAttribute("data-dotted")).toBe(true);
    expect(ghost.querySelector('[data-part="count"]')?.textContent).toBe("3");
    // The tag is seen, not read twice: the description says it.
    expect(screen.getByRole("radio", { name: "solid , the app’s value" })).toBe(solid);
    expect(screen.getByRole("radio", { name: "link , the design system’s default" })).toBe(link);
  });

  it("says a choice is on its way on the group, and keeps the chips usable", () => {
    const screen = renderInSurface(
      <ChipGroup label="plan" value={null} busy onChoose={() => {}}>
        <Chip value="free">Free</Chip>
        <Chip value="pro">Pro</Chip>
      </ChipGroup>,
    );
    expect(screen.getByRole("radiogroup", { name: "plan" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLButtonElement).disabled)).toBe(true);
  });

  it("passes axe, checked and with nothing checked", async () => {
    const checked = renderInSurface(<Sizes initial="md" />);
    expect(await axeViolations(checked.host)).toEqual([]);
    checked.unmount();
    const none = renderInSurface(<Sizes />);
    expect(await axeViolations(none.host)).toEqual([]);
  });
});

describe("ChipGroup's CSS", () => {
  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const screen = renderInSurface(<Sizes />);
    const sheet = [...screen.shadow.querySelectorAll("style")].map((style) => style.textContent).join("");
    expect(sheet).toBe(STYLESHEET);
    expect(STYLESHEET.startsWith("@layer tokens, primitives, patterns;")).toBe(true);
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA", () => {
    const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .map((chunk) => chunk.split("}").pop()?.trim() ?? "")
      .filter((selector) => selector && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/(^|[\s>+~,(])\.[a-z]/i);
      expect(selector, selector).not.toMatch(/aria-/);
    }
    expect(CSS).toContain("[data-checked]");
    expect(CSS).toMatch(/\[data-chip\]:focus-visible/);
  });

  it("takes its values from the tokens: no px font sizes, no literal colours", () => {
    expect(CSS).not.toMatch(/font(-size)?: *\d/);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CSS).toContain("var(--font-option)");
  });
});
