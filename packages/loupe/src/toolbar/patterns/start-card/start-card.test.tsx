// @vitest-environment jsdom
// StartCard, by role, inside a real shadow root (ADR 0003): the view's level-2 heading, and
// the two select tools as a radio group of tiles, the mode checked, armed a state only the
// look carries; Space or Enter chooses (ChipGroup), and the checked tile pressed again
// chooses again, so a view can stop picking.

import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_WORDS, type SelectMode } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { StartCard } from "./start-card.js";
import CSS from "./start-card.css?inline";

afterEach(cleanup);

function draw(mode: SelectMode = "one", armed = false) {
  const onTool = vi.fn();
  const heading = createRef<HTMLHeadingElement>();
  const screen = renderInSurface(<StartCard words={LIST_WORDS} mode={mode} armed={armed} onTool={onTool} headingRef={heading} />);
  const tile = (name: string) => screen.getByRole("radio", { name: new RegExp(`^${name}`) });
  return { screen, onTool, heading, tile };
}

describe("StartCard", () => {
  it("asks what to change in the view's one level-2 heading, which takes focus", () => {
    const { screen, heading } = draw();
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toBe("What do you want to change?");
    expect(heading.current).toBe(h2);
    expect(h2.tabIndex).toBe(-1);
    expect(screen.getByText(LIST_WORDS.start.body)).toBeTruthy();
  });

  it("draws the select tools as a named radio group of tiles, each saying what it does", () => {
    const { screen, tile } = draw();
    expect(screen.getByRole("radiogroup", { name: "Start selecting" })).toBeTruthy();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Select one" + "Click one thing on the page",
      "Select multiple" + "Every Instance from one call site",
    ]);
    expect(tile("Select one").getAttribute("aria-checked")).toBe("true");
    expect(tile("Select multiple").getAttribute("title")).toBe(LIST_WORDS.tools.many.title);
    // The preview is a picture of what the words say.
    expect(tile("Select multiple").querySelector("[data-tool-preview]")?.getAttribute("aria-hidden")).toBe("true");
    expect(tile("Select multiple").querySelectorAll('[data-preview-chip="dashed"]')).toHaveLength(2);
    expect(tile("Select one").querySelectorAll('[data-preview-chip="dashed"]')).toHaveLength(0);
  });

  it("rings the tile in use while it is armed, and says nothing of it on the radio", () => {
    const { screen, tile } = draw("many", true);
    expect(tile("Select multiple").getAttribute("aria-checked")).toBe("true");
    expect(tile("Select multiple").hasAttribute("data-armed")).toBe(true);
    expect(tile("Select one").hasAttribute("data-armed")).toBe(false);
    expect(screen.shadow.querySelector("[aria-pressed]")).toBeNull();
  });

  it("chooses a tool on press, and again on the checked one, so the view can stop picking", async () => {
    const user = userEvent.setup({ document });
    const { tile, onTool } = draw();
    await user.click(tile("Select multiple"));
    expect(onTool).toHaveBeenLastCalledWith("many");
    await user.click(tile("Select one"));
    expect(onTool).toHaveBeenLastCalledWith("one");
  });

  it("passes axe, at rest and armed", async () => {
    expect(await axeViolations(draw().screen.host)).toEqual([]);
    cleanup();
    expect(await axeViolations(draw("many", true).screen.host)).toEqual([]);
  });
});

describe("StartCard's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    // Focus on the heading draws no ring, but keeps an outline forced colours draw.
    expect(CSS).toMatch(/\[data-start\] h2:focus \{ outline: 2px solid transparent; \}/);
  });
});
