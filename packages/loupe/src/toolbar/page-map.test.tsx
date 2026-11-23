// @vitest-environment jsdom
// The page map, by role, inside a real shadow root (surface/): one Tab stop, not one
// per block; the arrow keys between blocks in the order a page reads; a name for each
// that tells Instances of one component apart; and focus lighting what the pointer does.

import { userEvent } from "@testing-library/user-event";
import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoupeDebug } from "../runtime/debug.js";
import { PageMap, stepFrom } from "./page-map.js";
import type { GroupItem } from "./panel-view/types.js";
import { axeViolations, cleanup, renderInSurface } from "./surface/render.fixture.js";

afterEach(cleanup);

type Spec = { id: string; name: string | null; box: [left: number, top: number, width: number, height: number] };

// The reading order is btn-1, btn-2, btn-3, card: the largest first in the DOM puts the card first there.
const SPECS: Record<string, Spec[]> = {
  Button: [
    { id: "btn-1", name: "Ana Souza", box: [0, 0, 40, 20] },
    { id: "btn-2", name: "Bruno Lima", box: [60, 0, 40, 20] },
    { id: "btn-3", name: null, box: [0, 40, 100, 30] },
  ],
  Card: [{ id: "card-1", name: "Team", box: [0, 90, 200, 100] }],
};

function groupsOf(): GroupItem[] {
  return Object.entries(SPECS).map(
    ([component, specs]) =>
      ({
        component,
        count: `×${specs.length}`,
        instances: specs.map((spec) => ({ id: spec.id, label: `members.tsx:${spec.id}`, name: spec.name, mounted: true })),
      }) as unknown as GroupItem,
  );
}

/** A debug whose Instances sit at the boxes above: jsdom has no layout, so each node says its own. */
function debugOf(): LoupeDebug {
  const nodes = new Map<string, Element>();
  for (const spec of Object.values(SPECS).flat()) {
    const node = document.createElement("div");
    const [left, top, width, height] = spec.box;
    node.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
    nodes.set(spec.id, node);
  }
  return { nodes: (id: string) => [nodes.get(id)].filter(Boolean) } as unknown as LoupeDebug;
}

/** The map as the panel holds it: the pointed component is the map's, lit, and shared with the rows. */
function Sheet({ onSelect = () => {}, onPoint = () => {} }: { onSelect?(id: string | null): void; onPoint?(group: GroupItem | null): void }) {
  const [lit, setLit] = useState<string | null>(null);
  const [debug] = useState(debugOf);
  const [groups] = useState(groupsOf);
  return (
    <PageMap
      debug={debug}
      groups={groups}
      lit={lit}
      onPoint={(group) => {
        setLit(group?.component ?? null);
        onPoint(group);
      }}
      onSelect={onSelect}
    />
  );
}

const setup = () => userEvent.setup({ document });

