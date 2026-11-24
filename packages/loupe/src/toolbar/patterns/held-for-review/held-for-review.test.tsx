// @vitest-environment jsdom
// HeldForReview, by role, inside a real shadow root (ADR 0003): a level-3 heading after its
// hollow ring, its count, and a list item per held record with what it names, Discard, why
// it is held and what it would set; Discard goes out through its callback.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { HELD, HELD_META } from "../samples.js";
import { HeldForReview } from "./held-for-review.js";
import CSS from "./held-for-review.css?inline";

afterEach(cleanup);

function draw(items = HELD) {
  const onDiscard = vi.fn();
  const screen = renderInSurface(<HeldForReview items={items} meta={HELD_META} words={LIST_WORDS} onDiscard={onDiscard} />);
  return { screen, onDiscard };
}

describe("HeldForReview", () => {
  it("heads its card after a hollow ring, with its count", () => {
    const { screen } = draw();
    const heading = screen.getByRole("heading", { level: 3, name: "Held for review" });
    expect(heading.previousElementSibling?.hasAttribute("data-dot")).toBe(true);
    expect(screen.getByText(HELD_META)).toBeTruthy();
  });

  it("lists each record as a Row item: what it names, Discard, why it is held, and what it would set", () => {
    const { screen } = draw();
    const rows = screen.getAllByRole("listitem").filter((item) => item.hasAttribute("data-row"));
    expect(rows.map((row) => row.getAttribute("data-row"))).toEqual(["item", "item"]);
    expect(rows[0]?.textContent).toBe(HELD[0]?.label + "Discard" + HELD[0]?.why + 'variant "outline"');
    expect(screen.getAllByTestId("held-values").map((values) => values.children.length)).toEqual([1, 2]);
  });

  it("discards a record through its callback", async () => {
    const user = userEvent.setup({ document });
    const { screen, onDiscard } = draw();
    await user.click(screen.getAllByRole("button", { name: "Discard" })[1] as HTMLElement);
    expect(onDiscard).toHaveBeenCalledWith(HELD[1]?.target);
  });

  it("draws nothing while nothing is held", () => {
    const { screen } = draw([]);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("has no axe violations", async () => {
    expect(await axeViolations(draw().screen.host)).toEqual([]);
  });
});

describe("HeldForReview's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
