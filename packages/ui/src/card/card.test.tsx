// @vitest-environment jsdom
// Card, by role, inside a real shadow root (ADR 0003): a surface with no role of its own,
// whose heading is the view's at the view's level, drawn by its look's attribute, and
// keeping its edge under forced colours.

import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SYSTEM_STYLESHEET as STYLESHEET } from "../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../surface/render.fixture.js";
import { Card, CardHead, type CardLook } from "./card.js";
import CSS from "./card.css?inline";

afterEach(cleanup);

const LOOKS: CardLook[] = ["plain", "list", "divided"];

describe("Card", () => {
  it("adds no role and no heading: the view's heading is the one read, at the view's level", () => {
    const screen = renderInSurface(
      <Card data-testid="card">
        <CardHead>
          <h3>Feature flags</h3>
          <span>2 declared</span>
        </CardHead>
        <p>A preview lasts 8 hours.</p>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect([card.tagName, card.getAttribute("role"), card.getAttribute("data-card")]).toEqual(["DIV", null, "plain"]);
    // One heading, the view's h3; the head itself is a plain container.
    expect(screen.getAllByRole("heading").map((heading) => [heading.tagName, heading.textContent])).toEqual([["H3", "Feature flags"]]);
    const head = screen.getByRole("heading").parentElement as HTMLElement;
    expect([head.hasAttribute("data-card-head"), head.getAttribute("role")]).toEqual([true, null]);
    expect(card.tabIndex).toBe(-1);
  });

  it("draws its look through an attribute, and passes its ref, class and data-* through", () => {
    const ref = createRef<HTMLDivElement>();
    const screen = renderInSurface(
      <>
        {LOOKS.map((look) => (
          <Card key={look} look={look} className={`${look}-card`} data-testid={look} ref={look === "list" ? ref : undefined}>
            <p>{look}</p>
          </Card>
        ))}
      </>,
    );
    for (const look of LOOKS) {
      const card = screen.getByTestId(look);
      expect([card.getAttribute("data-card"), card.className, card.textContent]).toEqual([look, `${look}-card`, look]);
    }
    expect(ref.current).toBe(screen.getByTestId("list"));
  });

  it("passes axe with a list of rows and a heading in each look", async () => {
    const screen = renderInSurface(
      <>
        {LOOKS.map((look) => (
          <Card key={look} look={look}>
            <CardHead>
              <h3>{look}</h3>
              <span>3 items</span>
            </CardHead>
            <ul aria-label={`${look} items`}>
              <li>One</li>
              <li>Two</li>
            </ul>
          </Card>
        ))}
      </>,
    );
    expect(screen.getAllByRole("list")).toHaveLength(3);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Card's CSS", () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its type, space, colours and corners from the tokens", () => {
    expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
    expect(body).not.toMatch(/aria-|role=/);
    expect(body).not.toMatch(/font(-size)?: *\d|#[0-9a-f]{3,8}\b|rgba?\(|border-radius: *\d|999px|(padding|gap|margin)[a-z-]*: *[^;]*\b\d+px/i);
    expect(body).toMatch(/\[data-card\] \{[^}]*border-radius: var\(--radius-card\)/);
    expect(body).toMatch(/\[data-card\] \{[^}]*box-shadow: var\(--shadow\)/);
    for (const look of LOOKS.filter((look) => look !== "plain")) expect(body).toContain(`[data-card="${look}"]`);
  });

  it("keeps an edge forced colours draw once they drop the fill and the shadow", () => {
    expect(body).toMatch(/\[data-card\] \{[^}]*outline: 1px solid transparent/);
  });
});
