// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteId } from "../call-site.js";
import type { LayerStatus } from "../layer-status.js";
import { devMount } from "../mount.js";
import { createAdapter } from "../runtime/adapter.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { HOST_ATTRIBUTE } from "./styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The Server Action, answered by the test instead of the dev server's disk.
const server = vi.hoisted(() => ({ status: null as LayerStatus | null, calls: 0, refusal: null as Error | null }));
vi.mock("./layer-server.js", () => ({
  readProductLayerStatus: async () => {
    server.calls += 1;
    if (server.refusal) throw server.refusal;
    return server.status;
  },
}));

const Button = createAdapter("Button", (props: { children?: ReactNode }) => <button type="button" {...props} />, {
  props: { children: { editable: true, from: "@types/react", kind: "text" } },
});
const Badge = createAdapter("Badge", (props: { children?: ReactNode }) => <span {...props} />, {
  props: { children: { editable: true, from: "@types/react", kind: "text" } },
});
const site = (component: string) => ({
  [ANCHOR_ATTRIBUTE]: callSiteId({ path: "app/page.tsx", enclosing: "Page", component, ordinal: 1 }),
});
const LoupeMount = devMount(Toolbar);

const COMMAND = "pnpm -C apps/app exec loupe generate";
const STALE: LayerStatus = {
  command: COMMAND,
  missing: false,
  format: null,
  stale: [{ source: "ds/components/ui/button.tsx", components: ["Button", "ButtonGroup"], changed: ["ds/components/ui/button.tsx"] }],
  notGenerated: [],
};
const FRESH: LayerStatus = { command: COMMAND, missing: false, format: null, stale: [], notGenerated: [] };
/** adapt-list.json is gone, as after a branch switch (PER-227): `generate` has to be told the roots it can no longer read. */
const WRITE_AGAIN = `${COMMAND} --design-system <dir> --app <dir>`;
const MISSING: LayerStatus = { command: WRITE_AGAIN, missing: true, format: null, stale: [], notGenerated: null };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetLoupe();
  server.status = null;
  server.calls = 0;
  server.refusal = null;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const panelText = () => shadow().querySelector(".panel")?.textContent ?? "";
const summaryOf = (component: string) =>
  [...shadow().querySelectorAll("summary")].find((summary) => summary.textContent?.startsWith(component))?.textContent ?? "";

async function mount() {
  act(() =>
    root.render(
      <>
        <Button {...(site("Button") as object)}>Salvar</Button>
        <Badge {...(site("Badge") as object)}>Novo</Badge>
        <LoupeMount />
      </>,
    ),
  );
  await settle();
  await settle();
}

describe("the Product layer's notices", () => {
  it("shows nothing while every source matches its hash", async () => {
    server.status = FRESH;
    await mount();
    expect(server.calls).toBe(1);
    expect(shadow().querySelector("[data-testid=stale-notice]")).toBeNull();
    expect(panelText()).not.toContain("Source changed");
  });

  it("flags a component whose source changed, names the command, and clears after generate", async () => {
    server.status = STALE;
    await mount();
    const notice = shadow().querySelector("[data-testid=stale-notice]")?.textContent ?? "";
    expect(notice).toContain("2 components changed since the last generate");
    expect(notice).toContain("Button, ButtonGroup");
    expect(notice).toContain(COMMAND);
    expect(summaryOf("Button")).toContain("Source changed");
    expect(summaryOf("Badge")).not.toContain("Source changed");

    // `generate` ran in the terminal; coming back to the window checks again.
    server.status = FRESH;
    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 2100)));
    expect(shadow().querySelector("[data-testid=stale-notice]")).toBeNull();
    expect(summaryOf("Button")).not.toContain("Source changed");
  });

  it("shows another formatVersion and logs the command once", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    server.status = { command: COMMAND, missing: false, format: { layer: 0, runtime: 1, newer: false }, stale: [], notGenerated: null };
    await mount();
    const notice = shadow().querySelector("[data-testid=format-notice]")?.textContent ?? "";
    expect(notice).toContain("generated by an older Loupe (formatVersion 0, and this Loupe reads 1)");
    expect(notice).toContain(COMMAND);
    const logged = errors.mock.calls.filter((call) => String(call[0]).startsWith("[loupe]"));
    expect(logged).toEqual([[`[loupe] The Product layer was generated by an older Loupe (formatVersion 0, and this Loupe reads 1). Regenerate it: ${COMMAND}`]]);

    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 2100)));
    expect(errors.mock.calls.filter((call) => String(call[0]).startsWith("[loupe]"))).toHaveLength(1);
  });

  it("keeps the last status when the dev server refuses the call, and warns once however often it asks", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    server.status = STALE;
    await mount();
    expect(shadow().querySelector("[data-testid=stale-notice]")).not.toBeNull();

    // A restarting dev server: every check after this one is refused.
    server.refusal = new Error("Failed to fetch");
    for (let focus = 0; focus < 2; focus += 1) {
      act(() => window.dispatchEvent(new Event("focus")));
      await act(async () => await new Promise((resolve) => setTimeout(resolve, 2100)));
    }
    expect(server.calls).toBeGreaterThanOrEqual(3);
    expect(shadow().querySelector("[data-testid=stale-notice]")).not.toBeNull();
    expect(warn.mock.calls).toEqual([["[loupe] Couldn't read the Product layer's status: Error: Failed to fetch"]]);
  });

  it("stays quiet when withLoupe isn't active", async () => {
    server.status = null;
    await mount();
    expect(shadow().querySelector("[data-testid=format-notice], [data-testid=stale-notice], [data-testid=missing-notice]")).toBeNull();
  });
});

