// @vitest-environment jsdom
// NoGroup, by role, inside a real shadow root (ADR 0003): why the Instance is selected
// alone, and the move that widens the selection to the page.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../testing.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { NO_GROUP } from "../samples.js";
import { NoGroup } from "./no-group.js";
import CSS from "./no-group.css?inline";

afterEach(cleanup);

describe("NoGroup", () => {
  it("says why it is alone, and widens to the page", async () => {
    const user = userEvent.setup({ document });
    const onScope = vi.fn();
    const screen = renderInSurface(<NoGroup noGroup={NO_GROUP} onScope={onScope} />);
    expect(screen.getByText(NO_GROUP.text)).toBeTruthy();
    const widen = screen.getByRole("button", { name: /Widen to All on page · 11/ });
    expect(widen.getAttribute("title")).toBe(NO_GROUP.widen?.title);
    await user.click(widen);
    expect(onScope).toHaveBeenCalledWith("page");
  });

  it("offers no move when the page scope doesn't apply", () => {
    const screen = renderInSurface(<NoGroup noGroup={{ ...NO_GROUP, widen: null }} onScope={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no axe violations", async () => {
    const screen = renderInSurface(<NoGroup noGroup={NO_GROUP} onScope={() => {}} />);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("NoGroup's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
