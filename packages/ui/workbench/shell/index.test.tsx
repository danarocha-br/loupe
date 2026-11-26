// @vitest-environment jsdom
// The workbench shell (index.tsx): the page's theme, and what the address names. A fragment names one page by its
// folder; one that isn't valid percent-encoding names none, and every page shows, on load and
// as the address changes, rather than the page throwing before it draws.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Page, PAGE_THEME_ATTRIBUTE, Workbench } from "./index.js";

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

describe("the workbench shell's page theme", () => {
  const radio = (label: string) =>
    [...container.querySelectorAll<HTMLInputElement>('input[name="page-theme"]')].find((input) => input.parentElement?.textContent === label) as HTMLInputElement;
  const theme = () => document.documentElement.getAttribute(PAGE_THEME_ATTRIBUTE);
  afterEach(() => localStorage.removeItem("loupe-test-workbench:page-theme"));

  it("follows the system until the reader chooses, puts the choice on <html>, and keeps it for the next visit", () => {
    draw();
    expect(radio("System").checked).toBe(true);
    expect(theme()).toBeNull();
    act(() => radio("Dark").click());
    expect(theme()).toBe("dark");
    expect(localStorage.getItem("loupe-test-workbench:page-theme")).toBe('"dark"');

    act(() => root.unmount());
    // Gone with the workbench: nothing of it stays on the page.
    expect(theme()).toBeNull();
    container.remove();
    draw();
    expect(radio("Dark").checked).toBe(true);
    expect(theme()).toBe("dark");
    act(() => radio("System").click());
    expect(theme()).toBeNull();
  });
});