describe("a missing Product layer (PER-227)", () => {
  const missingNotice = () => shadow().querySelector("[data-testid=missing-notice]");

  it("says so, and names the command, when the first check already finds it gone", async () => {
    server.status = MISSING;
    await mount();
    const notice = missingNotice();
    expect(notice?.getAttribute("role")).toBe("alert");
    expect(notice?.textContent).toContain("Product layer missing");
    expect(notice?.textContent).toContain("adapt-list.json is gone");
    expect(notice?.textContent).toContain("Restore it with git, or write it again with the command below");
    expect(notice?.textContent).toContain("restart the dev server");
    expect(notice?.textContent).toContain(WRITE_AGAIN);
    // Nothing else can be said about a layer that isn't there.
    expect(shadow().querySelector("[data-testid=stale-notice], [data-testid=format-notice]")).toBeNull();
  });

  it("appears when the file goes missing while the panel is open, and clears when it comes back", async () => {
    server.status = STALE;
    await mount();
    expect(missingNotice()).toBeNull();
    expect(shadow().querySelector("[data-testid=stale-notice]")).not.toBeNull();

    // A branch switch removes adapt-list.json; coming back to the window checks again.
    server.status = MISSING;
    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 2100)));
    expect(missingNotice()?.textContent).toContain(WRITE_AGAIN);
    expect(shadow().querySelector("[data-testid=stale-notice]")).toBeNull();

    // The file is back (switched back to the branch, or written again).
    const asked = server.calls;
    server.status = FRESH;
    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 2100)));
    expect(server.calls).toBeGreaterThan(asked);
    expect(missingNotice()).toBeNull();
    expect(panelText()).not.toContain("Product layer missing");
  });
});

/** A component `generate` hasn't seen yet: anchored by the loader, with no Adapter. */
function NewCard(props: { children?: ReactNode }) {
  return <div {...props} />;
}
/** Generated, but with no prop that can be Editable, so it has no Adapter either. */
function Divider(props: object) {
  return <hr {...props} />;
}

describe("components that are new since the last generate", () => {
  const doc = document as unknown as Record<string, unknown>;

  async function mountWithNew() {
    // The fiber walk finds roots on the document, where Next hydrates.
    const key = Object.keys(container).find((name) => name.startsWith("__reactContainer$")) as string;
    doc.__reactContainer$test = (container as unknown as Record<string, unknown>)[key];
    act(() =>
      root.render(
        <>
          <Button {...(site("Button") as object)}>Salvar</Button>
          <NewCard {...(site("NewCard") as object)}>Olá</NewCard>
          <Divider {...(site("Divider") as object)} />
          <LoupeMount />
        </>,
      ),
    );
    await settle();
    await settle();
  }

  afterEach(() => {
    delete doc.__reactContainer$test;
  });

  // What the list and the Inspector say about such a component is `unadapted.test.ts`'s,
  // asked of `panelView()`; these check the status reaches the panel and its notice.
  it("lists one as Not generated yet, in the list and in the notice that names the command", async () => {
    server.status = { ...FRESH, notGenerated: ["NewCard", "NewCardTitle"] };
    await mountWithNew();
    expect(summaryOf("NewCard")).toContain("Not generated yet");
    expect(summaryOf("Divider")).not.toContain("Not generated yet");
    const notice = shadow().querySelector("[data-testid=not-generated-notice]")?.textContent ?? "";
    expect(notice).toContain("1 component on this page is not generated yet");
    expect(notice).toContain("NewCard");
    expect(notice).toContain(COMMAND);
  });

  it("never flags an adapted component: its Adapter is generate's output", async () => {
    // A new product component that happens to share a design-system name.
    server.status = { ...FRESH, notGenerated: ["Button"] };
    await mountWithNew();
    expect(summaryOf("Button")).not.toContain("Not generated yet");
    expect(shadow().querySelector("[data-testid=not-generated-notice]")).toBeNull();
  });

  it("clears once generate has read it", async () => {
    server.status = { ...FRESH, notGenerated: ["NewCard"] };
    await mountWithNew();
    expect(summaryOf("NewCard")).toContain("Not generated yet");
    server.status = FRESH;
    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 2100)));
    expect(summaryOf("NewCard")).not.toContain("Not generated yet");
    expect(shadow().querySelector("[data-testid=not-generated-notice]")).toBeNull();
  });

  it("flags nothing while the Product layer can't be read or is in another format", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const other = { command: COMMAND, missing: false, format: { layer: 0, runtime: 1, newer: false }, stale: [], notGenerated: null };
    for (const status of [null, MISSING, other]) {
      server.status = status;
      await mountWithNew();
      expect(summaryOf("NewCard")).not.toContain("Not generated yet");
      expect(shadow().querySelector("[data-testid=not-generated-notice]")).toBeNull();
      act(() => root.render(<></>));
    }
  });
});
