// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteHint, callSiteId, instanceId, SOURCE_ATTRIBUTE } from "../call-site.js";
import { devMount } from "../mount.js";
import { createAdapter } from "../runtime/adapter.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";
import { resetLoupe } from "../runtime/slot.js";
import { memoryRequest, memorySource } from "./flags.fixture.js";
import { setFlagSource } from "./flags-store.js";
import Toolbar from "./index.js";
import { copyProposal } from "./copy.js";
import { collectProposal, collectProposalText, pageTheme, startTracking } from "./proposal.js";
import { HOST_ATTRIBUTE } from "./styles.js";

const project = vi.hoisted(() => ({
  read: async (): Promise<unknown> => ({ repo: "orbix-ai", commit: "abcdef1234567", dirty: false, playgroundVersion: "0.0.3", install: { app: "apps/app", layer: "packages/loupe" } }),
}));
const knownProject = project.read;
vi.mock("./project-server.js", () => ({ readProjectContext: () => project.read() }));
// The override cookie holds one flag preview, which the app doesn't declare.
const cookieWithPreview = () => memorySource(memoryRequest({ overrides: { "new-roles": true } }));
setFlagSource(cookieWithPreview());

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Button = createAdapter("Button", (props: { variant?: string; children?: string }) => (
  <button type="button" data-variant={props.variant}>
    {props.children}
  </button>
));

const ROW_KEY = { path: "app/members.tsx", enclosing: "MemberRow", component: "Button", ordinal: 1 };
const CONFIRM_KEY = { path: "app/members.tsx", enclosing: "Members", component: "Button", ordinal: 1 };
const ROW = callSiteId(ROW_KEY);
const CONFIRM = callSiteId(CONFIRM_KEY);
const ROW_HINT = callSiteHint(ROW_KEY, { line: 12, column: 9, total: 1 });
const CONFIRM_HINT = callSiteHint(CONFIRM_KEY, { line: 30, column: 7, total: 1 });
const writes = (names: string[]) =>
  JSON.stringify({ attributes: names.map((name) => ({ name, writtenAs: "literal" })), spreads: false, children: "text" });

function Page({ confirming }: { confirming: boolean }) {
  return (
    <main>
      {["ana", "bia"].map((member) => (
        <Button
          key={member}
          {...({ [ANCHOR_ATTRIBUTE]: ROW, [SOURCE_ATTRIBUTE]: ROW_HINT, "data-ds-writes": writes(["variant"]) } as object)}
          variant="ghost"
        >
          {member}
        </Button>
      ))}
      {confirming && (
        <Button
          {...({ [ANCHOR_ATTRIBUTE]: CONFIRM, [SOURCE_ATTRIBUTE]: CONFIRM_HINT, "data-ds-writes": writes(["variant"]) } as object)}
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
  resetLoupe();
  project.read = knownProject;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = debugOf();
  startTracking();
  act(() => root.render(<Harness />));
  await settle();
  await settle();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  vi.restoreAllMocks();
});

describe("the Proposal from the page", () => {
  it("keeps an unmounted Instance's change, as last seen", async () => {
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    act(() => loupe.set(CONFIRM, "variant", "default"));
    act(() => show(false));
    await settle();

    const proposal = await collectProposal({ title: "Calmer rows", designer: "Dana" });
    const [route] = proposal.routes;
    expect(proposal.project.commit).toBe("abcdef1234567");
    expect(route?.flags).toEqual({ "new-roles": true });
    expect(route?.url).toBe(location.href);
    // Numbered and listed in the order they were made, as the page numbers them.
    const [group, confirm] = route?.changes ?? [];
    expect(group).toMatchObject({ id: "c1", scope: "call-site", props: [{ name: "variant", current: "ghost", proposed: "outline" }] });
    expect(group?.instances.map((instance) => instance.keyPath)).toEqual(["ana", "bia"]);
    expect(confirm).toMatchObject({ id: "c2", scope: "instance", onScreenAtExport: false, props: [{ current: "destructive", proposed: "default" }] });
  });

  it("names its first change when no title is given, and clears nothing", async () => {
    act(() => loupe.set(instanceId(ROW, "bia"), "variant", "outline"));
    const before = registry().store.records();
    const proposal = await collectProposal();
    expect(proposal.title).toBe("Button variant in MemberRow");
    expect(registry().store.records()).toEqual(before);
  });

  it("builds the Proposal with an unknown project when the dev server refuses the project call", async () => {
    project.read = async () => {
      throw new Error("restarting");
    };
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));

    const proposal = await collectProposal();
    expect(proposal.project).toEqual({ repo: null, commit: null, dirty: null, playgroundVersion: null, install: null });
    expect(proposal.routes[0]?.changes).toHaveLength(1);
    const text = await collectProposalText();
    expect(text).toContain("unknown commit");
    // Not knowing where Loupe is installed, the rules still send the agent to `loupe locate`.
    expect(text).toContain("run `loupe locate` from the app folder Loupe is installed in");
    expect(text).not.toContain("count the uses");
  });

  it.each(["refused", "answered badly"] as const)(
    "still records the flag previews the page last read when the flag call is %s during the export (PER-226)",
    async (failure) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
      const request = memoryRequest({ overrides: { "new-roles": true } });
      const source = memorySource(request);
      let refuse = false;
      setFlagSource({ ...source, read: () => (refuse ? Promise.reject(new Error("restarting")) : source.read()) });
      try {
        // The page has read its previews once, as the card does on mount.
        await collectProposal();
        if (failure === "refused") refuse = true;
        else request.fetch = async () => new Response("boom", { status: 500 });

        const proposal = await collectProposal();

        expect(proposal.routes[0]?.flags).toEqual({ "new-roles": true });
      } finally {
        setFlagSource(cookieWithPreview());
      }
    },
  );

  it("claims the clipboard during the click, before the Proposal is built", async () => {
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
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));

    const done = copyProposal({ title: "Calmer rows" });
    // Called at once, with a promise for the text: the click's permission is still good.
    expect(write).toHaveBeenCalledTimes(1);
    await done;
    const text = await (copied as Promise<string> | null);
    expect(text).toContain("# Calmer rows");
    expect(text).toContain('`variant`: "ghost" → "outline"');
    expect(registry().store.records()).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("has one copy action in the footer: Copy Proposal", async () => {
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    await settle();
    expect(footerButton("Copy Proposal")?.disabled).toBe(false);
    expect(footerButton("Copy as Markdown")).toBeUndefined();
  });

  it("places a record set again after a reset on the route it is set on now", async () => {
    const start = location.pathname;
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
    act(() => loupe.reset(instanceId(ROW, "ana"), undefined, "group"));
    act(() => history.pushState(null, "", "/elsewhere"));
    act(() => loupe.set(instanceId(ROW, "ana"), "variant", "outline", "group"));
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
