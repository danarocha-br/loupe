// @vitest-environment jsdom
// Where focus goes back to (focus-return.ts): a control of the list found again once the
// list is drawn anew, by its key or, with none, by its words; a folded one's row; and a
// neighbour for a control that went.

import { afterEach, describe, expect, it } from "vitest";
import { findPlace, focusNeighbour, focusPlace, heldFocus, placeOf } from "./focus-return.js";

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
  <div data-page-map><button data-map-block tabindex="0">Inspect Button 1 of 2, Ana</button><button data-map-block tabindex="-1">Inspect Button 2 of 2, Bia</button></div>
  <ul><li data-group-row><div data-fold><button data-fold-trigger>Button ×2</button><div data-fold-panel hidden="until-found"><button data-instance="bia">bia</button></div></div></li></ul>`;

describe("focus-return", () => {
  it("finds a control again by its key, though its words changed", () => {
    const root = draw(LIST);
    const place = placeOf(root.querySelector("[data-change='2']") as Element);
    root.innerHTML = LIST.replace("2 Card · tone", "2 Card · tone, size");
    expect(findPlace(root, place)?.textContent).toBe("2 Card · tone, size");
  });

  it("finds a page-map block, which has no key, by its words", () => {
    const root = draw(LIST);
    const place = placeOf(root.querySelectorAll("[data-map-block]")[1] as Element);
    root.innerHTML = LIST;
    const block = findPlace(root, place) as HTMLElement;
    expect(block.textContent).toBe("Inspect Button 2 of 2, Bia");
    expect(focusPlace(block)).toBe(true);
    expect(root.activeElement).toBe(block);
    root.innerHTML = LIST.replace(", Bia", ", Caio");
    expect(findPlace(root, place)).toBeNull();
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

  it("leaves focus alone while the control is still there", () => {
    const root = draw(LIST);
    (root.querySelector("[data-change='1']") as HTMLElement).focus();
    expect(focusNeighbour(heldFocus(root)!)).toBe(false);
  });
});
