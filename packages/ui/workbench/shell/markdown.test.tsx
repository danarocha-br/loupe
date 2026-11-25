// @vitest-environment jsdom
// The workbench's Markdown (markdown.tsx): what the primitives' `.md` files write, as elements.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "./markdown.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
const draw = (source: string) => {
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<Markdown source={source} />));
  return container;
};

afterEach(() => container.remove());

describe("the workbench's Markdown", () => {
  it("draws headings a level under the page's, paragraphs and inline marks", () => {
    const doc = draw("# Button\n\nRuns an `action`, **bold** and *Enter*,\nover two lines.\n\n## States");
    expect(doc.querySelector("h2")?.textContent).toBe("Button");
    expect(doc.querySelector("h3")?.textContent).toBe("States");
    expect(doc.querySelector("p")?.textContent).toBe("Runs an action, bold and Enter, over two lines.");
    expect(doc.querySelector("p code")?.textContent).toBe("action");
    expect(doc.querySelector("p strong")?.textContent).toBe("bold");
    expect(doc.querySelector("p em")?.textContent).toBe("Enter");
  });

  it("nests a list by two spaces, and joins a line that continues an item", () => {
    const doc = draw("- `look`:\n  - `plain`: padded\n  - `list`: flush\n- `ref`: the card's\n  element");
    const top = doc.querySelectorAll(":scope > ul > li");
    expect(top).toHaveLength(2);
    expect(top[0]?.querySelectorAll("ul > li")).toHaveLength(2);
    expect(top[1]?.textContent).toBe("ref: the card's element");
  });

  it("draws numbered steps as an ordered list, a bulleted list nested in one as its own", () => {
    // As prop-row.md writes "What it draws, in order".
    const doc = draw("Intro:\n1. **The line**: the delta\n2. **The change line**,\n   under it\n3. **The control**\n  - chips\n4. **Under the control**\n\nAfter.");
    const steps = doc.querySelectorAll(":scope > ol > li");
    expect([...steps].map((step) => step.querySelector("strong")?.textContent)).toEqual(["The line", "The change line", "The control", "Under the control"]);
    expect(steps[1]?.textContent).toBe("The change line, under it");
    expect(steps[2]?.querySelectorAll("ul > li")).toHaveLength(1);
    expect([...doc.querySelectorAll(":scope > p")].map((p) => p.textContent)).toEqual(["Intro:", "After."]);
  });

  it("draws a table, a pipe inside code staying in its cell", () => {
    const doc = draw("| Attribute | Draws |\n| --- | --- |\n| `data-a` · `a|b` | A block. |");
    expect([...doc.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual(["Attribute", "Draws"]);
    expect([...doc.querySelectorAll("td")].map((cell) => cell.textContent)).toEqual(["data-a · a|b", "A block."]);
  });

  it("keeps fenced code as written, and markup in it as text", () => {
    const doc = draw("```tsx\n<Button onClick={go}>\n  Go\n</Button>\n```");
    expect(doc.querySelector("pre")?.getAttribute("data-language")).toBe("tsx");
    expect(doc.querySelector("pre code")?.textContent).toBe("<Button onClick={go}>\n  Go\n</Button>");
    expect(doc.querySelector("button")).toBeNull();
  });
});
