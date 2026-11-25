// @vitest-environment jsdom
// ChangeList, by role, inside a real shadow root (ADR 0003): an ordered list named
// "Changes", a button per change named by its delta, what it changes and what it reaches;
// a press selects, pointing outlines, and a change whose Instance isn't mounted is off.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { CHANGES, WORDS } from "../samples.js";
import { ChangeList } from "./change-list.js";
import CSS from "./change-list.css?inline";

afterEach(cleanup);

function draw(changes = CHANGES) {
  const calls = { onSelect: vi.fn(), onHover: vi.fn() };
  return { screen: renderInSurface(<ChangeList changes={changes} words={WORDS.list} {...calls} />), ...calls };
}

describe("ChangeList", () => {
  it("lists each change as a button: its delta, what it changes, what it reaches", () => {
    const { screen } = draw();
    expect(screen.getByRole("heading", { level: 3, name: "Changes" })).toBeTruthy();
    expect(screen.getByText("numbered as in the Proposal").hasAttribute("data-meta")).toBe(true);
    const list = screen.getByRole("list", { name: "Changes" });
    expect(list.tagName).toBe("OL");
    const rows = screen.getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual(CHANGES.map((change) => `${change.n}${change.detail}${change.where}`));
    expect(screen.getAllByRole("img").map((delta) => delta.getAttribute("aria-label"))).toEqual(["Change 1", "Change 2", "Change 3"]);
  });

  it("selects what a change reaches, and outlines it while pointed at or focused", async () => {
    const user = userEvent.setup({ document });
    const { screen, onSelect, onHover } = draw();
    const second = screen.getAllByRole("button")[1] as HTMLElement;
    await user.hover(second);
    expect(onHover).toHaveBeenLastCalledWith(["eva", "fabio"]);
    await user.unhover(second);
    expect(onHover).toHaveBeenLastCalledWith([]);
    await user.click(second);
    expect(onSelect).toHaveBeenCalledWith("eva");
  });

  it("turns off a change whose Instance isn't mounted", () => {
    const { screen } = draw();
    expect(screen.getAllByRole("button").map((row) => (row as HTMLButtonElement).disabled)).toEqual([false, false, true]);
  });

  it("draws nothing with no change", () => {
    const { screen } = draw([]);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { screen } = draw();
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("ChangeList's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
