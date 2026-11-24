// @vitest-environment jsdom
// LauncherPill, by role, inside a real shadow root (ADR 0003): a button named for what it
// does, its tooltip naming the shortcut, placed by `translate`, saying through attributes
// what it is doing, and drawn in its Goo, a body for each side of the window as far out as
// the view says, the L laid over it, crisp.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LAUNCHER_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { atRest, expectPatternCss, forcedColorRules, selectorsOf, styleRules } from "../css.fixture.js";
import { PILL_DOCKED, PILL_HELD, PILL_IN_STAGE } from "../samples.js";
import { LauncherPill, type LauncherPillProps, PILL, PILL_SIDES } from "./launcher.js";
import CSS from "./launcher.css?inline";

afterEach(cleanup);

const WORDS = { label: LAUNCHER_WORDS.label, title: LAUNCHER_WORDS.title("⌘.") };

function draw(props: Partial<LauncherPillProps> = {}) {
  const onClick = vi.fn();
  const screen = renderInSurface(<LauncherPill {...PILL_DOCKED} words={WORDS} onClick={onClick} {...props} />);
  const pill = screen.getByRole("button", { name: "Show Loupe" });
  return { screen, pill, onClick };
}

describe("LauncherPill", () => {
  it("is a button named for what it does, its tooltip naming the shortcut, and calls back when pressed", async () => {
    const user = userEvent.setup({ document });
    const { pill, onClick } = draw({ "aria-keyshortcuts": "Meta+Period" });
    expect(pill.getAttribute("title")).toBe("Show Loupe (⌘. focuses it) · drag it anywhere, or to a side to keep it there");
    expect(pill.getAttribute("aria-keyshortcuts")).toBe("Meta+Period");
    await user.click(pill);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is placed by translate, off layout, where the view puts it", () => {
    const { pill } = draw();
    expect(pill.style.translate).toBe(`${PILL_DOCKED.at.x}px ${PILL_DOCKED.at.y}px`);
    expect(pill.style.left).toBe("");
  });

  it("says through attributes what it is doing, and nothing it isn't", () => {
    const { pill, screen } = draw();
    expect(pill.dataset.edge).toBe("right");
    for (const state of ["dragging", "settling", "leaving"]) expect(pill.hasAttribute(`data-${state}`), state).toBe(false);
    screen.rerender(<LauncherPill {...PILL_HELD} words={WORDS} settling leaving />);
    expect(pill.dataset.edge).toBe("free");
    for (const state of ["dragging", "settling", "leaving"]) expect(pill.hasAttribute(`data-${state}`), state).toBe(true);
  });

  it("draws a body for each side of the window as far out as its gap, and the L over the Goo, crisp", () => {
    const { pill } = draw();
    const walls = [...pill.querySelectorAll<SVGRectElement>("[data-launcher-wall]")];
    expect(walls.map((wall) => wall.dataset.launcherWall)).toEqual([...PILL_SIDES]);
    // Left and top move out by minus their gap, right and bottom by plus.
    expect(walls.map((wall) => wall.style.translate)).toEqual([
      `${-PILL_DOCKED.gaps.left}px 0px`,
      `${PILL_DOCKED.gaps.right}px 0px`,
      `0px ${-PILL_DOCKED.gaps.top}px`,
      `0px ${PILL_DOCKED.gaps.bottom}px`,
    ]);
    const body = pill.querySelector("[data-launcher-body]");
    expect([body?.getAttribute("width"), body?.getAttribute("height"), body?.getAttribute("rx")]).toEqual([`${PILL.width}`, `${PILL.height}`, `${PILL.height / 2}`]);
    expect(pill.querySelector("[data-launcher-goo] [data-launcher-mark]")).toBeNull();
    expect(pill.querySelector("[data-launcher-mark] [data-launcher-glyph]")).not.toBeNull();
    // Decoration: the button's name says it all.
    for (const svg of pill.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("filters each pill's Goo through its own filter, so several in one root never share one", () => {
    const screen = renderInSurface(
      <>
        {Object.values(PILL_IN_STAGE).map((sample) => (
          <LauncherPill key={sample.at.x} {...sample} words={WORDS} />
        ))}
      </>,
    );
    const goos = [...screen.shadow.querySelectorAll("[data-launcher-goo]")];
    expect(goos).toHaveLength(3);
    const ids = goos.map((goo) => {
      const id = goo.querySelector("filter")?.id ?? "";
      expect(goo.querySelector("g")?.getAttribute("filter")).toBe(`url(#${id})`);
      return id;
    });
    expect(new Set(ids).size).toBe(3);
  });

  it("is sampled in the workbench's 320 × 88 stage where the view would put it: each side's body its gap away, 24px more once parked", () => {
    for (const [name, sample] of Object.entries(PILL_IN_STAGE)) {
      const extra = sample.edge === "free" && sample.dragging ? 0 : 24;
      expect(sample.gaps, name).toEqual({
        left: sample.at.x + extra,
        right: 320 - sample.at.x - PILL.width + extra,
        top: sample.at.y + extra,
        bottom: 88 - sample.at.y - PILL.height + extra,
      });
    }
  });

  it("has no axe violations, docked and held", async () => {
    const { screen } = draw();
    expect(await axeViolations(screen.host)).toEqual([]);
    cleanup();
    const held = renderInSurface(<LauncherPill {...PILL_HELD} words={WORDS} />);
    expect(await axeViolations(held.host)).toEqual([]);
  });
});

describe("LauncherPill's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    // The motion it was tuned with, by name (tokens.ts DURATION and EASE).
    for (const step of ["--duration-tuck", "--duration-untuck", "--duration-settle", "--duration-release", "--ease-land", "--ease-in-out"]) expect(CSS).toContain(`var(${step})`);
  });

  it("keeps its forced colours on the parts it draws: the pill's own colours, in system ones", () => {
    const { pill, screen } = draw();
    const forced = forcedColorRules(CSS);
    expect(forced.map((rule) => rule.selector)).toEqual([
      "[data-launcher]",
      "[data-launcher-goo] rect, [data-launcher]:not([data-dragging]):hover [data-launcher-goo] rect",
      "[data-launcher]:focus-visible",
    ]);
    for (const rule of forced) expect(screen.shadow.querySelector(atRest(rule.selector)), rule.selector).not.toBeNull();
    expect(forced[0]?.declares).toMatchObject({ "forced-color-adjust": "none", color: "ButtonFace", filter: "none" });
    expect(forced[1]?.declares).toMatchObject({ fill: "ButtonText" });
    expect(forced[2]?.declares).toMatchObject({ "outline-color": "Highlight" });
    expect(pill.matches(atRest(forced[2]?.selector ?? ""))).toBe(true);
  });

  it("keeps the system fill when pointed at: every rule that fills the Goo is named again in the forced block, later, so it loses", () => {
    const rules = styleRules(CSS);
    const forcedFill = rules.filter((rule) => rule.forced && rule.declares.fill).flatMap((rule) => selectorsOf(rule.selector));
    const fills = rules.filter((rule) => !rule.forced && rule.declares.fill).flatMap((rule) => selectorsOf(rule.selector));
    expect(fills).toContain("[data-launcher]:not([data-dragging]):hover [data-launcher-goo] rect");
    for (const selector of fills) expect(forcedFill, selector).toContain(selector);
    const lastFill = (forced: boolean) => rules.map((rule) => rule.forced === forced && !!rule.declares.fill).lastIndexOf(true);
    expect(lastFill(true)).toBeGreaterThan(lastFill(false));
  });
});
