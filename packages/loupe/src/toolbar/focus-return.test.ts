// @vitest-environment jsdom
// Where focus goes back to (focus-return.ts): a control of the list found again once the
// list is drawn anew, by its keys, never its words; a folded one's row; and a neighbour
// for a control that went or was turned off.

import { afterEach, describe, expect, it } from "vitest";
import { findPlace, focusNeighbour, focusPlace, heldFocus, OPENERS, placeOf } from "./focus-return.js";

let host: HTMLElement;
afterEach(() => host.remove());

/** The list drawn into a shadow root, as the panel is: `html` twice is the list drawn again. */
function draw(html: string): ShadowRoot {
  host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = html;
  return root;
}

const LIST = `
  <ol><li><button data-change="1">1 Button · variant</button></li><li><button data-change="2">2 Card · tone</button></li></ol>
  <div data-page-map><button data-map-block="ana" tabindex="0">Inspect Button 1 of 2, Ana</button><button data-map-block="bia" tabindex="-1">Inspect Button 2 of 2, Bia</button></div>
  <ul><li data-group-row><div data-fold><button data-fold-trigger>Button ×2</button><div data-fold-panel hidden="until-found"><button data-site-open="members.tsx:11" aria-label="Inspect 4 Instances"></button><button data-instance="bia">bia</button></div></div></li></ul>`;

describe("focus-return", () => {
  it("finds a control again by its key, though its words changed", () => {
    const root = draw(LIST);
    const place = placeOf(root.querySelector("[data-change='2']") as Element);
    root.innerHTML = LIST.replace("2 Card · tone", "2 Card · tone, size");
    expect(findPlace(root, place)?.textContent).toBe("2 Card · tone, size");
  });

  it("finds a page-map block by its Instance, though the app's words in its name changed", () => {
    const root = draw(LIST);
    const place = placeOf(root.querySelectorAll("[data-map-block]")[1] as Element);
    // Bia's text edited in the Inspector, and another Button mounted: the block's name changes, its Instance doesn't.
    root.innerHTML = LIST.replace("Inspect Button 2 of 2, Bia", "Inspect Button 2 of 3, Bianca Souza");
    const block = findPlace(root, place) as HTMLElement;
    expect(block.textContent).toBe("Inspect Button 2 of 3, Bianca Souza");
    expect(focusPlace(block)).toBe(true);
    expect(root.activeElement).toBe(block);
    root.innerHTML = LIST.replace('data-map-block="bia"', 'data-map-block="caio"');
    expect(findPlace(root, place)).toBeNull();
  });

  it("tells a block of the map from the dot of the same Instance", () => {
    const root = draw(LIST.replace('data-map-block="bia"', 'data-map-block="dot-twin"').replace('data-instance="bia"', 'data-instance="dot-twin"'));
    expect(findPlace(root, placeOf(root.querySelector("[data-map-block='dot-twin']") as Element))?.hasAttribute("data-map-block")).toBe(true);
    expect(findPlace(root, placeOf(root.querySelector("[data-instance='dot-twin']") as Element))?.hasAttribute("data-instance")).toBe(true);
  });

  it("focuses the row a control is folded into", () => {
    const root = draw(LIST);
    const dot = findPlace(root, placeOf(root.querySelector("[data-instance]") as Element)) as HTMLElement;
    expect(focusPlace(dot)).toBe(true);
    expect(root.activeElement).toBe(root.querySelector("[data-fold-trigger]"));
  });

  it("hands focus to the row after one that went, else the row before", () => {
    const root = draw(LIST);
    const first = root.querySelector<HTMLElement>("[data-change='1']") as HTMLElement;
    first.focus();
    const held = heldFocus(root);
    expect(held?.element).toBe(first);
    first.closest("li")?.remove();
    expect(focusNeighbour(held!)).toBe(true);
    expect(root.activeElement).toBe(root.querySelector("[data-change='2']"));

    root.innerHTML = LIST;
    const second = root.querySelector<HTMLElement>("[data-change='2']") as HTMLElement;
    second.focus();
    const again = heldFocus(root)!;
    second.closest("li")?.remove();
    expect(focusNeighbour(again)).toBe(true);
    expect(root.activeElement).toBe(root.querySelector("[data-change='1']"));
  });

  it("passes over a row turned off, as a change is when none of its Instances is mounted", () => {
    const root = draw(LIST);
    const first = root.querySelector<HTMLButtonElement>("[data-change='1']") as HTMLButtonElement;
    first.focus();
    const held = heldFocus(root)!;
    first.disabled = true;
    expect(focusNeighbour(held)).toBe(true);
    expect(root.activeElement).toBe(root.querySelector("[data-change='2']"));
  });

  it("names a list control by its keys alone, so only the list's openers have a place", () => {
    const root = draw(LIST);
    expect(OPENERS.split(", ").every((selector) => root.querySelector(selector))).toBe(true);
    expect(findPlace(root, placeOf(root.querySelector("[data-fold-trigger]") as Element))).toBeNull();
  });
});
