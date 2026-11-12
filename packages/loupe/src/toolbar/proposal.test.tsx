// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { createAdapter } from "../runtime/adapter.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";
import Toolbar from "./index.js";
import { collectProposal, pageTheme, startTracking } from "./proposal.js";
import { HOST_ATTRIBUTE } from "./styles.js";

vi.mock("./project-server.js", () => ({
  readProjectContext: async () => ({ repo: "orbix-ai", commit: "abcdef1234567", dirty: false, playgroundVersion: "0.0.3" }),
}));
vi.mock("./flags.js", () => ({
  previewedFlags: async () => [{ key: "new-roles", value: true }],
  FlagsCard: () => null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Button = createAdapter("Button", (props: { variant?: string; children?: string }) => (
  <button type="button" data-variant={props.variant}>
    {props.children}
  </button>
));

const ROW = "app/members.tsx › MemberRow › Button[1]";
const CONFIRM = "app/members.tsx › Members › Button[1]";
const writes = (names: string[]) =>
  JSON.stringify({ attributes: names.map((name) => ({ name, writtenAs: "literal" })), spreads: false, children: "text" });

function Page({ confirming }: { confirming: boolean }) {
  return (
    <main>
      {["ana", "bia"].map((member) => (
        <Button
          key={member}
          {...({ "data-ds-anchor": ROW, "data-ds-source": "app/members.tsx:12:9 1/1", "data-ds-writes": writes(["variant"]) } as object)}
          variant="ghost"
        >
          {member}
        </Button>
      ))}
      {confirming && (
        <Button
          {...({ "data-ds-anchor": CONFIRM, "data-ds-source": "app/members.tsx:30:7 1/1", "data-ds-writes": writes(["variant"]) } as object)}
          variant="destructive"
        >
          Remover
        </Button>
      )}
    </main>
  );
}

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
let show: (confirming: boolean) => void = () => {};

function Harness() {
  const [confirming, setConfirming] = useState(true);
  show = setConfirming;
  return (
    <>
      <Page confirming={confirming} />
      <LoupeMount />
    </>
  );
}
const LoupeMount = devMount(Toolbar);

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const footerButton = (text: string) =>
  [...shadow().querySelectorAll<HTMLButtonElement>(".footer button")].find((button) => button.textContent === text);

beforeEach(async () => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
  (window as { __loupe?: LoupeDebug }).__loupe = loupe;
  startTracking();
  act(() => root.render(<Harness />));
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

describe("the Proposal from the page", () => {
  it("keeps an unmounted Instance's change, as last seen", async () => {
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    act(() => loupe.set(CONFIRM, "variant", "default"));
    act(() => show(false));
    await settle();

    const proposal = await collectProposal({ title: "Calmer rows", designer: "Dana" });
    const [route] = proposal.routes;
    expect(proposal.project.commit).toBe("abcdef1234567");
    expect(route?.flags).toEqual({ "new-roles": true });
    expect(route?.url).toBe(location.href);
    // Instance records come first, as the store lists them.
    const [confirm, group] = route?.changes ?? [];
    expect(group).toMatchObject({ scope: "call-site", props: [{ name: "variant", current: "ghost", proposed: "outline" }] });
    expect(group?.instances.map((instance) => instance.keyPath)).toEqual(["ana", "bia"]);
    expect(confirm).toMatchObject({ scope: "instance", onScreenAtExport: false, props: [{ current: "destructive", proposed: "default" }] });
  });

  it("names its first change when no title is given, and clears nothing", async () => {
    act(() => loupe.set(`${ROW}#bia`, "variant", "outline"));
    const before = registry().store.records();
    const proposal = await collectProposal();
    expect(proposal.title).toBe("Button variant in MemberRow");
    expect(registry().store.records()).toEqual(before);
  });

  it("copies the Markdown summary from the footer", async () => {
    let copied: Promise<string> | null = null;
    class FakeItem {
      constructor(items: Record<string, Promise<Blob>>) {
        copied = (items["text/plain"] as Promise<Blob>).then(
          (blob) =>
            // jsdom's Blob has no text().
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsText(blob);
            }),
        );
      }
    }
    vi.stubGlobal("ClipboardItem", FakeItem);
    Object.defineProperty(navigator, "clipboard", { value: { write: vi.fn(async () => {}) }, configurable: true });

    expect(footerButton("Copy as Markdown")?.disabled).toBe(true);
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    act(() => footerButton("Copy as Markdown")?.click());
    await settle();

    expect(await copied).toContain("`variant`: \"ghost\" → \"outline\"");
    expect(footerButton("Copied")).toBeDefined();
    expect(registry().store.records()).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("leaves the Markdown in the console when the browser refuses the clipboard", async () => {
    vi.stubGlobal("ClipboardItem", class {});
    Object.defineProperty(navigator, "clipboard", {
      value: { write: vi.fn(async () => Promise.reject(new Error("Write permission denied."))) },
      configurable: true,
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    await settle();
    act(() => footerButton("Copy as Markdown")?.click());
    await settle();
    expect(footerButton("Copy failed")?.title).toBe("Write permission denied. The Markdown is in the console.");
    expect(info.mock.calls[0]?.[0]).toContain("`variant`: \"ghost\" → \"outline\"");
    vi.unstubAllGlobals();
  });

  it("places a record set again after a reset on the route it is set on now", async () => {
    const start = location.pathname;
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    act(() => loupe.reset(`${ROW}#ana`, undefined, "group"));
    act(() => history.pushState(null, "", "/elsewhere"));
    act(() => loupe.set(`${ROW}#ana`, "variant", "outline", "group"));
    const proposal = await collectProposal({ title: "Moved" });
    expect(proposal.routes.map((route) => route.route)).toEqual(["/elsewhere"]);
    act(() => history.pushState(null, "", start));
  });

  it("reads the theme the app set", () => {
    const html = document.createElement("html");
    html.className = "dark";
    expect(pageTheme(html)).toBe("dark");
    html.className = "";
    html.setAttribute("data-theme", "light");
    expect(pageTheme(html)).toBe("light");
  });
});
