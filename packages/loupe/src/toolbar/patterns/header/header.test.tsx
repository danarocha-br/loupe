// @vitest-environment jsdom
// PanelHeader and StatusStrip, by role, inside a real shadow root (ADR 0003): the wordmark
// and the page, the select tools as one radio group, Hide marks as a toggle, Hide; and
// the strip under them, its keys in `kbd`.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HEADER_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { HEADER_PAGE } from "../samples.js";
import { PanelHeader, type PanelHeaderProps, StatusStrip } from "./header.js";
import CSS from "./header.css?inline";

afterEach(cleanup);

function draw(props: Partial<PanelHeaderProps> = {}) {
  const calls = { onTool: vi.fn(), onMarks: vi.fn(), onHide: vi.fn() };
  const screen = renderInSurface(<PanelHeader page={HEADER_PAGE} mode="one" armed={false} marksHidden={false} words={HEADER_WORDS} {...calls} {...props} />);
  return { screen, ...calls };
}

describe("PanelHeader", () => {
  it("names Loupe by its wordmark, then the page, its report and route in the tooltip", () => {
    const { screen } = draw();
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Loupe" })).toBeTruthy();
    const page = screen.getByText(/Billing$/);
    expect(page.textContent).toBe("/ Billing");
    expect(page.getAttribute("title")).toBe(HEADER_PAGE.title);
  });

  it("leaves the page out while an Instance's identity names it", () => {
    const { screen } = draw({ page: null });
    expect(screen.shadow.querySelector("[data-header-page]")).toBeNull();
  });

  it("draws the select tools as one radio group, the mode checked, and picks the other", async () => {
    const user = userEvent.setup({ document });
    const { screen, onTool } = draw();
    const group = screen.getByRole("radiogroup", { name: "Select" });
    const [one, many] = [screen.getByRole("radio", { name: "Select one" }), screen.getByRole("radio", { name: "Select multiple" })];
    expect(group.contains(one) && group.contains(many)).toBe(true);
    expect(one.getAttribute("aria-checked")).toBe("true");
    expect(many.getAttribute("aria-checked")).toBe("false");
    expect(many.getAttribute("title")).toBe(HEADER_WORDS.tools.many.title);
    await user.click(many);
    expect(onTool).toHaveBeenCalledWith("many");
  });

  it("marks the checked tool armed while it picks on the page", () => {
    const { screen } = draw({ mode: "many", armed: true });
    expect(screen.getByRole("radio", { name: "Select multiple" }).hasAttribute("data-armed")).toBe(true);
    expect(screen.getByRole("radio", { name: "Select one" }).hasAttribute("data-armed")).toBe(false);
  });

  it("presses Hide marks while the marks are off the page, its tooltip saying what a press does", async () => {
    const user = userEvent.setup({ document });
    const { screen, onMarks } = draw();
    const marks = screen.getByRole("button", { name: "Hide marks" });
    expect(marks.getAttribute("aria-pressed")).toBe("false");
    expect(marks.getAttribute("title")).toBe(HEADER_WORDS.marks.hide);
    await user.click(marks);
    expect(onMarks).toHaveBeenCalledTimes(1);
    cleanup();
    const hidden = draw({ marksHidden: true }).screen.getByRole("button", { name: "Hide marks" });
    expect(hidden.getAttribute("aria-pressed")).toBe("true");
    expect(hidden.getAttribute("title")).toBe(HEADER_WORDS.marks.show);
  });

  it("hides the panel through its callback", async () => {
    const user = userEvent.setup({ document });
    const { screen, onHide } = draw();
    await user.click(screen.getByRole("button", { name: "Hide panel" }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations, idle and armed with the marks hidden", async () => {
    const { screen } = draw();
    expect(await axeViolations(screen.host)).toEqual([]);
    cleanup();
    const armed = draw({ page: null, mode: "many", armed: true, marksHidden: true }).screen;
    expect(await axeViolations(armed.host)).toEqual([]);
  });
});

describe("StatusStrip", () => {
  it("says what the page is doing, its keys in kbd, and keeps its region while it says nothing", async () => {
    const screen = renderInSurface(<StatusStrip parts={HEADER_WORDS.strip.pick.one} />);
    expect(screen.shadow.querySelector("[data-strip]")?.textContent).toBe("Click an Instance on the page · Esc cancels");
    expect(screen.shadow.querySelector("kbd")?.textContent).toBe("Esc");
    expect(await axeViolations(screen.host)).toEqual([]);
    screen.rerender(<StatusStrip parts={null} />);
    expect(screen.shadow.querySelector("[data-strip-region]")).not.toBeNull();
    expect(screen.shadow.querySelector("[data-strip]")).toBeNull();
  });
});

describe("PanelHeader's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("var(--font-annotation)");
  });
});
