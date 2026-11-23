// @vitest-environment jsdom
// Field, by role, inside a real shadow root (ADR 0003): a text control named by its
// label, described by its hint and its error, marked invalid while there is one, that
// asks the caller for each new value; a line, or a box of lines, or a read-only well.

import { userEvent } from "@testing-library/user-event";
import { act, createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLESHEET } from "../../surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { listen } from "../announcer/announcer.fixture.js";
import { Field, type FieldProps } from "./field.js";
import CSS from "./field.css?inline";

afterEach(cleanup);

const setup = () => userEvent.setup({ document });

/** The ids an element's `aria-describedby` names, read as the text they hold. */
function description(element: Element): string {
  const root = element.getRootNode() as ShadowRoot;
  return (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => root.getElementById(id)?.textContent ?? "")
    .join(" ");
}

/** FieldProps less its value, for either element. */
type Unkept = FieldProps extends infer Each ? (Each extends unknown ? Omit<Each, "value"> : never) : never;

/** A field that keeps its own value, as a view does. */
function Kept({ initial = "", onValueChange, ...props }: Unkept & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Field
      {...(props as FieldProps)}
      value={value}
      onValueChange={(next) => {
        onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("Field", () => {
  it("is a text box named by its label, and a press on the label focuses it", async () => {
    const user = setup();
    const screen = renderInSurface(<Kept label="Title" name="title" />);
    const box = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    expect(box.tagName).toBe("INPUT");
    expect(box.name).toBe("title");
    await user.click(screen.getByText("Title"));
    expect(screen.shadow.activeElement).toBe(box);
  });

  it("asks the caller for each value it's typed, and shows what the caller passes", async () => {
    const user = setup();
    const asked = vi.fn();
    const screen = renderInSurface(<Kept label="Designer" onValueChange={asked} />);
    const box = screen.getByRole("textbox", { name: "Designer" }) as HTMLInputElement;
    await user.type(box, "Dana");
    expect(box.value).toBe("Dana");
    expect(asked).toHaveBeenLastCalledWith("Dana");
    // The caller keeps it: a field whose caller passes nothing new is back as it was on the
    // caller's next render. (UI SDK shows what was typed until then; React's own input reverts at once.)
    const held = renderInSurface(<Field label="Held" value="as passed" onValueChange={() => {}} />);
    const fixed = held.getByRole("textbox", { name: "Held" }) as HTMLInputElement;
    await user.type(fixed, "x");
    held.rerender(<Field label="Held" value="as passed" onValueChange={() => {}} />);
    expect(fixed.value).toBe("as passed");
  });

  it("says the optional marker as part of its name, and its hint as its description", () => {
    const screen = renderInSurface(<Kept label="Designer" optional="optional" hint="Who is asking for this?" />);
    const box = screen.getByRole("textbox", { name: "Designer optional" });
    expect(description(box)).toBe("Who is asking for this?");
  });

  it("marks itself invalid and is described by its error while it has one, and drops both once it hasn't", () => {
    const screen = renderInSurface(<Field label="Title" value="" required error="Give it a title." />);
    const box = screen.getByRole("textbox", { name: "Title" });
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect((box as HTMLInputElement).required).toBe(true);
    expect(description(box)).toBe("Give it a title.");
    screen.rerender(<Field label="Title" value="Calmer rows" required />);
    expect(box.hasAttribute("aria-invalid")).toBe(false);
    expect(description(box)).toBe("");
    expect(screen.queryByText("Give it a title.")).toBeNull();
  });

  it("announces nothing itself, and puts no live region in the host's document, as an error comes and changes", async () => {
    const screen = renderInSurface(<Field label="Title" value="" required />);
    const heard = listen(screen.shadow);
    const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    // UI SDK's field stays quiet for a tick after it mounts.
    await tick();
    screen.rerender(<Field label="Title" value="" required error="Give it a title." />);
    screen.rerender(<Field label="Title" value="" required error="Give it a shorter title." />);
    // UI SDK's FieldError would announce, after a tick, into a region on the host's body.
    await tick();
    expect(document.body.querySelectorAll("[aria-live], [data-ui-sdk-announcer]")).toHaveLength(0);
    expect(heard.polite).toEqual([]);
    expect(heard.assertive).toEqual([]);
  });

  it("keeps a hidden label as the control's name", () => {
    const screen = renderInSurface(<Kept label="children" labelHidden />);
    const box = screen.getByRole("textbox", { name: "children" });
    expect(screen.getByText("children").classList.contains("sr-only")).toBe(true);
    expect(box).toBeDefined();
  });

  it("is a textarea when it's multiline, passing the caller's keys and focus handlers through", async () => {
    const user = setup();
    const blurred = vi.fn();
    const screen = renderInSurface(
      <Kept
        label="children"
        multiline
        autoResize
        rows={1}
        onBlur={blurred}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />,
    );
    const box = screen.getByRole("textbox", { name: "children" }) as HTMLTextAreaElement;
    expect(box.tagName).toBe("TEXTAREA");
    await user.type(box, "Save{Enter}changes");
    expect(box.value).toBe("Savechanges");
    await user.tab();
    expect(blurred).toHaveBeenCalledTimes(1);
  });

  it("holds a read-only text to select and copy by hand", async () => {
    const user = setup();
    const ref = createRef<HTMLTextAreaElement>();
    const screen = renderInSurface(<Field label="The Proposal" labelHidden look="well" multiline readOnly ref={ref} value={"# A title\n\nThe text."} />);
    const box = screen.getByRole("textbox", { name: "The Proposal" }) as HTMLTextAreaElement;
    expect(ref.current).toBe(box);
    expect(box.readOnly).toBe(true);
    await user.type(box, "more");
    expect(box.value).toBe("# A title\n\nThe text.");
    box.select();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, box.value.length]);
  });

  it("draws its look as an attribute, filled by default", () => {
    const screen = renderInSurface(
      <>
        <Field label="Filled" value="" />
        <Field label="Outline" look="outline" multiline value="" />
      </>,
    );
    const look = (name: string) => screen.getByRole("textbox", { name }).closest("[data-field]")?.getAttribute("data-look");
    expect(look("Filled")).toBe("filled");
    expect(look("Outline")).toBe("outline");
  });

  it("leaves Escape to the app", async () => {
    const user = setup();
    const heard: KeyboardEvent[] = [];
    const listen = (event: KeyboardEvent) => heard.push(event);
    window.addEventListener("keydown", listen);
    try {
      const screen = renderInSurface(<Kept label="Title" />);
      screen.getByRole("textbox", { name: "Title" }).focus();
      await user.keyboard("{Escape}");
      expect(heard.map((event) => [event.key, event.defaultPrevented])).toEqual([["Escape", false]]);
    } finally {
      window.removeEventListener("keydown", listen);
    }
  });

  it("passes axe: labelled, hinted, invalid, hidden-labelled and read-only", async () => {
    const screen = renderInSurface(
      <>
        <Kept label="Designer" optional="optional" placeholder="Who is asking for this?" />
        <Field label="Title" value="" required error="Give it a title." />
        <Kept label="children" labelHidden look="outline" multiline hint="One line." />
        <Field label="The Proposal" labelHidden look="well" multiline readOnly value="# A title" />
      </>,
    );
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("Field's CSS", () => {
  it("sits in the primitives layer of the stylesheet the surface adopts", () => {
    const at = STYLESHEET.indexOf(CSS);
    expect(at).toBeGreaterThan(STYLESHEET.indexOf("@layer primitives {"));
    expect(at).toBeLessThan(STYLESHEET.indexOf("@layer patterns"));
  });

  it("names states, not Loupe's classes or ARIA, and takes its values from the tokens", () => {
    const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .map((chunk) => chunk.split("}").pop()?.trim() ?? "")
      .filter((selector) => selector && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(10);
    for (const selector of selectors) {
      expect(selector, selector).not.toMatch(/(^|[\s>+~,(])\.[a-z]/i);
      expect(selector, selector).not.toMatch(/aria-/);
    }
    expect(CSS).not.toMatch(/font: *\d|font-size: *\d/);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CSS).not.toMatch(/\d+ms|999px|border-radius: *\d/);
    expect(CSS).not.toMatch(/(gap|padding)[^;]*\b(4|6|8|10|12|16)px/);
    for (const step of ["label", "body", "caption", "proposal-text"]) expect(CSS).toContain(`var(--font-${step})`);
  });

  it("keeps an outline forced colours draw wherever focus is a ring of box-shadows", () => {
    const focus = [...CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+):focus(?:-visible)?\s*\{([^}]*)\}/g)];
    const looks = focus.filter(([, selector]) => /data-look/.test(selector as string));
    expect(looks.map(([, selector]) => (selector as string).trim().match(/data-look="(\w+)"/)?.[1])).toEqual(["filled", "outline", "well"]);
    for (const [, selector, body] of looks) {
      expect(body, selector).toMatch(/box-shadow:/);
      expect(body, selector).toMatch(/outline: 2px solid transparent/);
    }
  });
});
