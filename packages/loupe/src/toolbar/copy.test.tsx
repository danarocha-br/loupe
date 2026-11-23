// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./project-server.js", () => ({
  readProjectContext: async () => ({ repo: "orbix-ai", commit: "abcdef1234567", dirty: false, playgroundVersion: "0.0.3", install: { app: "apps/app", layer: "packages/loupe" } }),
}));
vi.mock("./notices.js", () => ({
  useLayerStatus: () => null,
  staleComponents: () => new Set(),
  notGeneratedComponents: () => [],
  LayerNotices: () => null,
  NotGeneratedNotice: () => null,
  layerAnnouncement: () => ({ alert: "", status: "" }),
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
/** The popover over the footer: the details to copy with, or why a copy failed. */
const popover = () => shadow().querySelector<HTMLElement>(".copy-popover");
const toast = () => shadow().querySelector<HTMLElement>(".copy-toast");
/** What a screen reader hears: the status region the flow keeps mounted. */
const announced = () => shadow().querySelector("[data-testid=copy-status]")?.textContent ?? "";
const button = (text: string, scope: ParentNode = shadow()) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === text);
const field = <T extends HTMLInputElement | HTMLTextAreaElement>(selector: string) => popover()?.querySelector<T>(selector) as T;
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
  await until(() => (field<HTMLInputElement>('input[name="title"]')?.value ?? "") !== "");
}

/** A change, so there is something to copy. */
async function change(): Promise<void> {
  act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
  await settle();
}

beforeEach(async () => {
  resetLoupe();
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
    // The region was there, empty, before the copy: what lands in it is announced.
    expect(announced()).toBe("Copied “Button variant in MemberRow”. Paste it into your coding agent.");
    expect(popover()).toBeNull();
  });

  it("opens the details from the chevron, prefilled and focused, and copies with them", async () => {
    await change();
    const records = registry().store.records();
    await openDetails();
    expect(more().getAttribute("aria-expanded")).toBe("true");
    expect(popover()?.getAttribute("role")).toBe("dialog");
    const title = field<HTMLInputElement>('input[name="title"]');
    expect(title.value).toBe("Button variant in MemberRow");
    expect(shadow().activeElement).toBe(title);
    expect(field<HTMLInputElement>('input[name="designer"]').placeholder).toBe("Who is asking for this?");

    type(title, "Calmer rows");
    type(field('input[name="designer"]'), "Dana");
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
    expect(field<HTMLInputElement>('input[name="title"]').value).toBe("Calmer rows");
    expect(field<HTMLInputElement>('input[name="designer"]').value).toBe("Dana");
  });

  it("holds the details' copy back while the title is empty, and says so under the field", async () => {
    await change();
    await openDetails();
    const submit = button("Copy with these details");
    const title = field<HTMLInputElement>('input[name="title"]');
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
    type(title, "Calmer rows");
    expect(title.hasAttribute("aria-invalid")).toBe(false);
    expect(popover()?.querySelector(".field-error")).toBeNull();
  });

  it("closes the details on a press outside, leaving focus where the press put it", async () => {
    await change();
    await openDetails();
    act(() => {
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
    });
    expect(popover()).toBeNull();
    expect(shadow().activeElement).toBeNull();
    // A press on the split button is the chevron's own: it doesn't count as outside.
    await openDetails();
    act(() => {
      more().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
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
    expect(popover()?.querySelector('[role="alert"]')?.textContent).toBe("The project server didn’t answer.");
    expect(popover()?.querySelector("textarea")).toBeNull();
    expect(button("Select all")).toBeUndefined();
    expect(button("Try again")).toBeDefined();
  });

  it("closes the details on Escape and on the chevron again, copying nothing", async () => {
    await change();
    await openDetails();
    act(() => {
      // Composed, as a browser's key events are: it reaches the window the popover listens on.
      field('input[name="title"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
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
    await until(() => popover() !== null && popover()?.querySelector("textarea")?.value !== "");

    expect(copy().textContent).toBe("Not copied");
    expect(shadow().querySelector(".split")?.getAttribute("data-state")).toBe("failed");
    // From the button, the caret points at the button; from the details, at the chevron.
    expect(popover()?.getAttribute("data-anchor")).toBe("copy");
    expect(popover()?.querySelector("h3")?.textContent).toBe("Couldn’t copy automatically");
    expect(popover()?.querySelector('[role="alert"]')?.textContent).toBe("Write permission denied. Your Proposal is below.");
    const text = popover()?.querySelector("textarea") as HTMLTextAreaElement;
    expect(text.readOnly).toBe(true);
    expect(text.value.startsWith("# Button variant in MemberRow\n")).toBe(true);
    expect(String(info.mock.calls[0]?.[0])).toMatch(/^\[loupe\] Proposal:\n\n# Button variant in MemberRow\n/);

    // Escape closes the popover alone: whatever is selected stays selected.
    act(() => (button("Try again") as HTMLButtonElement).focus());
    act(() => {
      (button("Try again") as HTMLButtonElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    });
    expect(popover()).toBeNull();
    act(() => copy().click());
    await until(() => popover() !== null && popover()?.querySelector("textarea")?.value !== "");
    act(() => button("Select all")?.click());
    const again = popover()?.querySelector("textarea") as HTMLTextAreaElement;
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
    await until(() => popover()?.querySelector("h3") !== null && popover()?.querySelector("h3") !== undefined);

    expect(popover()?.getAttribute("data-anchor")).toBe("details");
    expect(popover()?.querySelector('[role="alert"]')?.textContent).toBe(`${BLOCKED} Your Proposal is below.`);
    // A failed copy from the details leaves the button as it was: the popover says what happened.
    expect(copy().textContent).toBe("Copy Proposal");
  });
});
