// @vitest-environment jsdom
// The page's marks, inside a real shadow root (ADR 0003): outlines of each kind, the
// selected Instance's size tag and where it goes, a change's outline with its numbers, and
// the pick tag with its detail. Marks for the eye only: hidden from assistive technology,
// where the panel says what is selected and what a change reached.

import { afterEach, describe, expect, it } from "vitest";
import { PAGE } from "../tokens.js";
import { axeViolations, cleanup, renderInSurface } from "../testing.fixture.js";
import { expectPatternCss, forcedColorRules, selectorsOf } from "../css.fixture.js";
import { CHANGE_OUTLINE, HOVER_OUTLINE, OUTLINES, PICK_OUTLINE, PICK_TAG, PICK_TAG_INSPECT_ONLY, WORDS } from "../samples.js";
import { ChangeOutline, PageOutline, PickTag } from "./page-marks.js";
import CSS from "./page-marks.css?inline";

afterEach(cleanup);

const drawOutlines = () =>
  renderInSurface(
    <>
      {OUTLINES.map(({ key, ...outline }) => (
        <PageOutline key={key} {...outline} />
      ))}
      <PageOutline {...HOVER_OUTLINE} />
      <PageOutline {...PICK_OUTLINE} />
      <ChangeOutline {...CHANGE_OUTLINE} quiet={false} />
      <PickTag {...PICK_TAG} words={WORDS.outline} />
    </>,
  );

describe("the page's marks", () => {
  it("outline each Instance by its kind, where the view put it", () => {
    const screen = drawOutlines();
    const rings = [...screen.shadow.querySelectorAll<HTMLElement>("[data-ring]")];
    expect(rings.map((ring) => ring.dataset.ring)).toEqual(["ring", "member", "member", "out", "hover", "pick"]);
    const [first] = OUTLINES;
    expect([rings[0]?.style.top, rings[0]?.style.left, rings[0]?.style.width, rings[0]?.style.height]).toEqual(
      [first?.box.top, first?.box.left, first?.box.width, first?.box.height].map((px) => `${px}px`),
    );
  });

  it("tags the selected Instance with its size, and places the tag as the view decided", () => {
    const screen = drawOutlines();
    const tag = screen.getByText("Button · 32 × 32");
    expect(tag.hasAttribute("data-ring-label")).toBe(true);
    expect(tag.closest("[data-ring]")?.getAttribute("data-ring")).toBe("ring");
    expect([tag.hasAttribute("data-below"), tag.hasAttribute("data-at-start")]).toEqual([false, true]);
    // No other outline carries one.
    expect(screen.shadow.querySelectorAll("[data-ring-label]").length).toBe(1);
    screen.rerender(<PageOutline kind="ring" box={OUTLINES[0]?.box ?? { top: 0, left: 0, width: 0, height: 0 }} quiet={false} tag={{ text: "Button · 32 × 32", below: true, start: false }} />);
    const moved = screen.getByText("Button · 32 × 32");
    expect([moved.hasAttribute("data-below"), moved.hasAttribute("data-at-start")]).toEqual([true, false]);
  });

  it("outlines what a change reached with its numbers, and steps back once it has landed", () => {
    const screen = renderInSurface(<ChangeOutline {...CHANGE_OUTLINE} quiet={false} />);
    const mark = screen.shadow.querySelector<HTMLElement>("[data-mark]");
    expect(mark?.dataset.mark).toBe("1 2");
    expect(mark?.hasAttribute("data-quiet")).toBe(false);
    screen.rerender(<ChangeOutline {...CHANGE_OUTLINE} quiet />);
    expect(mark?.hasAttribute("data-quiet")).toBe(true);
    screen.rerender(<PageOutline {...PICK_OUTLINE} kind="member" quiet />);
    expect(screen.shadow.querySelector("[data-ring]")?.hasAttribute("data-quiet")).toBe(true);
  });

  it("names the Instance under the pointer, with what a click would do beyond it, in `panelView()`'s words", () => {
    const screen = renderInSurface(<PickTag {...PICK_TAG} words={WORDS.outline} />);
    const tag = screen.shadow.querySelector<HTMLElement>("[data-pick-tag]");
    expect(tag?.dataset.pickTag).toBe(PICK_TAG.id);
    expect(tag?.textContent).toBe("Button · 4 from this call site");
    expect(tag?.querySelector("[data-pick-detail]")?.textContent).toBe(" · 4 from this call site");
    expect([tag?.style.top, tag?.style.left]).toEqual(["14px", "24px"]);
    screen.rerender(<PickTag {...PICK_TAG_INSPECT_ONLY} detail={null} words={WORDS.outline} />);
    expect(tag?.textContent).toBe("Badge");
    expect(tag?.querySelector("[data-pick-detail]")).toBeNull();
  });

  it("is for the eye alone: every mark hidden from assistive technology, and no axe violations", async () => {
    const screen = drawOutlines();
    const marks = screen.shadow.querySelectorAll("[data-ring], [data-mark], [data-pick-tag]");
    expect(marks.length).toBe(8);
    for (const mark of marks) expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("the page's marks' CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });

  it("keeps its forced colours on the marks it draws: the tags' borders, the left-out dashes apart, no wash", () => {
    const screen = drawOutlines();
    const forced = forcedColorRules(CSS);
    expect(forced).toEqual([
      { selector: "[data-ring-label], [data-pick-tag]", declares: { border: "1px solid transparent" } },
      { selector: '[data-ring="out"], [data-ring="hover"]', declares: { "border-color": "GrayText" } },
      { selector: '[data-ring="pick"]', declares: { background: "none" } },
    ]);
    for (const rule of forced) {
      for (const selector of selectorsOf(rule.selector)) expect(screen.shadow.querySelector(selector), selector).not.toBeNull();
    }
  });

  it("draws in the page's own tokens, the same in either panel theme", () => {
    for (const name of ["ink", "line", "hover", "fill", "halo", "band", "on-ink", "on-band", "on-band-muted"]) expect(CSS, name).toContain(`var(--page-${name})`);
    for (const shadow of ["tag", "pick"]) expect(CSS).toContain(`var(--page-${shadow}-shadow)`);
    // Declared once on the host, in the block both themes share.
    const screen = renderInSurface(<span />, { theme: "dark" });
    const style = screen.shadow.querySelector("style")?.textContent ?? "";
    const dark = style.slice(style.indexOf(':host([data-loupe-theme="dark"])'));
    expect(style).toContain(`--page-ink: ${PAGE.ink};`);
    expect(dark.slice(0, dark.indexOf("}"))).not.toContain("--page-");
  });
});
