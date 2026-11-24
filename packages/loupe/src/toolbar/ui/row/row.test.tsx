// @vitest-environment jsdom
// Row, by role, inside a real shadow root (ADR 0003): a line read in order, name then
// value then action, its glyph hidden in a column of its own, a list item in a list,
// and the line's controls reached by their own roles.

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { Button } from "../button/button.js";
import { Switch } from "../switch/switch.js";
import { Tag } from "../tag/tag.js";
import { Row, RowAction, RowLine, type RowLook, RowName, RowValue } from "./row.js";
import CSS from "./row.css?inline";

afterEach(cleanup);

const LOOKS: RowLook[] = ["inset", "ruled", "pair", "item"];

const Glyph = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="6" />
  </svg>
);

describe("Row", () => {
  it("reads its line in order, name, what qualifies it, value, action, with its glyph hidden", () => {
    const screen = renderInSurface(
      <Row glyph={<Glyph />} data-testid="row">
        <RowLine>
          <RowName code="variant" title="Variant (variant)">
            Variant
          </RowName>
          <Tag>State prop</Tag>
          <RowValue>"ghost"</RowValue>
          <RowAction>
            <Button size="small">Reset</Button>
          </RowAction>
        </RowLine>
        <p>Under the line</p>
      </Row>,
    );
    const row = screen.getByTestId("row");
    expect([row.tagName, row.getAttribute("role"), row.getAttribute("data-row"), row.hasAttribute("data-glyphed")]).toEqual(["DIV", null, "inset", true]);
    // The glyph is the row's first child, hidden: a screen reader reads the words alone.
    const glyph = row.firstElementChild as HTMLElement;
    expect([glyph.hasAttribute("data-row-glyph"), glyph.getAttribute("aria-hidden")]).toEqual([true, "true"]);
    expect(row.textContent).toBe('Variant variantState prop"ghost"ResetUnder the line');
    expect(screen.getByTitle("Variant (variant)").textContent).toBe("Variant variant");
    expect(screen.getByRole("button", { name: "Reset" }).closest("[data-row-action]")).not.toBeNull();
  });

  it("is a list item in a list, and has no glyph column without a glyph", () => {
    const screen = renderInSurface(
      <ul aria-label="Changed modules">
        <Row as="li" look="ruled">
          <RowLine>
            <span>Button, Card</span>
            <RowValue title="components/button.tsx">components/button.tsx</RowValue>
          </RowLine>
        </Row>
      </ul>,
    );
    const item = screen.getByRole("listitem");
    expect([item.getAttribute("data-row"), item.hasAttribute("data-glyphed"), item.querySelector("[data-row-glyph]")]).toEqual(["ruled", false, null]);
    expect(screen.getByTitle("components/button.tsx").textContent).toBe("components/button.tsx");
  });

  it("leaves its action's keys to the action: a switch at the line's end turns from the keyboard", async () => {
    const onCheckedChange = vi.fn();
    const screen = renderInSurface(
      <Row glyph={<Glyph />}>
        <RowLine>
          <RowName>open</RowName>
          <RowAction>
            <Switch label="open" checked={false} onCheckedChange={onCheckedChange} />
          </RowAction>
        </RowLine>
      </Row>,
    );
    const user = userEvent.setup({ document });
    const toggle = screen.getByRole("switch", { name: "open" });
    toggle.focus();
    expect(screen.shadow.activeElement).toBe(toggle);
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("takes a role from the view when it is more than a line", () => {
    const screen = renderInSurface(
      <Row glyph={<Glyph />} role="note">
        <h3>Rendered on the server</h3>
        <p>Its props can't change here.</p>
      </Row>,
    );
    expect(screen.getByRole("note").textContent).toBe("Rendered on the server" + "Its props can't change here.");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Rendered on the server");
  });

  it("draws its look through an attribute, sets a name in mono, and passes class and data-* through", () => {
    const screen = renderInSurface(
      <>
        {LOOKS.map((look) => (
          <Row key={look} look={look} className={`${look}-row`} data-testid={look}>
            <RowLine>
              <RowName mono={look === "ruled"}>{look}</RowName>
              <RowValue>value</RowValue>
            </RowLine>
          </Row>
        ))}
      </>,
    );
    for (const look of LOOKS) {
      const row = screen.getByTestId(look);
      expect([row.getAttribute("data-row"), row.className]).toEqual([look, `${look}-row`]);
    }
    expect(screen.getByTestId("ruled").querySelector("[data-row-name]")?.hasAttribute("data-mono")).toBe(true);
    expect(screen.getByTestId("pair").querySelector("[data-row-name]")?.hasAttribute("data-mono")).toBe(false);
  });

  it("passes axe in every look, with and without a glyph", async () => {
    const screen = renderInSurface(
      <ul aria-label="Props">
        {LOOKS.map((look) => (
          <Row key={look} as="li" look={look} glyph={look === "inset" ? <Glyph /> : undefined}>
            <RowLine>
              <RowName code="size">Size</RowName>
              <RowValue>"md"</RowValue>
              <RowAction>
                <Switch label={`${look} on`} checked onCheckedChange={() => {}} />
              </RowAction>
            </RowLine>
          </Row>
        ))}
      </ul>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Row's CSS", () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its type, space and colours from the tokens", () => {
    expect(body).not.toMatch(/(^|[\s>+~,(])\.[a-z]/im);
    expect(body).not.toMatch(/aria-|role=/);
    expect(body).not.toMatch(/font(-size)?: *\d|#[0-9a-f]{3,8}\b|rgba?\(|border-radius|letter-spacing: *-|(padding|gap)[a-z-]*: *[^;]*\b\d+px/i);
    for (const step of ["title", "mono", "mono-small"]) expect(body).toContain(`var(--font-${step})`);
    expect(body).toContain("letter-spacing: var(--tracking-title)");
    for (const look of LOOKS.filter((look) => look !== "inset")) expect(body).toContain(`[data-row="${look}"]`);
  });

  it("runs an item edge to edge in a list card, its text 14px in, what is under its line 2px apart", () => {
    expect(body).toMatch(/\[data-row="item"\] \{ --row-gap: var\(--space-hair\); padding: var\(--space-inset\) var\(--space-gutter\); \}/);
  });

  it("keeps the glyph column a fixed 20px, so the names line up across rows", () => {
    expect(body).toMatch(/\[data-row\]\[data-glyphed\] \{[^}]*grid-template-columns: 20px minmax\(0, 1fr\)/);
    expect(body).toMatch(/\[data-row-glyph\] \{[^}]*height: var\(--row-line\)/);
    expect(body).toMatch(/\[data-row-line\] \{[^}]*min-height: var\(--row-line\)/);
  });

  it("sizes the value from its own width, so one that doesn't fit beside the name takes a line of its own", () => {
    expect(body).toMatch(/\[data-row-value\] \{[^}]*flex: 1 1 auto/);
  });

  it("draws its hairline as a border, which forced colours keep", () => {
    expect(body).toMatch(/\[data-row="ruled"\], \[data-row="pair"\], \[data-row="item"\] \{ border-top: 1px solid var\(--rule\); \}/);
    expect(body).not.toMatch(/box-shadow/);
  });
});
