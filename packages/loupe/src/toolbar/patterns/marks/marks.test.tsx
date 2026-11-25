// @vitest-environment jsdom
// Marks, by role, inside a real shadow root (ADR 0003): a change's delta named as the
// change it numbers, an empty one hidden, a verdict in words, a tag in its kind's look,
// and a name that breaks only between its words.

import { afterEach, describe, expect, it } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { MAP_HUES } from "../tokens.js";
import { expectPatternCss } from "../css.fixture.js";
import { Breakable, ChangeKey, HeldKey, Keys, StatusChip, TagChip } from "./marks.js";
import CSS from "./marks.css?inline";
import { WORDS } from "../samples.js";

afterEach(cleanup);

describe("Marks", () => {
  it("names a change's delta as the change it numbers, and hides a held State prop's empty one", async () => {
    const screen = renderInSurface(
      <p>
        <ChangeKey n={2} words={WORDS.inspector} /> <HeldKey words={WORDS.inspector} /> variant
      </p>,
    );
    const delta = screen.getByRole("img", { name: "Change 2" });
    expect([delta.textContent, delta.getAttribute("title")]).toEqual(["2", "Change 2 in the Proposal"]);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByTitle(WORDS.inspector.heldTitle).getAttribute("aria-hidden")).toBe("true");
    expect(await axeViolations(screen.host)).toEqual([]);
  });

  it("sets an Instance's change numbers side by side, and nothing when none reach it", () => {
    const screen = renderInSurface(
      <>
        <Keys keys={[1, 3]} words={WORDS.inspector} />
        <Keys keys={[]} words={WORDS.inspector} />
      </>,
    );
    expect(screen.getAllByRole("img").map((delta) => delta.getAttribute("aria-label"))).toEqual(["Change 1", "Change 3"]);
    expect(screen.shadow.querySelectorAll("[data-keys]")).toHaveLength(1);
  });

  it("says a verdict in words, Supported after a hidden tick, and a plain status by itself", async () => {
    const screen = renderInSurface(
      <p>
        <StatusChip status={{ kind: "supported", text: "Supported" }} check /> <StatusChip status={{ kind: "not-generated", text: "Not generated yet" }} title="Run loupe generate" />{" "}
        <StatusChip status={{ text: "Not on the page now" }} />
      </p>,
    );
    const supported = screen.getByText("Supported");
    expect([supported.getAttribute("data-status"), supported.querySelector("svg")?.getAttribute("aria-hidden")]).toEqual(["supported", "true"]);
    expect(screen.getByTitle("Run loupe generate").getAttribute("data-status")).toBe("not-generated");
    expect(screen.getByText("Not on the page now").getAttribute("data-status")).toBe("plain");
    expect(await axeViolations(screen.host)).toEqual([]);
  });

  it("draws a tag in its kind's look: dashed for what isn't there now, amber for out of date", () => {
    const screen = renderInSurface(
      <p>
        <TagChip tag={{ kind: "not-visible", text: "Not visible now" }} /> <TagChip tag={{ kind: "stale", text: "Source changed" }} />{" "}
        <TagChip tag={{ kind: "suspended", text: "Held for review" }} />
      </p>,
    );
    const look = (text: string) => screen.getByText(text).getAttribute("data-tag-look");
    expect([look("Not visible now"), look("Source changed"), look("Held for review")]).toEqual(["dashed", "amber", "ring"]);
  });

  it("breaks a name only where its words meet", () => {
    const screen = renderInSurface(
      <h2>
        <Breakable text="AlertDialogContent" />
      </h2>,
    );
    const heading = screen.getByRole("heading", { level: 2 });
    expect([heading.textContent, heading.innerHTML]).toEqual(["AlertDialogContent", "Alert<wbr>Dialog<wbr>Content"]);
  });
});

describe("Marks' CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("var(--font-chip)");
    expect(CSS).toContain("var(--radius-pill)");
  });
});

describe("Marks' hues", () => {
  it("gives every map hue a `[data-hue]` rule, and none more", () => {
    const rules = [...CSS.matchAll(/\[data-hue="(\d+)"\] \{ --hue: var\(--map-hue-(\d+)\); \}/g)].map((match) => [match[1], match[2]]);
    expect(rules).toEqual(MAP_HUES.map((_, index) => [String(index), String(index)]));
  });
});
