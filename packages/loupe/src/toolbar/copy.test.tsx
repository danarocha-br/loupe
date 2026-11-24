// @vitest-environment jsdom
import { within } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteHint, callSiteId, instanceId, SOURCE_ATTRIBUTE } from "../call-site.js";
import { devMount } from "../mount.js";
import { readProposal } from "../locate/input.js";
import type { Proposal } from "../proposal/types.js";
import { createAdapter } from "../runtime/adapter.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";
import { resetLoupe } from "../runtime/slot.js";
import { BLOCKED } from "./copy.js";
import { TITLE_MISSING } from "./copy-flow.js";
import { type Heard, listen } from "./ui/announcer/announcer.fixture.js";
import { OPEN_KEY } from "./launcher-place.js";
import { loadPanel } from "./start.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./project-server.js", () => ({
  readProjectContext: async () => ({ repo: "orbix-ai", commit: "abcdef1234567", dirty: false, playgroundVersion: "0.0.3", install: { app: "apps/app", layer: "packages/loupe" } }),
}));
vi.mock("./notices.js", () => ({
  useLayerStatus: () => null,
  staleComponents: () => new Set(),
  notGeneratedComponents: () => [],
}));

const { default: Toolbar } = await import("./index.js");
const { copyForm } = await import("./copy.js");
const { HOST_ATTRIBUTE } = await import("./styles.js");

const Button = createAdapter("Button", (props: { variant?: string; children?: string }) => (
  <button type="button" data-variant={props.variant}>
    {props.children}
  </button>
));
const ROW_KEY = { path: "app/members.tsx", enclosing: "MemberRow", component: "Button", ordinal: 1 };
const ROW = callSiteId(ROW_KEY);
const ROW_HINT = callSiteHint(ROW_KEY, { line: 12, column: 9, total: 1 });
const writes = JSON.stringify({ attributes: [{ name: "variant", writtenAs: "literal" }], spreads: false, children: "text" });

function Page() {
  return (
    <main>
      {["ana", "bia"].map((member) => (
        <Button key={member} {...({ [ANCHOR_ATTRIBUTE]: ROW, [SOURCE_ATTRIBUTE]: ROW_HINT, "data-ds-writes": writes } as object)} variant="ghost">
          {member}
        </Button>
      ))}
    </main>
  );
}

const LoupeMount = devMount(Toolbar);
let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
/** Every text put on the clipboard. */
let copies: string[] = [];

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
/** Settles until `done` holds: building a Proposal takes longer on a loaded machine. */
async function until(done: () => boolean, tries = 100): Promise<void> {
  for (let i = 0; i < tries && !done(); i++) await settle();
  expect(done()).toBe(true);
}
const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
/** The toolbar's shadow root, queried by role. */
const screen = () => within(shadow() as unknown as HTMLElement);
/** The popover over the footer: the details to copy with, or why a copy failed. */
const popover = () => screen().queryByRole("dialog");
const toast = () => shadow().querySelector<HTMLElement>(".copy-toast");
/** What a screen reader hears from the toolbar's announcer, since the toolbar mounted. */
let heard: Heard;
/** The copies the announcer said, apart from the count's changes. */
const copied = () => heard.polite.filter((said) => said.startsWith("Copied"));
const button = (text: string, scope: ParentNode = shadow()) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === text);
/** A text box in the popover, by name: "Title", "Designer optional", "The Proposal". */
const field = <T extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement>(name: string) => {
  const open = popover();
  return (open ? within(open).queryByRole("textbox", { name }) : null) as T;
};
/** The split button's two halves: Copy Proposal, and the chevron that opens the details. */
const copy = () => shadow().querySelector<HTMLButtonElement>("[data-copy]") as HTMLButtonElement;
const more = () => shadow().querySelector<HTMLButtonElement>("[data-copy-details]") as HTMLButtonElement;

