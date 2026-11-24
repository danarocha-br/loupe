// @vitest-environment jsdom
// PropRow, by role, inside a real shadow root (ADR 0003): a prop's row as panel-view
// decided it. Its delta, name and tags on the line; the change line; chips, a switch or a
// one-line field, each writing through its callbacks; Reset, which keeps focus in the row;
// the holding notice; and who keeps their own value.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INSPECTOR_WORDS, type PropItem } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { CHILDREN, DISABLED, OPEN, PROP_ITEMS, SIZE, TONE_AT_SCOPE, TYPE_INSPECT_ONLY, VARIANT } from "../samples.js";
import { PropRow, type PropRowProps } from "./prop-row.js";
import CSS from "./prop-row.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

function draw(item: PropItem, props: Partial<PropRowProps> = {}) {
  const calls = { onSet: vi.fn(), onText: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), onHover: vi.fn() };
  const screen = renderInSurface(<PropRow item={item} words={INSPECTOR_WORDS} {...calls} {...props} />);
  return { screen, ...calls };
}

describe("PropRow", () => {
  it("reads its line in order: the change's delta, the name, then Reset; its glyph hidden", () => {
    const { screen } = draw(VARIANT);
    const row = screen.shadow.querySelector<HTMLElement>("[data-prop=variant]") as HTMLElement;
    expect([row.getAttribute("data-row"), row.hasAttribute("data-overridden")]).toEqual(["inset", true]);
    expect(row.querySelector("[data-row-glyph]")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("img", { name: "Change 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(screen.getByTestId("change").textContent).toBe('"ghost" → "outline"');
  });

  it("names where a value comes from only when it comes from a wider scope", () => {
    expect(draw(SIZE).screen.getByTestId("change").textContent).toBe('"md" → "sm" · from All in MemberRowMenu');
    cleanup();
    expect(draw(VARIANT).screen.queryByTestId("source")).toBeNull();
  });

  it("offers a closed set as chips, the app's value and the default said with each, and writes the one chosen", async () => {
    const user = setup();
    const { screen, onSet } = draw(VARIANT);
    const group = screen.getByRole("radiogroup", { name: "variant" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { checked: true }).textContent).toBe("outline");
    expect(screen.getByRole("radio", { name: /^ghost.*the app’s value/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^solid.*the design system’s default/ })).toBeTruthy();
    // Arrow keys move, Space chooses: one write, not one per key.
    screen.getByRole("radio", { checked: true }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onSet).not.toHaveBeenCalled();
    await user.keyboard(" ");
    expect(onSet).toHaveBeenCalledWith(VARIANT.reset?.write, "link");
  });

  it("resets through its callback, and hands focus to the row's own control", async () => {
    const user = setup();
    const { screen, onReset } = draw(VARIANT);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledWith(VARIANT.reset?.write);
    expect(screen.shadow.activeElement).toBe(screen.getByRole("radio", { checked: true }));
  });

  it("draws a true/false prop as a switch, which writes true or false", async () => {
    const user = setup();
    const { screen, onSet } = draw(DISABLED);
    const toggle = screen.getByRole("switch", { name: "disabled" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    await user.click(toggle);
    expect(onSet).toHaveBeenCalledWith(expect.objectContaining({ prop: "disabled" }), true);
  });

  it("gives label text a one-line field named by the prop, says it is empty, and passes what is typed", async () => {
    const user = setup();
    const { screen, onText } = draw(CHILDREN);
    const field = screen.getByRole("textbox", { name: "Text" });
    expect(screen.getByTestId("empty").textContent).toBe("empty");
    expect(screen.getByTitle("Text (children)").textContent).toBe("Text children");
    await user.click(field);
    await user.keyboard("Hi{Enter}");
    expect(onText).toHaveBeenLastCalledWith(expect.objectContaining({ prop: "children" }), "Hi");
    expect((field as HTMLTextAreaElement).value).toBe("Hi");
  });

  it("says why a held State prop can't change here, holds its notice, and puts Reset in it", async () => {
    const user = setup();
    const { screen, onReset } = draw(OPEN);
    expect(screen.getByText("State prop")).toBeTruthy();
    expect(screen.getByTestId("state-only").textContent).toBe("A State prop changes per Instance.");
    const held = screen.getByTestId("held");
    expect(held.textContent).toContain("Your Override holds this at true; the app tried to set false.");
    expect(held.querySelectorAll("code")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledWith(OPEN.reset?.write);
    expect(screen.getByTestId("current").textContent).toBe("App value: false");
  });

  it("counts a scope's members on its line, and selects the one that keeps its own value", async () => {
    const user = setup();
    const { screen, onSelect, onHover } = draw(TONE_AT_SCOPE);
    expect(screen.getByTestId("counts").textContent).toBe("2 neutral · 2 danger");
    const keeping = screen.getByRole("button", { name: "1 of 4 keeps its own value" });
    await user.hover(keeping);
    expect(onHover).toHaveBeenLastCalledWith(["dani"]);
    await user.click(keeping);
    expect(onSelect).toHaveBeenCalledWith("dani");
    await user.unhover(keeping);
    expect(onHover).toHaveBeenLastCalledWith([]);
  });

  it("sets an Inspect only prop as a pair, with no glyph, its value and why", () => {
    const { screen } = draw(TYPE_INSPECT_ONLY, { look: "pair" });
    const row = screen.shadow.querySelector<HTMLElement>("[data-prop=type]") as HTMLElement;
    expect([row.getAttribute("data-row"), row.querySelector("[data-row-glyph]")]).toEqual(["pair", null]);
    expect(screen.getByTitle(INSPECTOR_WORDS.defaultTitle).textContent).toBe('"button"');
    expect(screen.getByTitle("The library sets it on every Button.").textContent).toBe("set by the library");
  });

  it("passes axe in every sample", async () => {
    const calls = { onSet: () => {}, onText: () => {}, onReset: () => {}, onSelect: () => {}, onHover: () => {} };
    const screen = renderInSurface(
      <>
        {[...PROP_ITEMS, TONE_AT_SCOPE].map((item) => (
          <PropRow key={item.name} item={item} words={INSPECTOR_WORDS} {...calls} />
        ))}
        <PropRow item={TYPE_INSPECT_ONLY} look="pair" words={INSPECTOR_WORDS} {...calls} />
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("PropRow's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("[data-prop][data-overridden] [data-field-control]");
  });
});
