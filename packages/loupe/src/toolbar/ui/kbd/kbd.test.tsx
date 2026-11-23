// @vitest-environment jsdom
// Kbd, inside a real shadow root (ADR 0003): the native `kbd`, read in the sentence it
// sits in, keeping its box under forced colours.

import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Kbd } from "./kbd.js";
import CSS from "./kbd.css?inline";

afterEach(cleanup);

describe("Kbd", () => {
  it("is a native kbd, read in its sentence", () => {
    const screen = renderInSurface(
      <p>
        Click an Instance on the page · <Kbd>Esc</Kbd> cancels
      </p>,
    );
    // The sentence reads whole, the key in it: what the status strip draws and the announcer says.
    expect(screen.getByText(/^Click an Instance/).textContent).toBe("Click an Instance on the page · Esc cancels");
    const key = screen.getByText("Esc");
    expect([key.tagName, key.hasAttribute("data-kbd"), key.getAttribute("role")]).toEqual(["KBD", true, null]);
  });

  it("passes axe", async () => {
    const screen = renderInSurface(
      <p>
        hold <Kbd>Alt</Kbd> to see through
      </p>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Kbd's CSS", () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names its attribute, and takes its type, colour and corners from the tokens", () => {
    expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]|(^|\s)kbd\s*\{/im);
    expect(body).not.toMatch(/font(-size)?: *\d|#[0-9a-f]{3,8}\b|rgba?\(|border-radius: *\d/i);
    expect(body).toContain("var(--font-key)");
    expect(body).toContain("var(--radius-checkbox)");
  });

  it("keeps its box under forced colours: a transparent outline they draw", () => {
    expect(body).toMatch(/outline: 1px solid transparent/);
    expect(body).not.toMatch(/box-shadow/);
  });
});