/** Types into a controlled field the way React hears it. */
function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
  act(() => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The Proposal in the last copied text, read back the way `loupe locate` reads it. */
function copiedProposal(): Proposal {
  const text = copies.at(-1);
  if (text === undefined) throw new Error("nothing was copied");
  const proposal = readProposal(text);
  if (typeof proposal === "string") throw new Error(proposal);
  return proposal;
}

/** Opens the details popover, once its title is prefilled from the suggestion. */
async function openDetails(): Promise<void> {
  act(() => more().click());
  await until(() => (field("Title")?.value ?? "") !== "");
}

/** A change, so there is something to copy. */
async function change(): Promise<void> {
  act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
  await settle();
}

// The open panel's module, loaded before the first test, so that one opens in the click as the rest do.
beforeAll(async () => {
  await loadPanel();
});

beforeEach(async () => {
  resetLoupe();
  // These read the open panel: it was left open in this browser.
  localStorage.setItem(OPEN_KEY, "open");
  copies = [];
  // jsdom has no clipboard: the one a browser on localhost gives, as far as text goes.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void copies.push(text) },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = debugOf();
  act(() =>
    root.render(
      <>
        <Page />
        <LoupeMount />
      </>,
    ),
  );
  await settle();
  await settle();
  heard = listen(shadow());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

describe("Copy Proposal (Copy flow v2 · A: a split button and a small popover)", () => {
  it("copies in one click under the suggested title, then says so on the button and in a toast", async () => {
    expect(copy().disabled).toBe(true);
    expect(more().disabled).toBe(true);
    await change();
    act(() => copy().click());
    await until(() => copies.length === 1);
    await settle();

    expect(copiedProposal().title).toBe("Button variant in MemberRow");
    expect(copyForm().title).toBeNull();
    expect(copy().textContent).toBe("Copied");
    expect(shadow().querySelector(".split")?.getAttribute("data-state")).toBe("copied");
    expect(toast()?.textContent).toBe("Copied “Button variant in MemberRow”Paste it into your coding agent");
    // The toast is for the eye: the announcer says it, once.
    // The footer's count may have been said before it ("1 change"): the copy is said once.
    await until(() => copied().length > 0);
    expect(copied()).toEqual(["Copied “Button variant in MemberRow”. Paste it into your coding agent."]);
    expect(heard.assertive).toEqual([]);
    expect(popover()).toBeNull();
  });

  it("announces each copy once, two of the same title in a row included", async () => {
    await change();
    act(() => copy().click());
    await until(() => copies.length === 1 && copied().length === 1);
    act(() => copy().click());
    await until(() => copies.length === 2 && copied().length === 2);
    await settle();
    await settle();
    const said = "Copied “Button variant in MemberRow”. Paste it into your coding agent.";
    expect(copied()).toEqual([said, said]);
  });

  it("opens the details from the chevron, prefilled and focused, and copies with them", async () => {
    await change();
    const records = registry().store.records();
    await openDetails();
    expect(more().getAttribute("aria-expanded")).toBe("true");
    expect(popover()).toBe(screen().getByRole("dialog", { name: "Copy with details" }));
    const title = field("Title");
    expect(title.value).toBe("Button variant in MemberRow");
    expect(shadow().activeElement).toBe(title);
    expect(field("Designer optional").placeholder).toBe("Who is asking for this?");

    type(title, "Calmer rows");
    type(field("Designer optional"), "Dana");
    act(() => button("Copy with these details")?.click());
    await until(() => copies.length === 1);
    await settle();

    const text = copies[0] ?? "";
    expect(text.startsWith("# Calmer rows\norbix-ai@abcdef1 · by Dana\n")).toBe(true);
    expect(text).toContain("`pnpm -C apps/app exec loupe locate` with this whole Proposal");
    expect(copiedProposal()).toMatchObject({ formatVersion: 2, title: "Calmer rows", designer: "Dana" });
    expect(popover()).toBeNull();
    expect(toast()?.textContent).toContain("Copied “Calmer rows”");
    // Copying clears nothing, and the next copy starts from what was typed.
    expect(registry().store.records()).toEqual(records);
    expect(shadow().activeElement).toBe(more());
    await openDetails();
    expect(field("Title").value).toBe("Calmer rows");
    expect(field("Designer optional").value).toBe("Dana");
  });

  it("holds the details' copy back while the title is empty, and says so under the field", async () => {
    await change();
    await openDetails();
    const submit = button("Copy with these details");
    const title = field("Title");
    type(title, "   ");
    // Never disabled with no reason given (review 2026-11-20): pressed, it says what is missing.
    expect(submit?.disabled).toBe(false);
    act(() => submit?.click());
    await settle();
    expect(copies).toEqual([]);
    expect(popover()).not.toBeNull();
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(popover()?.querySelector(`#${title.getAttribute("aria-describedby")}`)?.textContent).toBe(TITLE_MISSING);
    expect(shadow().activeElement).toBe(title);
    // Focus was in the field already (Enter there, as far as focus goes): nothing moved to read it, so it is said.
    await until(() => heard.assertive.length === 1);
    expect(heard.assertive).toEqual([TITLE_MISSING]);
    type(title, "Calmer rows");
    expect(title.hasAttribute("aria-invalid")).toBe(false);
    expect(within(popover() as HTMLElement).queryByText(TITLE_MISSING)).toBeNull();
    // Empty, it says the same in the page: the browser's own bubble would sit outside Loupe.
    type(title, "");
    // Pressed from the button, focus moves to the field, whose description reads the error: not said twice.
    act(() => submit?.focus());
    act(() => submit?.click());
    await settle();
    await settle();
    expect(copies).toEqual([]);
    expect(shadow().activeElement).toBe(title);
    expect(within(popover() as HTMLElement).getByText(TITLE_MISSING)).toBeDefined();
    expect(heard.assertive).toEqual([TITLE_MISSING]);
    expect(heard.polite).not.toContain(TITLE_MISSING);
  });

  it("moves focus to an empty title only once its error describes it, from the button the first time", async () => {
    await change();
    await openDetails();
    const title = field("Title");
    type(title, "");
    const submit = button("Copy with these details") as HTMLButtonElement;
    // What a screen reader reads as focus lands: the field's description at that moment.
    let readOnFocus: string | null = null;
    title.addEventListener("focus", () => {
      const ids = title.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
      readOnFocus = ids.map((id) => shadow().getElementById(id)?.textContent ?? "").join(" ");
    });
    act(() => submit.focus());
    act(() => submit.click());
    await settle();
    await settle();
    expect(shadow().activeElement).toBe(title);
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(readOnFocus).toBe(TITLE_MISSING);
    // Focus moved and read it: the announcer says nothing more.
    expect(heard.assertive).toEqual([]);
  });

  it("leaves a press on the split button to the split: the chevron's own, or another copy", async () => {
    // A press anywhere else closes the popover: ui/popover's tests.
    await change();
    await openDetails();
    act(() => {
      more().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
      copy().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
    });
    expect(popover()).not.toBeNull();
  });

  it("says why, with no text to copy, when the Proposal itself couldn't be built", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const proposal = await import("./proposal.js");
    vi.spyOn(proposal, "collectProposal").mockRejectedValue(new Error("The project server didn’t answer."));
    await change();
    act(() => copy().click());
    await until(() => popover() !== null);
    expect(within(popover() as HTMLElement).getByText("The project server didn’t answer.")).toBeDefined();
    await until(() => heard.assertive.length > 0);
    expect(heard.assertive).toEqual(["The project server didn’t answer."]);
    expect(field("The Proposal")).toBeNull();
    expect(button("Select all")).toBeUndefined();
    expect(button("Try again")).toBeDefined();
  });

  it("closes the details on Escape and on the chevron again, copying nothing", async () => {
    await change();
    await openDetails();
    act(() => {
      // Composed, as a browser's key events are: it reaches the window the popover listens on.
      field("Title").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    });
    expect(popover()).toBeNull();
    expect(shadow().activeElement).toBe(more());
    await openDetails();
    act(() => more().click());
    expect(popover()).toBeNull();
    expect(more().getAttribute("aria-expanded")).toBe("false");
    expect(copies).toEqual([]);
  });

  it("says Not copied when the browser refuses the clipboard, shows the text, and tries again", async () => {
    let refuse = true;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => (refuse ? Promise.reject(new Error("Write permission denied.")) : void copies.push(text)) },
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await change();
    act(() => copy().click());
    await until(() => popover() !== null && field<HTMLTextAreaElement>("The Proposal")?.value !== "");

    expect(copy().textContent).toBe("Not copied");
    expect(shadow().querySelector(".split")?.getAttribute("data-state")).toBe("failed");
    // From the button, the caret sits under the popover's middle; from the details, near its end, at the chevron.
    expect(popover()?.getAttribute("data-caret")).toBe("center");
    expect(popover()).toBe(screen().getByRole("dialog", { name: "Couldn’t copy automatically" }));
    expect(shadow().activeElement).toBe(button("Try again"));
    expect(within(popover() as HTMLElement).getByRole("heading").textContent).toBe("Couldn’t copy automatically");
    // Shown in the popover, and said once by the announcer: focus on Try again says nothing of why.
    expect(within(popover() as HTMLElement).getByText("Write permission denied. Your Proposal is below.")).toBeDefined();
    await until(() => heard.assertive.length > 0);
    expect(heard.assertive).toEqual(["Write permission denied. Your Proposal is below."]);
    const text = field<HTMLTextAreaElement>("The Proposal");
    expect(text.readOnly).toBe(true);
    expect(text.value.startsWith("# Button variant in MemberRow\n")).toBe(true);
    expect(String(info.mock.calls[0]?.[0])).toMatch(/^\[loupe\] Proposal:\n\n# Button variant in MemberRow\n/);

    // Escape closes the popover alone: whatever is selected stays selected.
    act(() => (button("Try again") as HTMLButtonElement).focus());
    act(() => {
      (button("Try again") as HTMLButtonElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    });
    expect(popover()).toBeNull();
    // Focus goes back to the half the copy came from, not the chevron.
    expect(shadow().activeElement).toBe(copy());
    act(() => copy().click());
    await until(() => popover() !== null && field<HTMLTextAreaElement>("The Proposal")?.value !== "");
    act(() => button("Select all")?.click());
    const again = field<HTMLTextAreaElement>("The Proposal");
    expect([again.selectionStart, again.selectionEnd]).toEqual([0, again.value.length]);

    refuse = false;
    act(() => button("Try again")?.click());
    await until(() => copies.length === 1);
    await settle();
    expect(popover()).toBeNull();
    expect(copy().textContent).toBe("Copied");
  });

  it("names the secure origin when the page has no clipboard at all, pointing at the chevron from the details", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await change();
    await openDetails();
    act(() => button("Copy with these details")?.click());
    await until(() => popover() !== null && within(popover() as HTMLElement).queryByRole("heading") !== null);

    expect(popover()?.getAttribute("data-caret")).toBe("end");
    // The details closed and the refusal opened: focus is on its Try again, not back on the chevron.
    expect(shadow().activeElement).toBe(button("Try again"));
    expect(within(popover() as HTMLElement).getByText(`${BLOCKED} Your Proposal is below.`)).toBeDefined();
    await until(() => heard.assertive.length > 0);
    expect(heard.assertive).toEqual([`${BLOCKED} Your Proposal is below.`]);
    // A failed copy from the details leaves the button as it was: the popover says what happened.
    expect(copy().textContent).toBe("Copy Proposal");
  });
});
