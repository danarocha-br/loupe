// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { REPORT_DATA_ID } from "../proposal/report.js";
import type { Proposal } from "../proposal/types.js";
import { createAdapter } from "../runtime/adapter.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./project-server.js", () => ({
  readProjectContext: async () => ({ repo: "orbix-ai", commit: "abcdef1234567", dirty: false, playgroundVersion: "0.0.3" }),
}));
vi.mock("./flags.js", () => ({ previewedFlags: async () => [], FlagsCard: () => null }));
vi.mock("./notices.js", () => ({ useLayerStatus: () => null, staleComponents: () => new Set(), LayerNotices: () => null }));

// What each rasterization "draws": the same label means the same pixels.
let pixels = "screen";
vi.mock("modern-screenshot", () => ({
  domToCanvas: vi.fn(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.dataset.raster = pixels;
    return canvas;
  }),
}));

const { default: Toolbar } = await import("./index.js");
const { startTracking } = await import("./proposal.js");
const { captureScreen, snapshots } = await import("./snapshots.js");
const { exportForm } = await import("./export.js");
const { HOST_ATTRIBUTE } = await import("./styles.js");

const Button = createAdapter("Button", (props: { variant?: string; children?: string }) => (
  <button type="button" data-variant={props.variant}>
    {props.children}
  </button>
));
const ROW = "app/members.tsx › MemberRow › Button[1]";
const writes = JSON.stringify({ attributes: [{ name: "variant", writtenAs: "literal" }], spreads: false, children: "text" });

