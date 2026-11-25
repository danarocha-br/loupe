// @vitest-environment jsdom
// Legend, inside a real shadow root (ADR 0003): what a chip's marks mean, said once, hidden
// from assistive technology since each chip says its own; the app's value only when a
// chip rings it.

import { afterEach, describe, expect, it } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { Legend } from "./legend.js";
import CSS from "./legend.css?inline";
import { WORDS } from "../samples.js";

afterEach(cleanup);

describe("Legend", () => {
  it("says what each mark means, the app's value only when a chip rings it", () => {
    const screen = renderInSurface(<Legend words={WORDS.inspector} app />);
    const legend = screen.shadow.querySelector("[data-legend]") as HTMLElement;
    expect(legend.textContent).toBe("Shows now" + "App’s value" + "Default");
    expect([...legend.querySelectorAll("[data-legend-mark]")].map((mark) => mark.getAttribute("data-legend-mark"))).toEqual(["shown", "app", "default"]);
    cleanup();
    const without = renderInSurface(<Legend words={WORDS.inspector} app={false} />);
    expect(without.shadow.querySelector("[data-legend]")?.textContent).toBe("Shows now" + "Default");
  });

  it("is hidden from assistive technology: each chip says its own marks", async () => {
    const screen = renderInSurface(<Legend words={WORDS.inspector} app />);
    expect(screen.queryByText("Shows now")).toBeTruthy();
    expect(screen.shadow.querySelector("[data-legend]")?.getAttribute("aria-hidden")).toBe("true");
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Legend's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("var(--radius-swatch)");
    expect(CSS).toMatch(/@media \(forced-colors: active\)/);
  });
});
