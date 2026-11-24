// @vitest-environment jsdom
// SiteCard, by role, inside a real shadow root (ADR 0003): the card a button named for its
// call site and what it shows, a dot a button per Instance; each picks through its
// callback, and pointing outlines the call site, or the one Instance under a dot.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { BUTTON_GROUP, MENU_ITEM_GROUP } from "../samples.js";
import { SiteCard } from "./site-card.js";
import CSS from "./site-card.css?inline";

afterEach(cleanup);

const SITE = BUTTON_GROUP.sites[0] as (typeof BUTTON_GROUP.sites)[number];

function draw(site = SITE) {
  const calls = { onSite: vi.fn(), onInstance: vi.fn(), onHover: vi.fn() };
  const screen = renderInSurface(<SiteCard site={site} {...calls} />);
  return { screen, ...calls };
}

describe("SiteCard", () => {
  it("is a button named for its call site and what its Instances show, then a button per Instance", () => {
    const { screen } = draw();
    const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual([
      "Inspect member-row-menu.tsx:37: Actions for Ana Souza, Actions for Bia Costa +2",
      "Inspect Actions for Ana Souza",
      "Inspect Actions for Bia Costa",
      "Inspect Actions for Caio Prado",
      "Inspect Actions for Dani Reis",
    ]);
    expect(screen.getByText("member-row-menu.tsx:37")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect Actions for Ana Souza" }).getAttribute("title")).toBe("Actions for Ana Souza");
  });

  it("picks the call site from the card and one Instance from its dot", async () => {
    const user = userEvent.setup({ document });
    const { screen, onSite, onInstance } = draw();
    await user.click(screen.getByRole("button", { name: /^Inspect member-row-menu/ }));
    expect(onSite).toHaveBeenCalledWith(SITE);
    await user.click(screen.getByRole("button", { name: "Inspect Actions for Caio Prado" }));
    expect(onInstance).toHaveBeenCalledWith("caio");
  });

  it("outlines the whole call site under the pointer, and only its Instance under a dot", async () => {
    const user = userEvent.setup({ document });
    const { screen, onHover } = draw();
    await user.hover(screen.getByRole("button", { name: /^Inspect member-row-menu/ }));
    expect(onHover).toHaveBeenLastCalledWith(SITE.ids);
    await user.hover(screen.getByRole("button", { name: "Inspect Actions for Bia Costa" }));
    expect(onHover).toHaveBeenLastCalledWith(["bia"]);
    await user.unhover(screen.getByRole("button", { name: "Inspect Actions for Bia Costa" }));
    expect(onHover).toHaveBeenLastCalledWith([]);
  });

  it("marks a call site no Override can reach with the eye", () => {
    const { screen } = draw(MENU_ITEM_GROUP.sites[0]);
    expect(screen.shadow.querySelector("[data-site-names] [data-icon]")).not.toBeNull();
    cleanup();
    const supported = draw();
    expect(supported.screen.shadow.querySelector("[data-site-names] [data-icon]")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { screen } = draw();
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("SiteCard's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
