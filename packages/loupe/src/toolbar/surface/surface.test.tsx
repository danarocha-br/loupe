// @vitest-environment jsdom
// The surface (surface/): one layered stylesheet, a shadow root that says its language,
// and a boundary that keeps a throw inside it.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CSS as VIEWS_CSS, GROUND_CSS } from "../styles.js";
import { PATTERNS_CSS } from "../patterns/styles.js";
import { PRIMITIVES_CSS } from "../ui/index.js";
import { LAYERS, STYLESHEET, Surface } from "./index.js";
import { cleanup, renderInSurface } from "./render.fixture.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the surface's stylesheet", () => {
  it("declares its layers first, tokens then primitives then patterns", () => {
    expect(LAYERS).toEqual(["tokens", "primitives", "patterns"]);
    expect(STYLESHEET.split("\n")[0]).toBe("@layer tokens, primitives, patterns;");
  });

  it("puts the host's tokens and the elements' defaults in the tokens layer, below the primitives, then the patterns", () => {
    const tokens = STYLESHEET.indexOf(`@layer tokens {${GROUND_CSS}}`);
    const primitives = STYLESHEET.indexOf(`@layer primitives {\n${PRIMITIVES_CSS}\n}`);
    const patterns = STYLESHEET.indexOf(`@layer patterns {\n${PATTERNS_CSS}\n}`);
    expect(tokens).toBeGreaterThan(0);
    expect(primitives).toBeGreaterThan(tokens);
    expect(patterns).toBeGreaterThan(primitives);
    expect(GROUND_CSS).toContain(":host { all: initial;");
    expect(GROUND_CSS).toContain("button { font: inherit;");
    // The views' rules come last, outside every layer, until they move into patterns.
    expect(STYLESHEET.endsWith(VIEWS_CSS)).toBe(true);
    expect(VIEWS_CSS).not.toContain(":host {");
  });

  it("is in the shadow root, which says Loupe's words are English", () => {
    const screen = renderInSurface(<p>Hello</p>);
    expect(screen.host.getAttribute("lang")).toBe("en");
    expect(screen.shadow.querySelector("style")?.textContent).toBe(STYLESHEET);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("draws a dark surface under the host's theme attribute", () => {
    const screen = renderInSurface(<p>Hello</p>, { theme: "dark" });
    expect(screen.host.getAttribute("data-loupe-theme")).toBe("dark");
  });
});

describe("the surface's boundary", () => {
  it("keeps a throw inside the surface: the host's page goes on rendering", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never {
      throw new Error("a primitive broke");
    }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <main>
          <h1>The app</h1>
          <Surface>
            <Broken />
          </Surface>
        </main>,
      ),
    );
    expect(container.querySelector("h1")?.textContent).toBe("The app");
    // The surface is blank: its stylesheet and nothing else.
    expect([...(container.querySelector("[data-loupe-surface]")?.shadowRoot?.children ?? [])].map((child) => child.tagName)).toEqual(["STYLE"]);
    expect(error.mock.calls.some((call) => String(call[0]).startsWith("Loupe hit an error and stepped aside"))).toBe(true);
    act(() => root.unmount());
    container.remove();
  });
});
