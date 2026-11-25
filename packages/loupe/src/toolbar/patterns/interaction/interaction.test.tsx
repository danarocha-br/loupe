// @vitest-environment jsdom
// AppearsOnInteraction, by role, inside a real shadow root (ADR 0003): a level-3 heading and
// its count, and a list named by it with an item per component, each a Row item.

import { afterEach, describe, expect, it } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { INTERACTION, WORDS } from "../samples.js";
import { AppearsOnInteraction } from "./interaction.js";
import CSS from "./interaction.css?inline";

afterEach(cleanup);

describe("AppearsOnInteraction", () => {
  it("lists each component seen but not mounted, with how to get it on screen", () => {
    const screen = renderInSurface(<AppearsOnInteraction components={INTERACTION} words={WORDS.list} />);
    expect(screen.getByRole("heading", { level: 3 }).parentElement?.textContent).toBe("Appears on interaction" + "Not on screen yet");
    const items = screen.getAllByRole("listitem");
    expect(screen.getByRole("list", { name: "Appears on interaction" })).toBeTruthy();
    expect(items.map((item) => [item.getAttribute("data-row"), item.textContent])).toEqual(
      INTERACTION.map((component) => ["item", component + WORDS.list.interaction.seen]),
    );
  });

  it("draws nothing while nothing is seen", () => {
    const screen = renderInSurface(<AppearsOnInteraction components={[]} words={WORDS.list} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("has no axe violations", async () => {
    const screen = renderInSurface(<AppearsOnInteraction components={INTERACTION} words={WORDS.list} />);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("AppearsOnInteraction's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
