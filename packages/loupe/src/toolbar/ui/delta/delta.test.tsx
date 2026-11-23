// @vitest-environment jsdom
// Delta, by role, inside a real shadow root (ADR 0003): numbered, one image named by its
// caller; empty and dashed, hidden. Drawn through attributes, in system colours under
// forced colours.

import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Delta } from "./delta.js";
import CSS from "./delta.css?inline";

afterEach(cleanup);

describe("Delta", () => {
  it("is one image, named by its caller, its number drawn inside", () => {
    const screen = renderInSurface(
      <>
        <Delta n={1} label="Change 1" title="Change 1 in the Proposal" />
        <Delta n={12} label="Change 12" />
      </>,
    );
    const one = screen.getByRole("img", { name: "Change 1" });
    expect([one.title, one.textContent, one.hasAttribute("data-empty")]).toEqual(["Change 1 in the Proposal", "1", false]);
    expect(screen.getByRole("img", { name: "Change 12" }).querySelector("[data-delta-n]")?.textContent).toBe("12");
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("empty, is dashed, unnumbered and hidden, keeping its title for the pointer", () => {
    const screen = renderInSurface(
      <p>
        open <Delta title="Held open" data-testid="held" />
      </p>,
    );
    expect(screen.queryByRole("img")).toBeNull();
    const held = screen.getByTestId("held");
    expect([held.getAttribute("aria-hidden"), held.hasAttribute("data-empty"), held.textContent, held.title]).toEqual(["true", true, "", "Held open"]);
    expect(held.querySelector("[data-delta-n]")).toBeNull();
  });

  it("passes axe, numbered and empty", async () => {
    const screen = renderInSurface(
      <p>
        <Delta n={3} label="Change 3" /> <Delta />
      </p>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Delta's CSS", () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its type and colours from the tokens", () => {
    expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
    expect(body).not.toMatch(/aria-/);
    expect(body).not.toMatch(/font(-size)?: *\d|#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(body).toContain("var(--font-delta)");
    expect(body).toContain("[data-delta][data-empty] path");
  });

  it("draws the triangle and its number in system colours under forced colours", () => {
    const forced = body.slice(body.indexOf("@media (forced-colors: active)"));
    expect(forced).toMatch(/\[data-delta\] path \{[^}]*fill: Canvas;[^}]*stroke: CanvasText/);
    expect(forced).toMatch(/\[data-delta-n\] \{[^}]*color: CanvasText/);
  });
});
