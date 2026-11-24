// @vitest-environment jsdom
// PageMap, by role, inside a real shadow root (ADR 0003, ADR 0006): one Tab stop, not one
// per block; the arrow keys between blocks in the order a page reads; a name for each that
// tells Instances of one component apart, the app's words in the app's language; focus
// lighting what the pointer does; and nothing drawn while nothing has a box.

import { userEvent } from "@testing-library/user-event";
import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type GroupItem, LIST_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { MAP_BOXES, MAP_GROUPS } from "../samples.js";
import { type MapBox, PageMap, stepFrom } from "./page-map.js";
import CSS from "./page-map.css?inline";

afterEach(cleanup);

/** The map as the view holds it: the pointed component is the map's, lit, and shared with the rows. */
function Sheet({
  onSelect = () => {},
  onPoint = () => {},
  boxes = MAP_BOXES,
  nameLang,
}: {
  onSelect?(id: string): void;
  onPoint?(group: GroupItem | null): void;
  boxes?: ReadonlyMap<string, MapBox>;
  nameLang?: string;
}) {
  const [lit, setLit] = useState<string | null>(null);
  return (
    <PageMap
      groups={MAP_GROUPS}
      boxes={boxes}
      lit={lit}
      words={LIST_WORDS}
      nameLang={nameLang}
      onPoint={(group) => {
        setLit(group?.component ?? null);
        onPoint(group);
      }}
      onSelect={onSelect}
    />
  );
}

const setup = () => userEvent.setup({ document });
const lit = (screen: ReturnType<typeof renderInSurface>) => screen.getAllByRole("button").filter((block) => block.hasAttribute("data-lit"));

describe("PageMap", () => {
  it("is one named toolbar of blocks, each named for its own Instance and tinted in its component's hue", () => {
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
    const button = screen.getByRole("button", { name: /Button 1 of 3/ });
    expect([button.getAttribute("data-hue"), button.getAttribute("title")]).toEqual(["0", "Button ×3"]);
    expect(screen.getByRole("button", { name: /Card 1 of 1/ }).getAttribute("data-hue")).toBe("1");
  });

  it("keeps the app's words in the app's language, apart from Loupe's own", () => {
    const screen = renderInSurface(<Sheet nameLang="pt-BR" />);
    const name = screen.getByRole("button", { name: /Button 1 of 3/ }).querySelector("[lang]");
    expect(name?.textContent).toBe("Ana Souza");
    expect(name?.getAttribute("lang")).toBe("pt-BR");
    expect(name?.getAttribute("dir")).toBe("auto");
    // Where the Instance shows no name, what is read is Loupe's own: its call site.
    expect(screen.getByRole("button", { name: /Button 3 of 3/ }).querySelector("[lang]")).toBeNull();
  });

  it("places each block where its Instance sits, in the page's shape", () => {
    const screen = renderInSurface(<Sheet />);
    const card = screen.getByRole("button", { name: /Card 1 of 1/ });
    // The page is 200 × 190: the card is the whole width, under the buttons.
    expect([card.style.left, card.style.top, card.style.width]).toEqual(["0%", `${(90 / 190) * 100}%`, "100%"]);
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
    expect(lit(screen)).toHaveLength(3);

    // Across to another component: the first's blocks go dark as the second's light.
    act(() => screen.getByRole("button", { name: /Card 1 of 1/ }).focus());
    expect(onPoint).toHaveBeenLastCalledWith(expect.objectContaining({ component: "Card" }));
    expect(lit(screen)).toHaveLength(1);

    act(() => screen.getByRole("button", { name: /Card 1 of 1/ }).blur());
    expect(onPoint).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("toolbar").hasAttribute("data-lit")).toBe(false);
  });

  it("lights from the pointer too, and lets go as it leaves the map", async () => {
    const user = setup();
    const onPoint = vi.fn();
    const screen = renderInSurface(<Sheet onPoint={onPoint} />);
    await user.hover(screen.getByRole("button", { name: /Card 1 of 1/ }));
    expect(onPoint).toHaveBeenLastCalledWith(expect.objectContaining({ component: "Card" }));
    await user.unhover(screen.getByRole("toolbar"));
    expect(onPoint).toHaveBeenLastCalledWith(null);
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

  it("draws nothing while nothing has a box", () => {
    const screen = renderInSurface(<Sheet boxes={new Map()} />);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("has no axe violations", async () => {
    const screen = renderInSurface(<Sheet />);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("PageMap's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
