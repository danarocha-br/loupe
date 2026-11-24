// @vitest-environment jsdom
// FlagsCard and FlagRow, by role, inside a real shadow root (ADR 0003): a flag's options as
// one radio group named by its key, what shows now, Clear while previewed, a refused write
// said under the flags, and, while previews are off, one disclosure that says why.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { FLAGS, FLAGS_OFF } from "../samples.js";
import { FlagsCard } from "./flags-card.js";
import CSS from "./flags-card.css?inline";

afterEach(cleanup);

function draw(flags = FLAGS, busy = false) {
  const calls = { onPreview: vi.fn(), onClear: vi.fn(), onClearAll: vi.fn(), onCopy: vi.fn(() => Promise.resolve()) };
  return { screen: renderInSurface(<FlagsCard flags={flags} busy={busy} words={COMMAND_WORDS} {...calls} />), ...calls };
}

describe("FlagsCard", () => {
  it("draws each flag's options as a radio group named by its key, with what shows now", () => {
    const { screen } = draw();
    expect(screen.getByRole("heading", { level: 3, name: "Feature flags" })).toBeTruthy();
    expect(screen.getByText("3 declared · 1 previewing").hasAttribute("data-meta")).toBe(true);
    const tier = screen.getByRole("radiogroup", { name: "plan-tier" });
    expect([...tier.querySelectorAll('[role="radio"]')].map((radio) => [radio.textContent, radio.getAttribute("aria-checked")])).toEqual([
      ["Free", "false"],
      ["Pro", "true"],
      ["Team", "false"],
    ]);
    expect(screen.getByText("Previewing Pro")).toBeTruthy();
    // While the app decides, nothing is checked.
    const banner = screen.getByRole("radiogroup", { name: "beta-banner" });
    expect([...banner.querySelectorAll('[aria-checked="true"]')]).toHaveLength(0);
    expect(screen.getByText("App decides")).toBeTruthy();
    expect(screen.getByText("No options declared: offered as on and off.")).toBeTruthy();
  });

  it("previews an option, clears one flag, and clears them all, through its callbacks", async () => {
    const user = userEvent.setup({ document });
    const { screen, onPreview, onClear, onClearAll } = draw();
    await user.click(screen.getByRole("radio", { name: "Team" }));
    expect(onPreview).toHaveBeenCalledWith("plan-tier", "team");
    const clear = screen.getByRole("button", { name: "Clear" });
    await user.click(clear);
    expect(onClear).toHaveBeenCalledWith("plan-tier", clear);
    const all = screen.getByRole("button", { name: "Clear flag previews" });
    await user.click(all);
    expect(onClearAll).toHaveBeenCalledWith(all);
  });

  it("says a refused write under the flags, and turns its buttons off while a write is out", () => {
    const { screen } = draw(FLAGS, true);
    expect(screen.getByText("Failed to fetch").querySelector("[data-dot]")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Clear flag previews" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("folds previews off to one line that opens to why, and the fix's command", async () => {
    const user = userEvent.setup({ document });
    const { screen, onCopy } = draw(FLAGS_OFF);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    const off = screen.getByRole("button", { name: /^Flag previews are off/ });
    expect(off.getAttribute("aria-expanded")).toBe("false");
    await user.click(off);
    expect(off.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(FLAGS_OFF.off?.reason as string)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledWith("FLAGS_SECRET=");
    expect(screen.queryByRole("button", { name: "Clear flag previews" })).toBeNull();
  });

  it("says it is reading the flags, and when the app declares none", () => {
    const { screen } = draw({ ...FLAGS_OFF, meta: null, off: null, loading: "Reading the app’s flags…" });
    expect(screen.getByText("Reading the app’s flags…")).toBeTruthy();
    cleanup();
    const empty = draw({ ...FLAGS, meta: "0 declared · 0 previewing", rows: [], error: null, empty: "The app declares no flags." }).screen;
    expect(empty.getByText("The app declares no flags.")).toBeTruthy();
  });

  it("has no axe violations, ready and off", async () => {
    const { screen } = draw();
    expect(await axeViolations(screen.host)).toEqual([]);
    cleanup();
    const off = draw(FLAGS_OFF).screen;
    expect(await axeViolations(off.host)).toEqual([]);
  });
});

describe("FlagsCard's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });

  // jsdom lays nothing out, so the rule is read: a group sized to its content let each chip
  // (flex: 1, from nothing) squeeze to its narrowest, breaking "Off" into "Of f".
  it("grows a flag's chip group into the row, so its chips share the width and keep their words whole", () => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
    const rules = [...(style.sheet?.cssRules ?? [])].filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
    const declared = (selector: string, property: string) => rules.find((rule) => rule.selectorText === selector)?.style.getPropertyValue(property);
    style.remove();
    expect(declared("[data-flag] [data-chip-group]", "flex")).toBe("1");
    expect(declared("[data-flag] [data-chip-group]", "min-width")).toBe("0");
    expect(declared("[data-flag] [data-chip]", "flex")).toBe("1");
  });
});
