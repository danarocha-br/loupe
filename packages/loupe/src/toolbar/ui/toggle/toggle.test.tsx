// @vitest-environment jsdom
// Toggle, by role, inside a real shadow root (ADR 0003): a button that says whether it's
// pressed, asks the caller for the other state on a click, Enter or Space, and draws
// pressed through an attribute, unless what it presses shows elsewhere.

import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Toggle } from "./toggle.js";
import CSS from "./toggle.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

function Marks({ onPressedChange = () => {} }: { onPressedChange?(pressed: boolean): void }) {
  const [hidden, setHidden] = useState(false);
  return (
    <Toggle
      look="tool"
      iconOnly
      pressed={hidden}
      onPressedChange={(next) => {
        onPressedChange(next);
        setHidden(next);
      }}
    >
      <svg aria-hidden="true" />
      <span className="sr-only">Hide marks</span>
    </Toggle>
  );
}

describe("Toggle", () => {
  it("is a button that says whether it's pressed, named the same either way", async () => {
    const user = setup();
    const screen = renderInSurface(<Marks />);
    const toggle = screen.getByRole("button", { name: "Hide marks", pressed: false });
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Hide marks", pressed: true })).toBe(toggle);
    expect(toggle.hasAttribute("data-pressed")).toBe(true);
  });

  it("asks for the other state on a click, on Enter and on Space", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(<Marks onPressedChange={asked} />);
    const toggle = screen.getByRole("button", { name: "Hide marks" });
    await user.click(toggle);
    toggle.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(asked.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("follows the caller: nothing changes until the caller passes the new state", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(
      <Toggle pressed={false} onPressedChange={asked} size="small">
        Hold open
      </Toggle>,
    );
    const toggle = screen.getByRole("button", { name: "Hold open" });
    await user.click(toggle);
    expect(asked).toHaveBeenCalledWith(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("draws Button's look, and leaves pressed unmarked when it shows elsewhere", () => {
    const screen = renderInSurface(
      <>
        <Toggle pressed onPressedChange={() => {}} size="small">
          Holding open
        </Toggle>
        <Toggle pressed onPressedChange={() => {}} size="large" iconOnly marksPressed={false}>
          <span className="sr-only">Dark theme</span>
        </Toggle>
      </>,
    );
    const holding = screen.getByRole("button", { name: "Holding open", pressed: true });
    expect([holding.getAttribute("data-look"), holding.getAttribute("data-size"), holding.hasAttribute("data-unmarked")]).toEqual(["soft", "small", false]);
    const theme = screen.getByRole("button", { name: "Dark theme", pressed: true });
    expect([theme.getAttribute("data-size"), theme.hasAttribute("data-icon-only"), theme.hasAttribute("data-unmarked")]).toEqual(["large", true, true]);
  });

  it("passes axe, pressed and not", async () => {
    const screen = renderInSurface(<Marks />);
    expect(await axeViolations(screen.host)).toEqual([]);
    await setup().click(screen.getByRole("button", { name: "Hide marks" }));
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Toggle's CSS", () => {
  it("comes after Button's in the primitives layer, so pressed draws over the look", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("[data-button][data-look=\"soft\"]"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("draws pressed in Highlight under forced colours, over the looks' pressed fills", () => {
    // jsdom has no cascade: weigh the selectors. Same layer, so the later rule wins a tie.
    const weight = (selector: string) => (selector.match(/\[/g) ?? []).length;
    const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const forced = body.slice(body.indexOf("@media (forced-colors: active)"));
    const pressedLooks = [...body.slice(0, body.indexOf("@media")).matchAll(/^(\[data-toggle\][^{]*)\{/gm)].map((match) => (match[1] as string).trim());
    const forcedRule = forced.match(/(\[data-toggle\][^{]*)\{/)?.[1]?.trim() ?? "";
    expect(pressedLooks.length).toBe(2);
    for (const look of pressedLooks) expect(weight(forcedRule), `${forcedRule} vs ${look}`).toBeGreaterThanOrEqual(weight(look));
    expect(forced).toContain("background: Highlight");
  });

  it("names states, not Loupe's classes or ARIA", () => {
    expect(CSS).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/aria-/);
    expect(CSS).toContain("[data-pressed]");
  });
});
