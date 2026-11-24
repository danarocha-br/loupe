// @vitest-environment jsdom
// Copy Proposal's parts, by role, inside a real shadow root (ADR 0003): the split button
// in each state, the details' form, a refused copy's body, and the toast. Each draws and
// calls back; the copy, its state and its timers are the view's (copy.test.tsx).

import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPY_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { expectPatternCss } from "../css.fixture.js";
import { COPIED_TITLE, REFUSED } from "../samples.js";
import { CopySplit, type CopySplitProps, CopyToast, DetailsForm, type DetailsFormProps, NotCopied } from "./copy-flow.js";
import CSS from "./copy-flow.css?inline";

afterEach(cleanup);

function split(props: Partial<CopySplitProps> = {}) {
  const calls = { onCopy: vi.fn(), onDetails: vi.fn() };
  const screen = renderInSurface(<CopySplit state="idle" busy={false} disabled={false} expanded={false} words={COPY_WORDS} {...calls} {...props} />);
  return { screen, ...calls };
}

describe("CopySplit", () => {
  it("copies from its main half, and opens the details from its chevron", async () => {
    const user = userEvent.setup({ document });
    const { screen, onCopy, onDetails } = split();
    const main = screen.getByRole("button", { name: "Copy Proposal" });
    expect(main.getAttribute("title")).toBe(COPY_WORDS.mainTitle);
    await user.click(main);
    expect(onCopy).toHaveBeenCalledTimes(1);
    const chevron = screen.getByRole("button", { name: "Copy with details" });
    expect(chevron.getAttribute("aria-haspopup")).toBe("dialog");
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
    await user.click(chevron);
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("says each state on its main half, and what stands open on its chevron", () => {
    const { screen } = split({ state: "copied", expanded: true });
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy with details" }).getAttribute("aria-expanded")).toBe("true");
    screen.rerender(<CopySplit state="failed" busy={false} disabled={false} expanded={false} words={COPY_WORDS} onCopy={() => {}} onDetails={() => {}} />);
    expect(screen.getByRole("button", { name: "Not copied" })).toBeTruthy();
    expect(screen.shadow.querySelector("[data-copy-split]")?.getAttribute("data-state")).toBe("failed");
  });

  it("turns both halves off with nothing to copy, and says a copy out on the split", () => {
    const { screen } = split({ disabled: true, busy: true });
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.shadow.querySelector("[data-copy-split]")?.getAttribute("aria-busy")).toBe("true");
  });

  it("has no axe violations in any state", async () => {
    for (const state of ["idle", "copied", "failed"] as const) {
      const { screen } = split({ state });
      expect(await axeViolations(screen.host)).toEqual([]);
      cleanup();
    }
  });
});

function form(props: Partial<DetailsFormProps> = {}) {
  const calls = { onTitle: vi.fn(), onDesigner: vi.fn(), onSubmit: vi.fn() };
  const screen = renderInSurface(<DetailsForm title={COPIED_TITLE} designer="" missing={false} busy={false} words={COPY_WORDS} {...calls} {...props} />);
  return { screen, ...calls };
}

describe("DetailsForm", () => {
  it("asks for a title and an optional designer, and hands each edit back", async () => {
    const user = userEvent.setup({ document });
    const { screen, onTitle, onDesigner } = form();
    const title = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    expect(title.value).toBe(COPIED_TITLE);
    expect(title.required).toBe(true);
    const designer = screen.getByRole("textbox", { name: "Designer optional" }) as HTMLInputElement;
    expect(designer.placeholder).toBe(COPY_WORDS.designerHint);
    await user.type(designer, "D");
    expect(onDesigner).toHaveBeenLastCalledWith("D");
    await user.type(title, "!");
    expect(onTitle).toHaveBeenLastCalledWith(`${COPIED_TITLE}!`);
  });

  it("submits from its button or Enter, without leaving the page", async () => {
    const user = userEvent.setup({ document });
    const { screen, onSubmit } = form();
    await user.click(screen.getByRole("button", { name: "Copy with these details" }));
    await user.type(screen.getByRole("textbox", { name: "Title" }), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("says a missing title under its field, and describes the field with it", async () => {
    const { screen } = form({ title: "", missing: true });
    const title = screen.getByRole("textbox", { name: "Title" });
    expect(screen.getByText(COPY_WORDS.titleMissing).hasAttribute("data-field-error")).toBe(true);
    expect(await axeViolations(screen.host)).toEqual([]);
    expect(title.getAttribute("aria-invalid")).toBe("true");
  });

  it("has no axe violations", async () => {
    const { screen } = form({ busy: true });
    expect(screen.getByRole("button", { name: "Copy with these details" }).getAttribute("aria-disabled")).toBe("true");
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("NotCopied", () => {
  const said = COPY_WORDS.notCopiedText(REFUSED.reason, true);

  it("says why under its heading, holds the Proposal to copy by hand, and selects it all", async () => {
    const user = userEvent.setup({ document });
    const onRetry = vi.fn();
    const screen = renderInSurface(<NotCopied said={said} text={REFUSED.text} busy={false} words={COPY_WORDS} onRetry={onRetry} />);
    expect(screen.getByRole("heading", { level: 3, name: COPY_WORDS.notCopied })).toBeTruthy();
    expect(screen.getByText(said).tagName).toBe("P");
    const text = screen.getByRole("textbox", { name: "The Proposal" }) as HTMLTextAreaElement;
    expect(text.readOnly).toBe(true);
    expect(text.value).toBe(REFUSED.text);
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.shadow.activeElement).toBe(text);
    expect([text.selectionStart, text.selectionEnd]).toEqual([0, REFUSED.text.length]);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await axeViolations(screen.host)).toEqual([]);
  });

  it("offers only another try when the Proposal wasn't built", async () => {
    const screen = renderInSurface(<NotCopied said={REFUSED.reason} text="" busy words={COPY_WORDS} onRetry={() => {}} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Try again"]);
    expect(screen.getByRole("button", { name: "Try again" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.shadow.querySelector("[data-copy-actions]")?.hasAttribute("data-alone")).toBe(true);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("CopyToast", () => {
  it("shows what went, the title isolated, and stays out of the accessibility tree", async () => {
    const screen = renderInSurface(<CopyToast title={COPIED_TITLE} words={COPY_WORDS} />);
    const toast = screen.shadow.querySelector("[data-copy-toast]") as HTMLElement;
    expect(toast.getAttribute("aria-hidden")).toBe("true");
    expect(toast.querySelector("[data-toast-line]")?.textContent).toBe(`Copied “${COPIED_TITLE}”`);
    expect(toast.querySelector("bdi")?.textContent).toBe(COPIED_TITLE);
    expect(toast.querySelector("[data-toast-sub]")?.textContent).toBe(COPY_WORDS.pasteIt);
    expect(await axeViolations(screen.host)).toEqual([]);
  });

  it("says in words what the toast shows, for the announcer", () => {
    expect(COPY_WORDS.copiedText(COPIED_TITLE)).toBe(`Copied “${COPIED_TITLE}”. ${COPY_WORDS.pasteIt}.`);
  });
});

describe("Copy Proposal's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toContain("@keyframes loupe-toast-in");
  });
});
