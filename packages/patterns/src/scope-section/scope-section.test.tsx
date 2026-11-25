// @vitest-environment jsdom
// ScopeSection, by role, inside a real shadow root (ADR 0003): the scope named as a
// heading, how far it reaches in words, Widen or Narrow, Reset this scope while it can,
// and its Instances folded behind their count, each a checkbox; at the page, a fieldset
// per call site whose box leaves the whole site out.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MembersView } from "../view.js";
import { axeViolations, cleanup, renderInSurface } from "../testing.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { MEMBERS, PAGE_MEMBERS, WORDS } from "../samples.js";
import { METER_MAX, ScopeSection } from "./scope-section.js";
import CSS from "./scope-section.css?inline";

afterEach(cleanup);

const SELECTED = MEMBERS.members[2]?.id as string;

function draw(members: MembersView) {
  const calls = { onScope: vi.fn(), onReset: vi.fn(), onToggle: vi.fn(), onHover: vi.fn() };
  const screen = renderInSurface(<ScopeSection members={members} selected={SELECTED} words={WORDS.inspector} {...calls} />);
  return { screen, ...calls };
}

describe("ScopeSection", () => {
  it("names its scope as a heading and says how far it reaches, a dot for each Instance on the page", () => {
    const { screen } = draw(MEMBERS);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("All in MemberRowMenu");
    expect(screen.getByText("3 of 4").tagName).toBe("B");
    expect(screen.getByText(/^Reaches/).textContent).toBe("Reaches 3 of 4 · 3 more on this page");
    const meter = screen.shadow.querySelector("[data-scope-meter]") as HTMLElement;
    expect(meter.getAttribute("aria-hidden")).toBe("true");
    expect([...meter.children].map((dot) => dot.hasAttribute("data-in"))).toEqual([true, true, true, false, false, false, false]);
  });

  it("draws no meter past a dozen: the words alone say it", () => {
    const { screen } = draw({ ...MEMBERS, reach: { ...MEMBERS.reach, page: METER_MAX + 1 } });
    expect(screen.shadow.querySelector("[data-scope-meter]")).toBeNull();
  });

  it("widens and resets through its callbacks", async () => {
    const user = userEvent.setup({ document });
    const { screen, onScope, onReset } = draw(MEMBERS);
    const widen = screen.getByRole("button", { name: "Widen to All on page · 7" });
    await user.click(widen);
    expect(onScope).toHaveBeenCalledWith("page");
    await user.click(screen.getByRole("button", { name: "Reset this scope" }));
    expect(onReset).toHaveBeenCalledWith(MEMBERS.reset.target);
  });

  it("opens on its own while one is left out, each Instance a checkbox by its name, the picked one tagged", async () => {
    const user = userEvent.setup({ document });
    const { screen, onToggle, onHover } = draw(MEMBERS);
    const count = screen.getByRole("button", { name: "4 Instances" });
    expect(count.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(WORDS.inspector.untick)).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, true, true, false]);
    expect(screen.getByRole("checkbox", { name: "Remove Caio picked" })).toBeTruthy();
    const dani = screen.getByRole("checkbox", { name: "Remove Dani Left out" });
    await user.click(dani);
    expect(onToggle).toHaveBeenCalledWith("include", ["dani"]);
    await user.hover(dani.closest("li") as HTMLElement);
    expect(onHover).toHaveBeenLastCalledWith(["dani"]);
  });

  it("stays folded while every Instance is in, and opens from its count", async () => {
    const user = userEvent.setup({ document });
    const all = { ...MEMBERS, members: MEMBERS.members.map((member) => ({ ...member, out: false, tag: null })) };
    const { screen } = draw(all);
    const count = screen.getByRole("button", { name: "4 Instances" });
    expect(count.getAttribute("aria-expanded")).toBe("false");
    await user.click(count);
    expect(count.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("groups the page's Instances by call site, one box leaving the whole site out, and lists the server's apart", async () => {
    const user = userEvent.setup({ document });
    const { screen, onToggle } = draw(PAGE_MEMBERS);
    expect(screen.getByRole("button", { name: "Narrow to All in MemberRowMenu · 4" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset this scope" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "6 Instances" }));
    const sites = screen.getAllByRole("group");
    expect(sites.map((site) => site.querySelector("legend")?.textContent)).toEqual(["member-row-menu.tsx:37 · 3", "invite-form.tsx:12 · 3"]);
    await user.click(screen.getByRole("checkbox", { name: "invite-form.tsx:12 · 3" }));
    expect(onToggle).toHaveBeenCalledWith("exclude", ["eva", "fia", "gil"]);
    expect(screen.getByRole("list", { name: "Server-rendered" }).textContent).toBe("Footer Button" + "On the server");
  });

  it("passes axe, folded and open, at a call site and at the page", async () => {
    const calls = { onScope: () => {}, onReset: () => {}, onToggle: () => {}, onHover: () => {} };
    const screen = renderInSurface(
      <>
        <ScopeSection members={MEMBERS} selected={SELECTED} words={WORDS.inspector} {...calls} />
        <ScopeSection members={PAGE_MEMBERS} selected={SELECTED} words={WORDS.inspector} {...calls} />
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("ScopeSection's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("@media (forced-colors: active)");
  });
});
