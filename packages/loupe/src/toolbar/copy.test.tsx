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
import { TITLE_MISSING } from "./copy-dialog.js";

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
const dialog = () => shadow().querySelector<HTMLDialogElement>("dialog");
const button = (text: string, scope: ParentNode = shadow()) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === text);
const field = <T extends HTMLInputElement | HTMLTextAreaElement>(selector: string) => dialog()?.querySelector<T>(selector) as T;

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

async function openDialog(): Promise<void> {
  act(() => shadow().querySelector<HTMLButtonElement>("[data-copy]")?.click());
  // Open once the preview has counted: the counts' live region is there from the start, empty.
  await until(() => (dialog()?.querySelector(".counts")?.textContent ?? "") !== "");
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

describe("the Copy Proposal dialog", () => {
  it("opens from the footer, prefilled with a title, and counts what the text will hold", async () => {
    expect(button("Copy Proposal")?.disabled).toBe(true);
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    await openDialog();

    expect(dialog()?.open).toBe(true);
    expect(dialog()?.getAttribute("aria-labelledby")).toBe("loupe-copy-title");
    // Only the sections scroll: Cancel and Copy stay in view at any height or zoom (layout review 2026-11-20).
    expect(dialog()?.querySelector(".body .sec")).not.toBeNull();
    expect(dialog()?.querySelector(".body .actions")).toBeNull();
    expect(dialog()?.querySelector("form > .actions")).not.toBeNull();
    expect(field<HTMLInputElement>('input[name="title"]').value).toBe("Button variant in MemberRow");
    expect(dialog()?.querySelector(".counts")?.textContent).toBe("1 change · 0 held for review");
    expect([...(dialog()?.querySelectorAll("[data-entry]") ?? [])].map((entry) => entry.querySelector("span")?.textContent)).toEqual([
      "1variant on 1st of 1 <Button> in MemberRow, every Instance",
    ]);
    // The delta names itself "Change 1": no second "Change" in the field's name.
    expect(dialog()?.querySelector("[data-entry] .key")?.getAttribute("aria-label")).toBe("Change 1");
    // The alert region is there, empty, until something fails.
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe("");
  });

  it("holds Copy back while the title is empty, and says so under the field", async () => {
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    await openDialog();
    expect(dialog()?.querySelector("h2")?.textContent).toBe("Copy Proposal");
    const submit = button("Copy", dialog() as HTMLDialogElement);
    const title = field<HTMLInputElement>('input[name="title"]');
    type(title, "   ");
    // Never disabled with no reason given (review 2026-11-20): pressed, it says what is missing.
    expect(submit?.disabled).toBe(false);
    act(() => submit?.click());
    await settle();
    expect(copies).toEqual([]);
    expect(dialog()?.open).toBe(true);
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(dialog()?.querySelector(`#${title.getAttribute("aria-describedby")}`)?.textContent).toBe(TITLE_MISSING);
    expect(shadow().activeElement).toBe(title);
    type(title, "Calmer rows");
    expect(title.hasAttribute("aria-invalid")).toBe(false);
    expect(dialog()?.querySelector(".field-error")).toBeNull();
  });

  it("copies one text with the rules, the title, designer and notes, and clears nothing", async () => {
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    const records = registry().store.records();
    await openDialog();
    type(field('input[name="title"]'), "Calmer rows");
    type(field('input[name="designer"]'), "Dana");
    type(field('[data-entry="c1"] textarea'), "Ghost reads as disabled on the dark theme.");
    // As in a browser: while a modal dialog is open, nothing outside it takes focus.
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement) {
      if (dialog()?.open && !dialog()?.contains(this)) return;
      focus.call(this);
    });
    act(() => button("Copy", dialog() as HTMLDialogElement)?.click());
    await until(() => dialog() === null);

    expect(copies).toHaveLength(1);
    const text = copies[0] ?? "";
    expect(text.startsWith("# Calmer rows\norbix-ai@abcdef1 · by Dana\n")).toBe(true);
    expect(text).toContain("`pnpm -C apps/app exec loupe locate` with this whole Proposal");
    expect(text).toContain('Note: "Ghost reads as disabled on the dark theme."');
    const proposal = copiedProposal();
    expect(proposal).toMatchObject({ formatVersion: 2, title: "Calmer rows", designer: "Dana" });
    const [route] = proposal.routes;
    expect(route?.changes[0]).toMatchObject({ action: "apply", note: "Ghost reads as disabled on the dark theme." });

    expect(dialog()).toBeNull();
    expect(button("Copied")).toBeDefined();
    // Focus goes back to what opened the dialog.
    expect(shadow().activeElement).toBe(shadow().querySelector("[data-copy]"));
    expect(registry().store.records()).toEqual(records);

    // The next copy starts from what was typed.
    await settle();
    await openDialog();
    expect(field<HTMLInputElement>('input[name="title"]').value).toBe("Calmer rows");
    expect(field<HTMLInputElement>('input[name="designer"]').value).toBe("Dana");
    expect(field<HTMLTextAreaElement>('[data-entry="c1"] textarea').value).toBe("Ghost reads as disabled on the dark theme.");
  });

  it("closes on Cancel and on Escape, copying nothing", async () => {
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    await openDialog();
    act(() => button("Cancel", dialog() as HTMLDialogElement)?.click());
    expect(dialog()).toBeNull();
    await openDialog();
    act(() => {
      field('input[name="title"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(copies).toEqual([]);
  });

  it("copies under the suggested title and keeps following it while the designer leaves it alone", async () => {
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    await openDialog();
    act(() => button("Copy", dialog() as HTMLDialogElement)?.click());
    await until(() => dialog() === null);
    expect(copiedProposal().title).toBe("Button variant in MemberRow");
    expect(copyForm().title).toBeNull();
  });

  it("keeps the dialog open and says why when the browser refuses the clipboard, with the text in the console", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("Write permission denied.")) },
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    await openDialog();
    act(() => button("Copy", dialog() as HTMLDialogElement)?.click());
    await until(() => (dialog()?.querySelector('[role="alert"]')?.textContent ?? "") !== "");
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe("Write permission denied. The Proposal is in the console.");
    expect(String(info.mock.calls[0]?.[0])).toMatch(/^\[loupe\] Proposal:\n\n# Button variant in MemberRow\n/);
  });
});
