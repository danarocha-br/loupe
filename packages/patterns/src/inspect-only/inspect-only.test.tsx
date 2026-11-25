// @vitest-environment jsdom
// InspectOnly, by role, inside a real shadow root (ADR 0003): one disclosure that names
// its props while folded, opens to the view's rows, says one shared reason once, and
// folds the library's props under the rest.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../testing.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { PropRow } from "../prop-row/prop-row.js";
import { INSPECT_ONLY, INSPECT_ONLY_SHARED, WORDS } from "../samples.js";
import { InspectOnly } from "./inspect-only.js";
import CSS from "./inspect-only.css?inline";

afterEach(cleanup);

const calls = { onSet: () => {}, onText: () => {}, onReset: () => {}, onSelect: () => {}, onHover: () => {} };
const row = (item: (typeof INSPECT_ONLY.rows)[number]) => <PropRow key={item.name} item={item} look="pair" words={WORDS.inspector} {...calls} />;

describe("InspectOnly", () => {
  it("folds to one button that names its props, and opens to their rows", async () => {
    const user = userEvent.setup({ document });
    const screen = renderInSurface(<InspectOnly inspect={INSPECT_ONLY} row={row} />);
    const fold = screen.getByRole("button", { name: /^Inspect only · 2/ });
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(fold.textContent).toBe("Inspect only · 2 · type, onClick");
    await user.click(fold);
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    // Open, the names are the rows': the title says only the count.
    expect(fold.textContent).toBe("Inspect only · 2");
    expect(screen.shadow.querySelectorAll("[data-inspect-fold-rows] [data-prop]")).toHaveLength(2);
  });

  it("folds the library's props under the rest, as a pair each", async () => {
    const user = userEvent.setup({ document });
    const screen = renderInSurface(<InspectOnly inspect={{ ...INSPECT_ONLY, open: true }} row={row} />);
    const library = screen.getByRole("button", { name: "2 set by the library" });
    expect(library.getAttribute("aria-expanded")).toBe("false");
    await user.click(library);
    expect(screen.getByText("aria-expanded").closest("[data-row]")?.getAttribute("data-row")).toBe("pair");
    expect(screen.getByText("data-slot").closest("[data-row]")?.textContent).toBe('data-slot"button"');
  });

  it("opens by itself when nothing else can change, and says the one shared reason once", () => {
    const screen = renderInSurface(<InspectOnly inspect={INSPECT_ONLY_SHARED} row={row} />);
    expect(screen.getByRole("button", { name: /^Inspect only · 2/ }).getAttribute("aria-expanded")).toBe("true");
    const why = screen.getByText("OPEN TEXT");
    expect(why.getAttribute("title")).toBe(INSPECT_ONLY_SHARED.shared?.title);
    expect(why.closest("p")?.textContent).toBe(`OPEN TEXT ${INSPECT_ONLY_SHARED.shared?.title}`);
    expect(screen.getByText("Overrides off").hasAttribute("data-meta")).toBe(true);
  });

  it("says when it has no prop", () => {
    const screen = renderInSurface(<InspectOnly inspect={{ ...INSPECT_ONLY_SHARED, title: "Inspect only", names: null, shared: null, rows: [] }} row={row} />);
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("has no axe violations, folded and open", async () => {
    const screen = renderInSurface(
      <>
        <InspectOnly inspect={INSPECT_ONLY} row={row} />
        <InspectOnly inspect={INSPECT_ONLY_SHARED} row={row} />
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("InspectOnly's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("var(--tracking-title)");
  });
});
