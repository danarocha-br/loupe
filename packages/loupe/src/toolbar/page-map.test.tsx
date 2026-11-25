// @vitest-environment jsdom
// The page map's view (PageMapView), by role, inside a real shadow root: what it measures on
// the page reaches the right block. The pattern's own test (patterns/page-map/) draws boxes
// given to it; this one gives each Instance its nodes and checks that every block stands
// where its own Instance sits, and inspects that Instance.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoupeDebug } from "../runtime/debug.js";
import { PageMapView } from "./page-map.js";
import { MAP_GROUPS } from "@loupe/patterns/testing";
import { cleanup, renderInSurface } from "./surface/render.fixture.js";

afterEach(cleanup);

type Box = [left: number, top: number, width: number, height: number];

/** A node that says its own box: jsdom lays nothing out. */
function node([left, top, width, height]: Box): Element {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
  return element;
}

/** Each Instance at a box of its own; btn-2 renders two nodes, the larger the one drawn, and a sliver under 16px² that doesn't count. */
const NODES: Record<string, Box[]> = {
  "btn-1": [[0, 0, 40, 20]],
  "btn-2": [
    [60, 0, 10, 10],
    [60, 0, 40, 20],
    [0, 0, 30, 0.5],
  ],
  "btn-3": [[0, 40, 100, 30]],
  "card-1": [[0, 90, 200, 100]],
};

function debugOf(): LoupeDebug {
  return { nodes: (id: string) => (NODES[id] ?? []).map(node) } as unknown as LoupeDebug;
}

function draw() {
  const onSelect = vi.fn();
  const screen = renderInSurface(<PageMapView debug={debugOf()} groups={[...MAP_GROUPS]} lit={null} onPoint={() => {}} onSelect={onSelect} />);
  const block = (name: RegExp) => screen.getByRole("button", { name });
  const place = (element: HTMLElement) => [element.style.left, element.style.top, element.style.width, element.style.height];
  return { screen, onSelect, block, place };
}

/** Where a box sits in the page's shape, as the block's style says it: the page is 200 × 190. */
const percent = ([left, top, width, height]: Box) => [`${(left / 200) * 100}%`, `${(top / 190) * 100}%`, `${(width / 200) * 100}%`, `${(height / 190) * 100}%`];

describe("the page map's view", () => {
  it("puts each Instance's own box on its own block, the largest of its nodes", () => {
    const { block, place } = draw();
    expect(place(block(/Button 1 of 3, Ana Souza/))).toEqual(percent([0, 0, 40, 20]));
    expect(place(block(/Button 2 of 3, Bruno Lima/))).toEqual(percent([60, 0, 40, 20]));
    expect(place(block(/Button 3 of 3/))).toEqual(percent([0, 40, 100, 30]));
    expect(place(block(/Card 1 of 1, Team/))).toEqual(percent([0, 90, 200, 100]));
  });

  it("inspects the Instance whose block is pressed", async () => {
    const user = userEvent.setup({ document });
    const { block, onSelect } = draw();
    await user.click(block(/Button 2 of 3, Bruno Lima/));
    expect(onSelect).toHaveBeenLastCalledWith("btn-2");
    await user.click(block(/Card 1 of 1, Team/));
    expect(onSelect).toHaveBeenLastCalledWith("card-1");
  });

  it("draws no block for an Instance with no box worth drawing", () => {
    NODES["btn-3"] = [[0, 40, 4, 3]];
    try {
      const { screen } = draw();
      expect(screen.queryByRole("button", { name: /Button 3 of 3/ })).toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(3);
    } finally {
      NODES["btn-3"] = [[0, 40, 100, 30]];
    }
  });
});
