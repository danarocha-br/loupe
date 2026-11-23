// @vitest-environment jsdom
// Dot, by role, inside a real shadow root (ADR 0003): a mark hidden from assistive
// technology, beside words that say what it marks, drawn by its tone's attribute.

import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Dot, type DotTone } from "./dot.js";
import CSS from "./dot.css?inline";

afterEach(cleanup);

const TONES: DotTone[] = ["alert", "amber", "lilac", "hollow", "ring"];

describe("Dot", () => {
  it("is hidden, and the words beside it are what a screen reader hears", () => {
    const screen = renderInSurface(
      <h3>
        <Dot tone="alert" data-testid="dot" />
        Product layer missing
      </h3>,
    );
    expect(screen.getByRole("heading", { name: "Product layer missing" })).toBeTruthy();
    const dot = screen.getByTestId("dot");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(dot.textContent).toBe("");
    expect(dot.tabIndex).toBe(-1);
  });

  it("draws its tone and size through attributes; a ring has one size", () => {
    const screen = renderInSurface(
      <>
        {TONES.map((tone) => (
          // A ring takes no size: `small` on it is a type error.
          <Dot key={tone} {...(tone === "ring" ? { tone } : { tone, small: true })} data-testid={tone} />
        ))}
        <Dot tone="amber" data-testid="medium" />
      </>,
    );
    for (const tone of TONES) expect(screen.getByTestId(tone).getAttribute("data-dot")).toBe(tone);
    expect(TONES.filter((tone) => screen.getByTestId(tone).hasAttribute("data-small"))).toEqual(["alert", "amber", "lilac", "hollow"]);
    expect(screen.getByTestId("medium").hasAttribute("data-small")).toBe(false);
  });

  it("passes axe in every tone", async () => {
    const screen = renderInSurface(
      <ul>
        {TONES.map((tone) => (
          <li key={tone}>
            <Dot tone={tone} />
            {tone}
          </li>
        ))}
      </ul>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Dot's CSS", () => {
  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its colours and corners from the tokens", () => {
    const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
    expect(body).not.toMatch(/aria-/);
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|border-radius: *\d|50%/i);
    for (const tone of TONES) expect(body).toContain(`[data-dot="${tone}"]`);
  });

  it("draws the rings as borders, which forced colours keep, and the fills in CanvasText", () => {
    const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).not.toMatch(/box-shadow/);
    const forced = body.slice(body.indexOf("@media (forced-colors: active)"));
    for (const tone of ["alert", "amber", "lilac"]) expect(forced).toContain(`[data-dot="${tone}"]`);
    expect(forced).toContain("background: CanvasText");
  });
});