describe("the page map's keyboard", () => {
  it("is one named toolbar of blocks, each named for its own Instance", () => {
    const screen = renderInSurface(<Sheet />);
    expect(screen.getByRole("toolbar", { name: "Page map" })).toBeTruthy();
    expect(
      screen
        .getAllByRole("button")
        .map((block) => block.textContent)
        .sort(),
    ).toEqual([
      "Inspect Button 1 of 3, Ana Souza",
      "Inspect Button 2 of 3, Bruno Lima",
      // No name on screen: the call site says which.
      "Inspect Button 3 of 3, members.tsx:btn-3",
      "Inspect Card 1 of 1, Team",
    ]);
  });

  it("keeps the app's words in the app's language, apart from Loupe's own", () => {
    document.documentElement.lang = "pt-BR";
    try {
      const screen = renderInSurface(<Sheet />);
      const name = screen.getByRole("button", { name: /Button 1 of 3/ }).querySelector("[lang]");
      expect(name?.textContent).toBe("Ana Souza");
      expect(name?.getAttribute("lang")).toBe("pt-BR");
      expect(name?.getAttribute("dir")).toBe("auto");
      // Where the Instance shows no name, what is read is Loupe's own: its call site.
      expect(screen.getByRole("button", { name: /Button 3 of 3/ }).querySelector("[lang]")).toBeNull();
    } finally {
      document.documentElement.lang = "";
    }
  });

  it("is one Tab stop, on the first block in reading order", () => {
    // user-event's Tab doesn't walk into a shadow root: the stop is read from `tabIndex`.
    const screen = renderInSurface(<Sheet />);
    const stops = screen.getAllByRole("button").filter((block) => block.tabIndex === 0);
    expect(stops.map((block) => block.textContent)).toEqual(["Inspect Button 1 of 3, Ana Souza"]);
    expect(screen.getAllByRole("button").filter((block) => block.tabIndex === -1)).toHaveLength(3);
  });

  it("moves between blocks with the arrow keys, in the order a page reads, and the Tab stop goes with focus", async () => {
    const user = setup();
    const screen = renderInSurface(<Sheet />);
    const block = (name: RegExp) => screen.getByRole("button", { name });
    block(/Button 1 of 3/).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.shadow.activeElement).toBe(block(/Button 2 of 3/));
    await user.keyboard("{ArrowDown}");
    expect(screen.shadow.activeElement).toBe(block(/Button 3 of 3/));
    await user.keyboard("{End}");
    expect(screen.shadow.activeElement).toBe(block(/Card 1 of 1/));
    // Nothing past the end: the key leaves focus where it is.
    await user.keyboard("{ArrowRight}");
    expect(screen.shadow.activeElement).toBe(block(/Card 1 of 1/));
    expect(block(/Card 1 of 1/).tabIndex).toBe(0);
    expect(block(/Button 1 of 3/).tabIndex).toBe(-1);

    await user.keyboard("{ArrowLeft}");
    expect(screen.shadow.activeElement).toBe(block(/Button 3 of 3/));
    await user.keyboard("{Home}");
    expect(screen.shadow.activeElement).toBe(block(/Button 1 of 3/));
    await user.keyboard("{ArrowUp}");
    expect(screen.shadow.activeElement).toBe(block(/Button 1 of 3/));
  });

  it("leaves a key with a modifier to the browser", async () => {
    const user = setup();
    const screen = renderInSurface(<Sheet />);
    screen.getByRole("button", { name: /Button 1 of 3/ }).focus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(screen.shadow.activeElement).toBe(screen.getByRole("button", { name: /Button 1 of 3/ }));
    expect(stepFrom(["a", "b"], "a", { key: "ArrowRight", altKey: true, ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
  });

  it("lights its component on focus, as the pointer does, and lets go on blur", async () => {
    const onPoint = vi.fn();
    const screen = renderInSurface(<Sheet onPoint={onPoint} />);
    const ana = screen.getByRole("button", { name: /Button 1 of 3/ });
    act(() => ana.focus());
    expect(onPoint).toHaveBeenLastCalledWith(expect.objectContaining({ component: "Button" }));
    expect(screen.getByRole("toolbar").hasAttribute("data-lit")).toBe(true);
    expect(screen.getAllByRole("button").filter((block) => block.classList.contains("lit"))).toHaveLength(3);

    // Across to another component: the first's blocks go dark as the second's light.
    act(() => screen.getByRole("button", { name: /Card 1 of 1/ }).focus());
    expect(onPoint).toHaveBeenLastCalledWith(expect.objectContaining({ component: "Card" }));
    expect(screen.getAllByRole("button").filter((block) => block.classList.contains("lit"))).toHaveLength(1);

    act(() => screen.getByRole("button", { name: /Card 1 of 1/ }).blur());
    expect(onPoint).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("toolbar").hasAttribute("data-lit")).toBe(false);
  });

  it("inspects the block's Instance on Enter and on Space", async () => {
    const user = setup();
    const onSelect = vi.fn();
    const screen = renderInSurface(<Sheet onSelect={onSelect} />);
    screen.getByRole("button", { name: /Card 1 of 1/ }).focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("card-1");
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("has no axe violations", async () => {
    const screen = renderInSurface(<Sheet />);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});
