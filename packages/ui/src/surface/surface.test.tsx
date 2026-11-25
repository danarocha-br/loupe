// @vitest-environment jsdom
// The surface (surface/): one layered stylesheet, a shadow root that says its language,
// and a boundary that keeps a throw inside it. A consumer's top layer goes last.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIMITIVES_CSS } from "../index.js";
import { adoptStylesheet, GROUND_CSS, LAYERS, stylesheet, Surface, SYSTEM_STYLESHEET } from "./index.js";
import { cleanup, renderInSurface } from "./render.fixture.js";

const PATTERNS_CSS = "[data-example] { color: var(--ink); }";
const STYLESHEET = stylesheet(PATTERNS_CSS);

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
    // Every rule is in a layer: the consumer's top layer ends the sheet.
    expect(STYLESHEET.endsWith(`@layer patterns {\n${PATTERNS_CSS}\n}`)).toBe(true);
  });

  it("is the system alone, its top layer empty, when the consumer brings none", () => {
    expect(SYSTEM_STYLESHEET).toBe(stylesheet(""));
    expect(SYSTEM_STYLESHEET.endsWith("@layer patterns {\n\n}")).toBe(true);
  });

  it("is in the shadow root, which says Loupe's words are English", () => {
    const screen = renderInSurface(<p>Hello</p>);
    expect(screen.host.getAttribute("lang")).toBe("en");
    expect(screen.shadow.querySelector("style")?.textContent).toBe(SYSTEM_STYLESHEET);
    expect(renderInSurface(<p>Hi</p>, { stylesheet: STYLESHEET }).shadow.querySelector("style")?.textContent).toBe(STYLESHEET);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("draws a dark surface under the host's theme attribute", () => {
    const screen = renderInSurface(<p>Hello</p>, { theme: "dark" });
    expect(screen.host.getAttribute("data-loupe-theme")).toBe("dark");
  });
});

describe("a surface whose stylesheet changes", () => {
  const RED = "p { color: red; }";
  const BLUE = "p { color: blue; }";

  it("replaces its <style>, never stacks one, red then blue then red again", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const draw = (css: string) => act(() => root.render(<Surface stylesheet={css}><p>Hi</p></Surface>));
    const styles = () => [...(container.querySelector("[data-loupe-surface]")?.shadowRoot?.querySelectorAll("style") ?? [])].map((s) => s.textContent);
    draw(RED);
    draw(BLUE);
    expect(styles()).toEqual([BLUE]);
    draw(RED);
    expect(styles()).toEqual([RED]);
    act(() => root.unmount());
    container.remove();
  });

  it("swaps its constructed sheet in place, and keeps any other sheet the root holds", () => {
    class Sheet {
      text = "";
      replaceSync(css: string) {
        this.text = css;
      }
    }
    const other = new Sheet();
    const doc = { defaultView: { CSSStyleSheet: Sheet } };
    const shadow = { ownerDocument: doc, adoptedStyleSheets: [] as Sheet[] } as unknown as ShadowRoot & { adoptedStyleSheets: Sheet[] };
    const texts = () => (shadow.adoptedStyleSheets as unknown as Sheet[]).map((sheet) => sheet.text);
    adoptStylesheet(shadow, RED);
    shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, other as unknown as CSSStyleSheet] as never;
    other.text = "other";
    adoptStylesheet(shadow, BLUE);
    expect(texts()).toEqual([BLUE, "other"]);
    adoptStylesheet(shadow, RED);
    expect(texts()).toEqual([RED, "other"]);
    adoptStylesheet(shadow, RED);
    expect(texts()).toEqual([RED, "other"]);
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
