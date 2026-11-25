// @vitest-environment jsdom
// PanelFooter, by role, inside a real shadow root (ADR 0003): the count said once, the
// held chip, Reset all and the undo offer after it, light or dark, and Copy Proposal in
// its slot.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { FOOTER, FOOTER_EMPTY, UNDO_OFFER, WORDS } from "../samples.js";
import { PanelFooter, type PanelFooterProps } from "./footer.js";
import CSS from "./footer.css?inline";

afterEach(cleanup);

function draw(props: Partial<PanelFooterProps> = {}) {
  const calls = { onResetAll: vi.fn(), onUndo: vi.fn(), onTheme: vi.fn() };
  const screen = renderInSurface(
    <PanelFooter footer={FOOTER} words={WORDS.footer} undo={null} theme="light" copy={<button type="button">Copy Proposal</button>} {...calls} {...props} />,
  );
  return { screen, ...calls };
}

describe("PanelFooter", () => {
  it("says the count once, whole, and draws its figure, word and held chip for the eye", () => {
    const { screen } = draw();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    // Read by assistive technology, unlike everything else in the count.
    expect(screen.getByText(FOOTER.countText).closest("[aria-hidden]")).toBeNull();
    const figure = screen.getByText("2");
    expect(figure.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("changes").getAttribute("aria-hidden")).toBe("true");
    const held = screen.getByText("1 held");
    expect(held.getAttribute("aria-hidden")).toBe("true");
    expect(held.getAttribute("title")).toBe(FOOTER.states.title);
    expect(held.querySelector("[data-dot]")?.getAttribute("data-dot")).toBe("amber");
  });

  it("resets all through its callback, and turns Reset all off with nothing to reset", async () => {
    const user = userEvent.setup({ document });
    const { screen, onResetAll } = draw();
    await user.click(screen.getByRole("button", { name: "Reset all" }));
    expect(onResetAll).toHaveBeenCalledTimes(1);
    cleanup();
    const empty = draw({ footer: FOOTER_EMPTY }).screen;
    expect((empty.getByRole("button", { name: "Reset all" }) as HTMLButtonElement).disabled).toBe(true);
    expect(empty.queryByText("1 held")).toBeNull();
  });

  it("offers Undo beside what a reset dropped, and draws nothing in its place without an offer", async () => {
    const user = userEvent.setup({ document });
    const { screen, onUndo } = draw({ undo: UNDO_OFFER });
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo.closest("[data-footer-undo]")?.textContent).toBe(`${UNDO_OFFER}Undo`);
    await user.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
    screen.rerender(<PanelFooter footer={FOOTER} words={WORDS.footer} undo={null} theme="light" copy={null} onResetAll={() => {}} onUndo={() => {}} onTheme={() => {}} />);
    expect(screen.shadow.querySelector("[data-footer-undo]")?.textContent).toBe("");
  });

  it("presses the theme in dark, its tooltip naming the other", async () => {
    const user = userEvent.setup({ document });
    const { screen, onTheme } = draw();
    const theme = screen.getByRole("button", { name: "Dark theme" });
    expect(theme.getAttribute("aria-pressed")).toBe("false");
    expect(theme.getAttribute("title")).toBe(WORDS.footer.theme.toDark);
    await user.click(theme);
    expect(onTheme).toHaveBeenCalledTimes(1);
    cleanup();
    const dark = draw({ theme: "dark" }).screen.getByRole("button", { name: "Dark theme" });
    expect(dark.getAttribute("aria-pressed")).toBe("true");
    expect(dark.getAttribute("title")).toBe(WORDS.footer.theme.toLight);
  });

  it("draws Copy Proposal in its slot, after the theme", () => {
    const { screen } = draw();
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.slice(-2)).toEqual(["Dark theme", "Copy Proposal"]);
  });

  it("has no axe violations, with changes and an offer, and with nothing", async () => {
    const { screen } = draw({ undo: UNDO_OFFER });
    expect(await axeViolations(screen.host)).toEqual([]);
    cleanup();
    const empty = draw({ footer: FOOTER_EMPTY, theme: "dark" }).screen;
    expect(await axeViolations(empty.host)).toEqual([]);
  });
});

describe("PanelFooter's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("var(--font-figure)");
  });
});
