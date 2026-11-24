// @vitest-environment jsdom
// Notice and InstanceNote, by role, inside a real shadow root (ADR 0003): a notice's title
// after its tone's dot, what counts it, what it says, a row per thing it is about, and
// the command with Copy; an Instance's note, a row read as a note.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { MISSING_NOTICE, NOT_GENERATED_NOTICE, NOTE, OVERRIDES_OFF_NOTICE, STALE_NOTICE } from "../samples.js";
import { InstanceNote, Notice } from "./notice.js";
import CSS from "./notice.css?inline";

afterEach(cleanup);

describe("Notice", () => {
  it("says what changed, what it reaches, and the command that fixes it", async () => {
    const user = userEvent.setup({ document });
    const onCopy = vi.fn(() => Promise.resolve());
    const screen = renderInSurface(<Notice notice={STALE_NOTICE} words={COMMAND_WORDS} onCopy={onCopy} />);
    const card = screen.getByTestId("stale-notice");
    expect(screen.getByText("Source changed").querySelector("[data-dot]")?.getAttribute("data-dot")).toBe("amber");
    expect(screen.getByText("3 components").hasAttribute("data-meta")).toBe(true);
    expect(screen.getByText(STALE_NOTICE.body).tagName).toBe("P");
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(["Button, ButtonGroup ui/button.tsx", "Badge ui/badge.tsx"]);
    expect(screen.getByText("ui/button.tsx").getAttribute("title")).toBe("ds/components/ui/button.tsx");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledWith(STALE_NOTICE.command);
    // The panel says it through its live regions: the card carries no role.
    expect(card.getAttribute("role")).toBeNull();
  });

  it("names the components a row each, and a red notice by its dot", () => {
    const screen = renderInSurface(
      <>
        <Notice notice={NOT_GENERATED_NOTICE} words={COMMAND_WORDS} onCopy={() => Promise.resolve()} />
        <Notice notice={MISSING_NOTICE} words={COMMAND_WORDS} onCopy={() => Promise.resolve()} />
      </>,
    );
    expect(screen.getByRole("listitem").textContent).toBe("MemberNote");
    expect(screen.getByText("Product layer missing").querySelector("[data-dot]")?.getAttribute("data-dot")).toBe("alert");
    expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
  });

  it("draws no list, meta or command it doesn't have", () => {
    const screen = renderInSurface(<Notice notice={OVERRIDES_OFF_NOTICE} words={COMMAND_WORDS} onCopy={() => Promise.resolve()} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.shadow.querySelector("[data-meta]")).toBeNull();
    expect(screen.getByTestId("overrides-off-notice").textContent).toBe(`${OVERRIDES_OFF_NOTICE.title}${OVERRIDES_OFF_NOTICE.body}`);
  });

  it("has no axe violations", async () => {
    const screen = renderInSurface(
      <>
        <Notice notice={STALE_NOTICE} words={COMMAND_WORDS} onCopy={() => Promise.resolve()} />
        <Notice notice={OVERRIDES_OFF_NOTICE} words={COMMAND_WORDS} onCopy={() => Promise.resolve()} />
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("InstanceNote", () => {
  it("is a note: its title a heading over its paragraph, after the hidden info glyph", async () => {
    const screen = renderInSurface(<InstanceNote note={NOTE} />);
    const note = screen.getByRole("note");
    expect(screen.getByRole("heading", { level: 3, name: NOTE.title })).toBeTruthy();
    expect(screen.getByText(NOTE.body).tagName).toBe("P");
    expect(note.querySelector("[data-row-glyph]")?.getAttribute("aria-hidden")).toBe("true");
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Notice's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("var(--font-paragraph)");
  });
});
