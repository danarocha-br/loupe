// @vitest-environment jsdom
// Icon, inside a real shadow root (ADR 0003): every icon is decoration, hidden from
// assistive technology, stroked in the colour it sits in; only the wordmark is named.

import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import * as icons from "./icon.js";
import CSS from "./icon.css?inline";

afterEach(cleanup);

const components = Object.entries(icons).filter(([name, value]) => typeof value === "function" && name !== "Wordmark") as [string, () => ReactNode][];

describe("Icon", () => {
  it("hides every icon but the wordmark from assistive technology", async () => {
    const screen = renderInSurface(
      <button type="button">
        {components.map(([name, Component]) => (
          <Component key={name} />
        ))}
        {Object.entries(icons.PROP_ICONS).map(([name, glyph]) => (
          <span key={name}>{glyph}</span>
        ))}
        Reset
      </button>,
    );
    const svgs = [...screen.shadow.querySelectorAll("svg")];
    expect(svgs.length).toBe(components.length + Object.keys(icons.PROP_ICONS).length);
    for (const svg of svgs) expect([svg.getAttribute("aria-hidden"), svg.getAttribute("focusable"), svg.hasAttribute("data-icon")]).toEqual(["true", "false", true]);
    // The button is named by its words alone.
    expect(screen.getByRole("button").textContent).toBe("Reset");
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(await axeViolations(screen.host)).toEqual([]);
  });

  it("names the wordmark, the one image that means something by itself", () => {
    const screen = renderInSurface(<icons.Wordmark />);
    expect(screen.getByRole("img", { name: "Loupe" })).toBeTruthy();
  });

  it("takes its colour from what it sits in, and never shrinks in a line", () => {
    expect(CSS).toContain("[data-icon] { display: block; flex: none; }");
    expect(STYLESHEET).toContain(CSS.trim());
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
