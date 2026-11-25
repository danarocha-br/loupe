// @vitest-environment jsdom
// The workbench shell (index.tsx): what the address names. A fragment names one page by its
// folder; one that isn't valid percent-encoding names none, and every page shows, on load and
// as the address changes, rather than the page throwing before it draws.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Page, Workbench } from "./index.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = (id: string, name: string): Page => ({ id, name, doc: `# ${name}`, States: () => <p>{name}'s states</p> });
const PAGES = [page("one", "One"), page("two", "Two")];

let container: HTMLElement;
let root: Root;
const draw = () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Workbench title="@loupe/test" intro="Pages." nav="Pages" pages={PAGES} stylesheet="" folder="src/" storage="loupe-test-workbench" />));
};
/** The pages drawn, by their heading (not their .md's). */
const shown = () => [...container.querySelectorAll("main article > header h2")].map((heading) => heading.textContent);
const current = () => container.querySelector('nav [aria-current="page"]')?.textContent;
const go = (hash: string) =>
  act(() => {
    location.hash = hash;
    dispatchEvent(new HashChangeEvent("hashchange"));
  });

// jsdom has no `matchMedia`, which the reader's media features read: none is on.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  container.remove();
  history.replaceState(null, "", location.pathname);
});

describe("the workbench shell's address", () => {
  it("draws the page its fragment names, and every page for #all", () => {
    location.hash = "#two";
    draw();
    expect(shown()).toEqual(["Two"]);
    expect(current()).toBe("Two");
    go("#all");
    expect(shown()).toEqual(["One", "Two"]);
    expect(current()).toBe("All");
  });

  it("draws every page for a fragment that isn't valid percent-encoding, on load", () => {
    location.hash = "#%";
    draw();
    expect(shown()).toEqual(["One", "Two"]);
    expect(current()).toBe("All");
  });

  it("draws every page when the fragment changes to one that isn't valid percent-encoding", () => {
    location.hash = "#one";
    draw();
    expect(shown()).toEqual(["One"]);
    go("#%E0%A4%A");
    expect(shown()).toEqual(["One", "Two"]);
  });
});