function Page() {
  return (
    <main>
      {["ana", "bia"].map((member) => (
        <Button key={member} {...({ "data-ds-anchor": ROW, "data-ds-source": "app/members.tsx:12:9 1/1", "data-ds-writes": writes } as object)} variant="ghost">
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
let downloads: { name: string; blob: Blob }[] = [];

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
/** Settles until `done` holds: an export's capture and build take longer on a loaded machine. */
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

const read = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

async function exportedProposal(): Promise<Proposal> {
  const download = downloads.at(-1);
  if (!download) throw new Error("nothing was downloaded");
  const html = await read(download.blob);
  const doc = new DOMParser().parseFromString(html, "text/html");
  return JSON.parse(doc.getElementById(REPORT_DATA_ID)?.textContent ?? "") as Proposal;
}

async function openDialog(): Promise<void> {
  act(() => shadow().querySelector<HTMLButtonElement>("[data-export]")?.click());
  // Open once the preview has counted.
  await until(() => dialog()?.querySelector(".counts") != null);
}

async function capture(options?: Parameters<typeof captureScreen>[0]) {
  await act(async () => {
    await captureScreen(options);
  });
}

beforeEach(async () => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  delete (globalThis as { __loupeSnapshots?: unknown }).__loupeSnapshots;
  delete (globalThis as { __loupeExportForm?: unknown }).__loupeExportForm;
  pixels = "screen";
  downloads = [];
  // jsdom lays nothing out: the member buttons are on screen, everything else is nowhere.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const on = this.tagName === "BUTTON" && this.closest("main") !== null;
    const [top, left, width, height] = on ? [100, 100, 80, 32] : [0, 0, 0, 0];
    return { top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON() {} } as DOMRect;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ drawImage: () => {} }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement, kind?: string) {
    return `data:${kind ?? "image/png"};base64,${this.dataset.raster ?? "crop"}`;
  });
  const blobs = new Map<string, Blob>();
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    if (blob) downloads.push({ name: this.download, blob });
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
  (window as { __loupe?: LoupeDebug }).__loupe = loupe;
  startTracking();
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
  delete (window as { __loupe?: LoupeDebug }).__loupe;
  vi.restoreAllMocks();
});

describe("the export dialog", () => {
  it("opens from the footer, prefilled with a title, and counts what the file will hold", async () => {
    expect(button("Export…")?.disabled).toBe(true);
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    await openDialog();

    expect(dialog()?.open).toBe(true);
    expect(dialog()?.getAttribute("aria-labelledby")).toBe("loupe-export-title");
    expect(field<HTMLInputElement>('input[name="title"]').value).toBe("Button variant in MemberRow");
    expect(dialog()?.querySelector(".counts")?.textContent).toBe(
      "1 change · 1 without a screenshot · 0 held for review · 0 outdated Snapshots",
    );
    expect([...(dialog()?.querySelectorAll("[data-entry]") ?? [])].map((entry) => entry.querySelector("span")?.textContent)).toEqual([
      "c1 · variant on 1st of 1 <Button> in MemberRow, every Instance",
    ]);
    expect(dialog()?.querySelector('[role="alert"]')).toBeNull();
  });

  it("holds Export back only while the title is empty", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    await openDialog();
    const submit = button("Export", dialog() as HTMLDialogElement);
    expect(submit?.disabled).toBe(false);
    type(field('input[name="title"]'), "   ");
    expect(submit?.disabled).toBe(true);
    type(field('input[name="title"]'), "Calmer rows");
    expect(submit?.disabled).toBe(false);
  });

  it("downloads one report with the title, designer and notes, and clears nothing", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
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
    act(() => button("Export", dialog() as HTMLDialogElement)?.click());
    await until(() => dialog() === null);

    expect(downloads.map((download) => download.name)).toEqual([expect.stringMatching(/^proposal-calmer-rows-\d{8}-\d{4}\.html$/)]);
    expect(downloads[0]?.blob.type).toBe("text/html");
    const proposal = await exportedProposal();
    expect(proposal).toMatchObject({ title: "Calmer rows", designer: "Dana" });
    const [route] = proposal.routes;
    expect(route?.changes[0]?.note).toBe("Ghost reads as disabled on the dark theme.");
    // The export's own Snapshot of the screen in view.
    expect(route?.screenshots.map((shot) => [shot.id, shot.kind])).toEqual([
      ["s1", "viewport"],
      ["s2", "crop"],
    ]);
    expect(route?.changes[0]?.screenshots).toEqual(["s2"]);

    expect(dialog()).toBeNull();
    expect(button("Exported")).toBeDefined();
    // Focus goes back to what opened the dialog.
    expect(shadow().activeElement).toBe(shadow().querySelector("[data-export]"));
    expect(registry().store.records()).toEqual(records);
    expect(snapshots()).toHaveLength(1);

    // The next export starts from what was typed.
    await settle();
    await openDialog();
    expect(field<HTMLInputElement>('input[name="title"]').value).toBe("Calmer rows");
    expect(field<HTMLInputElement>('input[name="designer"]').value).toBe("Dana");
    expect(field<HTMLTextAreaElement>('[data-entry="c1"] textarea').value).toBe("Ghost reads as disabled on the dark theme.");
  });

  it("closes on Cancel and on Escape, downloading nothing", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    await openDialog();
    act(() => button("Cancel", dialog() as HTMLDialogElement)?.click());
    expect(dialog()).toBeNull();
    await openDialog();
    act(() => {
      field('input[name="title"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(downloads).toEqual([]);
    expect(snapshots()).toHaveLength(0);
  });

  it("counts outdated Snapshots and warns past 25 MB, without blocking", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    pixels = "x".repeat(7 * 1024 * 1024);
    await capture();
    await capture();
    act(() => loupe.set(`${ROW}#ana`, "variant", "secondary", "group"));
    pixels = "y".repeat(7 * 1024 * 1024);
    await capture();
    await capture();
    await settle();
    await openDialog();

    expect(dialog()?.querySelector(".counts")?.textContent).toBe(
      "1 change · 0 without a screenshot · 0 held for review · 2 outdated Snapshots",
    );
    // Two kept pairs of 7 MB images; the export's own Snapshot would replace or repeat one, so it adds nothing.
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toMatch(/about 28\.\d MB, over 25 MB/);
    expect(button("Export", dialog() as HTMLDialogElement)?.disabled).toBe(false);
  });

  it("exports without its own Snapshot when the capture fails, and says so", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await openDialog();
    act(() => button("Export", dialog() as HTMLDialogElement)?.click());
    await until(() => dialog() === null);
    expect(downloads).toHaveLength(1);
    const exported = shadow().querySelector<HTMLButtonElement>("[data-export]");
    expect(exported?.textContent).toBe("Exported, no new screen");
    expect(exported?.title).toMatch(/without a screenshot of the screen in view: .*no viewport to capture/);
  });

  it("drops its own Snapshot when it repeats a manual one of the same screen", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    await capture();
    await openDialog();
    act(() => button("Export", dialog() as HTMLDialogElement)?.click());
    await until(() => dialog() === null);
    expect(snapshots().map((snapshot) => [snapshot.id, snapshot.auto])).toEqual([[1, false]]);
    expect((await exportedProposal()).routes[0]?.screenshots.filter((shot) => shot.kind === "viewport")).toHaveLength(1);

    // A different screen is kept: the report shows both.
    pixels = "scrolled";
    await openDialog();
    act(() => button("Export", dialog() as HTMLDialogElement)?.click());
    await until(() => dialog() === null);
    expect(snapshots().map((snapshot) => snapshot.auto)).toEqual([false, true]);
    expect((await exportedProposal()).routes[0]?.screenshots.filter((shot) => shot.kind === "viewport")).toHaveLength(2);
    expect(exportForm().title).toBeNull();
  });
});
