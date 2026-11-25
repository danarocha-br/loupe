// @vitest-environment jsdom
// OnThisPage, by role, inside a real shadow root (ADR 0003): a level-3 heading and its count,
// then what the view gives it, the page map over a named list of rows, in that order.

import { afterEach, describe, expect, it } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { GroupRow } from "../group-row/group-row.js";
import { PageMap } from "../page-map/page-map.js";
import { LIST_BOXES, LIST_GROUPS, LIST_SUMMARY, WORDS } from "../samples.js";
import { OnThisPage } from "./on-this-page.js";
import CSS from "./on-this-page.css?inline";

afterEach(cleanup);

const none = () => {};

function draw() {
  return renderInSurface(
    <OnThisPage
      words={WORDS.list}
      summary={LIST_SUMMARY}
      map={<PageMap groups={LIST_GROUPS} boxes={LIST_BOXES} lit={null} words={WORDS.list} onPoint={none} onSelect={none} />}
    >
      {LIST_GROUPS.map((group) => (
        <GroupRow key={group.component} group={group} lit={false} words={WORDS.inspector} onPoint={none} onSite={none} onInstance={none} onHover={none} />
      ))}
    </OnThisPage>,
  );
}

describe("OnThisPage", () => {
  it("heads its card with its title and count, then the map over the rows", () => {
    const screen = draw();
    const heading = screen.getByRole("heading", { level: 3, name: "On this page" });
    expect(heading.parentElement?.textContent).toBe("On this page" + "2 components · 7 Instances");
    const map = screen.getByRole("toolbar", { name: "Page map" });
    const rows = screen.getByRole("list", { name: "Components on this page" });
    expect(map.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("listitem").filter((item) => item.parentElement === rows)).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    expect(await axeViolations(draw().host)).toEqual([]);
  });
});

describe("OnThisPage's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
  });
});
