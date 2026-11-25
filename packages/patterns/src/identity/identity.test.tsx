// @vitest-environment jsdom
// Identity, by role, inside a real shadow root (ADR 0003): Back, the component and its
// page, the verdict and deltas; the name as the one level-2 heading, which takes focus;
// where it is written; only the exceptions; the view's actions in their place; and the
// Instances it is inside, each a button that selects it.

import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../testing.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { GONE, IDENTITY, NOT_GENERATED, WORDS } from "../samples.js";
import { Identity } from "./identity.js";
import CSS from "./identity.css?inline";

afterEach(cleanup);

describe("Identity", () => {
  it("names what is selected: Back, the component and page, the verdict, its deltas, and the name as the heading", async () => {
    const user = userEvent.setup({ document });
    const onBack = vi.fn();
    const heading = createRef<HTMLHeadingElement>();
    const screen = renderInSurface(<Identity words={WORDS.inspector} onBack={onBack} heading={heading} nameLang="pt-BR" identity={IDENTITY} />);
    const back = screen.getByRole("button", { name: "All components" });
    expect(back.getAttribute("title")).toBe(WORDS.inspector.back.title);
    await user.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByText("Button").textContent).toBe("Button");
    expect(screen.getByText("/ Billing")).toBeTruthy();
    expect(screen.getByText("Supported").getAttribute("data-status")).toBe("supported");
    expect(screen.getAllByRole("img").map((delta) => delta.getAttribute("aria-label"))).toEqual(["Change 1", "Change 2", "Change 3"]);
    const name = screen.getByRole("heading", { level: 2, name: "Remove Caio from the workspace" });
    expect([name.getAttribute("dir"), name.getAttribute("lang"), name.tabIndex]).toEqual(["auto", "pt-BR", -1]);
    expect(heading.current).toBe(name);
  });

  it("says where it is written, its line set apart, and its path and key on hover", () => {
    const screen = renderInSurface(<Identity words={WORDS.inspector} onBack={() => {}} identity={IDENTITY} />);
    const where = screen.getByTestId("instance-id");
    expect([where.textContent, where.getAttribute("title"), where.getAttribute("data-id")]).toEqual([
      "member-row-menu.tsx:37 · use 2 of 3",
      IDENTITY.whereTitle,
      IDENTITY.id,
    ]);
    expect(screen.getByText(":37 · use 2 of 3").hasAttribute("data-identity-line")).toBe(true);
  });

  it("says only the exceptions: its tags and the scopes acting on it", () => {
    const screen = renderInSurface(<Identity words={WORDS.inspector} onBack={() => {}} identity={IDENTITY} />);
    expect(screen.getByTestId("chips").textContent).toBe("Not visible now" + "Also in All on page");
    cleanup();
    const bare = renderInSurface(<Identity words={WORDS.inspector} onBack={() => {}} identity={{ ...IDENTITY, tags: [], chips: [] }} />);
    expect(bare.queryByTestId("chips")).toBeNull();
  });

  it("lists the Instances it is inside, outermost first, each a button that selects it", async () => {
    const user = userEvent.setup({ document });
    const onCrumb = vi.fn();
    const screen = renderInSurface(<Identity words={WORDS.inspector} onBack={() => {}} onCrumb={onCrumb} identity={IDENTITY} />);
    const inside = screen.getByTestId("inside");
    expect(inside.textContent?.startsWith("Inside")).toBe(true);
    const crumbs = [...inside.querySelectorAll("button")].map((button) => button.textContent);
    expect(crumbs).toEqual(["MembersList", "MemberRow", "MemberRowMenu"]);
    await user.click(screen.getByRole("button", { name: "MemberRow" }));
    expect(onCrumb).toHaveBeenCalledWith("row");
  });

  it("warns when its component isn't generated, with the command that would read it", () => {
    const screen = renderInSurface(
      <Identity words={WORDS.inspector} onBack={() => {}} identity={{ ...IDENTITY, notGenerated: { tag: NOT_GENERATED, command: "npx loupe generate" } }} />,
    );
    expect(screen.getByTestId("not-generated").textContent).toBe("Not generated yet Run npx loupe generate from the repo root to read its props.");
  });

  it("places the view's actions, and heads a gone Instance with what it still holds", () => {
    const screen = renderInSurface(
      <Identity
        words={WORDS.inspector}
        onBack={() => {}}
        nameLang="pt-BR"
        identity={{ ...GONE, note: "It shows here again when it mounts.", held: ['variant: "outline"'] }}
        actions={<button type="button">Reset this Instance</button>}
      />,
    );
    // Its component's name, Loupe's word: not read in the app's language.
    expect([screen.getByRole("heading", { level: 2 }).textContent, screen.getByRole("heading", { level: 2 }).getAttribute("lang")]).toEqual(["Button", null]);
    expect(screen.getByText("Not on the page now").getAttribute("data-status")).toBe("plain");
    expect(screen.getByTestId("instance-id").querySelector("svg")).toBeNull();
    expect(screen.getByText("It shows here again when it mounts.").tagName).toBe("P");
    expect(screen.getByTestId("held-values").textContent).toBe('variant: "outline"');
    expect(screen.getByRole("button", { name: "Reset this Instance" }).parentElement?.hasAttribute("data-identity-actions")).toBe(true);
    expect(screen.queryByTestId("inside")).toBeNull();
  });

  it("passes axe, at the Inspector and once gone", async () => {
    const screen = renderInSurface(
      <>
        <Identity words={WORDS.inspector} onBack={() => {}} identity={{ ...IDENTITY, notGenerated: { tag: NOT_GENERATED, command: "npx loupe generate" } }} />
        <Identity words={WORDS.inspector} onBack={() => {}} identity={GONE} />
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Identity's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    for (const step of ["headline", "annotation", "mono-small", "caption"]) expect(CSS).toContain(`var(--font-${step})`);
  });
});
