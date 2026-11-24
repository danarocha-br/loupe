// @vitest-environment jsdom
// Tag, by role, inside a real shadow root (ADR 0003): words in a pill, read where they
// stand, drawn by their look's attribute, keeping their pill under forced colours.

import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Tag, type TagLook } from "./tag.js";
import CSS from "./tag.css?inline";

afterEach(cleanup);

const LOOKS: TagLook[] = ["plain", "reason", "picked", "amber", "ring", "dashed", "empty"];

describe("Tag", () => {
  it("is its words, read in place in the row it qualifies", () => {
    const screen = renderInSurface(
      <ul aria-label="Props">
        <li>
          open <Tag>State prop</Tag>
        </li>
      </ul>,
    );
    expect(screen.getByRole("listitem").textContent).toBe("open State prop");
    const tag = screen.getByText("State prop");
    expect([tag.tagName, tag.getAttribute("role"), tag.getAttribute("data-tag-look")]).toEqual(["SPAN", null, "plain"]);
    expect(tag.tabIndex).toBe(-1);
  });

  it("draws its look through an attribute, keeps its title, and passes data-* through", () => {
    const screen = renderInSurface(
      <>
        {LOOKS.map((look) => (
          <Tag key={look} look={look} title={`${look} title`} data-testid={look}>
            {look}
          </Tag>
        ))}
      </>,
    );
    for (const look of LOOKS) {
      const tag = screen.getByTestId(look);
      expect([tag.getAttribute("data-tag-look"), tag.title, tag.textContent]).toEqual([look, `${look} title`, look]);
    }
    // A Tag carries its look, never a bare `data-tag`, which a page mark or a pattern might mistake for its own.
    expect(screen.shadow.querySelector("[data-tag]")).toBeNull();
  });

  it("passes axe in every look", async () => {
    const screen = renderInSurface(
      <p>
        {LOOKS.map((look) => (
          <Tag key={look} look={look}>
            {look}
          </Tag>
        ))}
      </p>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Tag's CSS", () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its type, colours and corners from the tokens", () => {
    expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
    expect(body).not.toMatch(/aria-|\[data-tag\]/);
    expect(body).not.toMatch(/font(-size)?: *\d|#[0-9a-f]{3,8}\b|rgba?\(|border-radius: *\d|999px/i);
    for (const step of ["tag", "tag-mono", "chip"]) expect(body).toContain(`var(--font-${step})`);
    for (const look of LOOKS.filter((look) => look !== "plain")) expect(body).toContain(`[data-tag-look="${look}"]`);
  });

  it("draws every edge as an outline, which forced colours keep once they drop the fill", () => {
    expect(body).not.toMatch(/box-shadow|border:/);
    expect(body).toMatch(/\[data-tag-look\] \{[^}]*outline: 1px solid transparent/);
  });
});
