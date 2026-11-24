// @vitest-environment jsdom
// Sheet, by role, inside a real shadow root (ADR 0003): a region named Loupe, its header,
// the middle that scrolls and its footer, in that order; what the view says it is doing
// (over the page, peeking, closing) as attributes; and inert while it closes.

import { afterEach, describe, expect, it } from "vitest";
import { SHEET_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { atRest, expectPatternCss, forcedColorRules } from "../css.fixture.js";
import { SHEET_WIDTH } from "../samples.js";
import { Sheet, type SheetProps } from "./sheet.js";
import CSS from "./sheet.css?inline";

afterEach(cleanup);

function sheet(props: Partial<SheetProps> = {}) {
  return (
    <Sheet
      docked
      peeking={false}
      closing={false}
      width={SHEET_WIDTH}
      words={SHEET_WORDS}
      header={<header>The header</header>}
      footer={<footer>The footer</footer>}
      {...props}
    >
      <p>A card</p>
      <p>Another card</p>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("is a region named Loupe: the header, the middle's cards, then the footer", () => {
    const screen = renderInSurface(sheet());
    const region = screen.getByRole("region", { name: "Loupe" });
    expect([...region.children].map((child) => child.textContent)).toEqual(["The header", "A cardAnother card", "The footer"]);
    expect(region.children[1]?.hasAttribute("data-sheet-middle")).toBe(true);
    expect(region.style.width).toBe(`${SHEET_WIDTH}px`);
  });

  it("hands the view its middle, which scrolls", () => {
    let middle: HTMLDivElement | null = null;
    renderInSurface(sheet({ middleRef: (node) => void (middle = node) }));
    expect(middle).not.toBeNull();
    expect((middle as unknown as HTMLElement).textContent).toBe("A cardAnother card");
  });

  it("says through attributes what the view is doing, and nothing it isn't", () => {
    const screen = renderInSurface(sheet());
    const region = screen.getByRole("region", { name: "Loupe" });
    for (const state of ["overlay", "peek", "closing"]) expect(region.hasAttribute(`data-${state}`), state).toBe(false);
    expect(region.hasAttribute("inert")).toBe(false);
    screen.rerender(sheet({ docked: false, peeking: true, closing: true }));
    for (const state of ["overlay", "peek", "closing"]) expect(region.hasAttribute(`data-${state}`), state).toBe(true);
  });

  it("takes nothing while it closes: inert, so focus and a click can't land in a drawer on its way out", () => {
    const screen = renderInSurface(sheet({ closing: true }));
    const region = screen.shadow.querySelector<HTMLElement>("[data-sheet]");
    expect(region?.hasAttribute("inert")).toBe(true);
  });

  it("has no axe violations, docked and over the page", async () => {
    const screen = renderInSurface(sheet());
    expect(await axeViolations(screen.host)).toEqual([]);
    cleanup();
    const over = renderInSurface(sheet({ docked: false }), { theme: "dark" });
    expect(await axeViolations(over.host)).toEqual([]);
  });
});

describe("Sheet's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    // The panel's base text, and the drawer's curves (tokens.ts TYPE, DURATION and EASE).
    for (const value of ["var(--font-body)", "var(--duration-open) var(--ease-drawer)", "var(--duration-close) var(--ease-land)"]) expect(CSS).toContain(value);
  });

  it("keeps its forced colours on the sheet it draws: a border, where the shadow that edges it goes", () => {
    const screen = renderInSurface(sheet());
    const forced = forcedColorRules(CSS);
    expect(forced).toEqual([{ selector: "[data-sheet]", declares: { border: "1px solid transparent" } }]);
    for (const rule of forced) expect(screen.shadow.querySelector(atRest(rule.selector))).not.toBeNull();
  });
});
