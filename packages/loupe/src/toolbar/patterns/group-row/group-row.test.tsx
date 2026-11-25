// @vitest-environment jsdom
// GroupRow, by role, inside a real shadow root (ADR 0003): a component's row is a list item
// whose button names it, counts it and says what is exceptional; it opens to its call
// sites' cards and its unmounted Instances, and points, picks and opens through its callbacks.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GroupItem } from "../view.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { BUTTON_GROUP, MENU_ITEM_GROUP, WORDS } from "../samples.js";
import { GroupRow } from "./group-row.js";
import CSS from "./group-row.css?inline";

afterEach(cleanup);

function draw(group: GroupItem, lit = false) {
  const calls = { onPoint: vi.fn(), onSite: vi.fn(), onInstance: vi.fn(), onHover: vi.fn() };
  const screen = renderInSurface(
    <ul aria-label="Components on this page">
      <GroupRow group={group} lit={lit} words={WORDS.inspector} {...calls} />
    </ul>,
  );
  const row = screen.getByRole("listitem");
  const trigger = screen.getByRole("button", { expanded: false });
  return { screen, row, trigger, ...calls };
}

describe("GroupRow", () => {
  it("names its component, counts it, and says only what is exceptional, in its component's hue", () => {
    const { row, trigger } = draw(BUTTON_GROUP);
    expect(trigger.textContent).toBe("Button ×6" + "1 Instance changed");
    expect(row.getAttribute("data-hue")).toBe("0");
    expect(row.querySelector("[data-group-bar] i")?.getAttribute("style")).toBe("width: 100%;");
    expect(row.querySelector("[data-group-bar]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("breaks a long name only between its words, and marks an inspect-only component with the eye and its reason", () => {
    const { row, trigger } = draw(MENU_ITEM_GROUP);
    expect(row.querySelector("[data-group-name]")?.querySelectorAll("wbr")).toHaveLength(2);
    expect(row.hasAttribute("data-inspect-only")).toBe(true);
    expect(row.querySelector("[data-group-name] [data-icon]")).not.toBeNull();
    expect(trigger.getAttribute("title")).toBe("npx loupe generate");
    expect(trigger.textContent).toBe("DropdownMenuItem ×1" + "Not generated yet" + "Source changed" + "1 not mounted");
  });

  it("takes the hover wash while its component is lit from the map", () => {
    expect(draw(BUTTON_GROUP, true).row.hasAttribute("data-lit")).toBe(true);
    cleanup();
    expect(draw(BUTTON_GROUP).row.hasAttribute("data-lit")).toBe(false);
  });

  it("points at its component from the pointer and from focus", async () => {
    const user = userEvent.setup({ document });
    const { trigger, onPoint } = draw(BUTTON_GROUP);
    await user.hover(trigger);
    expect(onPoint).toHaveBeenLastCalledWith(BUTTON_GROUP);
    await user.unhover(trigger);
    expect(onPoint).toHaveBeenLastCalledWith(null);
    trigger.focus();
    expect(onPoint).toHaveBeenLastCalledWith(BUTTON_GROUP);
  });

  it("opens to its call sites, each a card that picks them, and a dot that picks one", async () => {
    const user = userEvent.setup({ document });
    const { screen, trigger, onSite, onInstance } = draw(BUTTON_GROUP);
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2 call sites · pick one to inspect")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Inspect invite-form\.tsx:12: / }));
    expect(onSite).toHaveBeenCalledWith(BUTTON_GROUP.sites[1]);
    await user.click(screen.getByRole("button", { name: "Inspect Actions for Dani Reis" }));
    expect(onInstance).toHaveBeenCalledWith("dani");
  });

  it("lists an Instance that holds an Override but isn't mounted, with its numbers, its tags and what it holds", async () => {
    const user = userEvent.setup({ document });
    const { screen, trigger, onInstance } = draw(MENU_ITEM_GROUP);
    await user.click(trigger);
    const gone = screen.getByRole("button", { name: /member-row-menu\.tsx:42#m1/ });
    expect(gone.textContent).toBe("2" + "member-row-menu.tsx:42#m1" + "No Instance mounted");
    expect(screen.getByRole("img", { name: "Change 2" })).toBeTruthy();
    expect(screen.getByTestId("held-values").textContent).toBe('children "Remover" · Current "Remove" (last seen)');
    await user.click(gone);
    expect(onInstance).toHaveBeenCalledWith("item-2");
  });

  it("passes axe, closed and open", async () => {
    const user = userEvent.setup({ document });
    const calls = { onPoint: () => {}, onSite: () => {}, onInstance: () => {}, onHover: () => {} };
    const screen = renderInSurface(
      <ul aria-label="Components on this page">
        <GroupRow group={BUTTON_GROUP} lit={false} words={WORDS.inspector} {...calls} />
        <GroupRow group={MENU_ITEM_GROUP} lit words={WORDS.inspector} {...calls} />
      </ul>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
    for (const trigger of screen.getAllByRole("button", { expanded: false })) await user.click(trigger);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("GroupRow's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
