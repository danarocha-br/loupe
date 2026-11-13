// @vitest-environment jsdom
// The Toolbar loads `meta/` for an Instance with no Adapter the first time the
// inspector shows one, and never while the panel is hidden (PER-180).
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHOR_ATTRIBUTE, callSiteId } from "../call-site.js";
import { devMount } from "../mount.js";
import { createAdapter } from "../runtime/adapter.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import Toolbar from "./index.js";
import { HOST_ATTRIBUTE } from "./styles.js";

const readInstanceMeta = vi.fn();
vi.mock("./meta-server.js", () => ({ readInstanceMeta: (...args: unknown[]) => readInstanceMeta(...args) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Button = createAdapter("Button", (props: { children?: ReactNode }) => <button type="button" {...props} />, {
  props: { children: { editable: true, from: "@types/react", kind: "text" } },
});
/** A component with no Adapter: anchored by the loader, listed inspect-only. */
function Card(props: { tone?: string; children?: ReactNode }) {
  return <section {...props} />;
}

const LoupeMount = devMount(Toolbar);
const CARD = callSiteId({ path: "app/members.tsx", enclosing: "Members", component: "Card", ordinal: 1 });
const SAVE = callSiteId({ path: "app/members.tsx", enclosing: "Members", component: "Button", ordinal: 1 });

let container: HTMLDivElement;
let root: Root;
const doc = document as unknown as Record<string, unknown>;

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  readInstanceMeta.mockReset();
  readInstanceMeta.mockResolvedValue([
    {
      tone: {
        editable: true,
        from: "repo",
        kind: "options",
        status: "verified",
        options: ["calm", "loud"],
        default: { source: "destructure", value: "calm" },
      },
    },
  ]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // Next hydrates the document; the fiber walk that finds Instances with no Adapter looks for a container there.
  const key = Object.keys(container).find((name) => name.startsWith("__reactContainer$")) as string;
  doc.__reactContainer$test = (container as unknown as Record<string, unknown>)[key];
  (window as { __loupe?: LoupeDebug }).__loupe = createDebug();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete doc.__reactContainer$test;
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  delete (window as { __loupe?: LoupeDebug }).__loupe;
});

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
const shadow = () => document.querySelector(`[${HOST_ATTRIBUTE}]`)?.shadowRoot as ShadowRoot;
const click = async (element: Element) => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })));
  await settle();
};
const instance = (suffix: string) =>
  [...shadow().querySelectorAll<HTMLButtonElement>("button[data-instance]")].find((button) =>
    button.dataset.instance?.includes(suffix),
  ) as HTMLButtonElement;
const panelButton = (text: string) =>
  [...shadow().querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement;

async function mount() {
  act(() =>
    root.render(
      <>
        <main>
          <Button {...({ [ANCHOR_ATTRIBUTE]: SAVE } as object)}>Salvar</Button>
          <Card {...({ [ANCHOR_ATTRIBUTE]: CARD } as object)}>Resumo</Card>
        </main>
        <LoupeMount />
      </>,
    ),
  );
  await settle();
  await settle();
}

describe("loading meta/ for an Instance with no Adapter", () => {
  it("asks for nothing until the inspector shows one, and nothing for an adapted one", async () => {
    await mount();
    expect(readInstanceMeta).not.toHaveBeenCalled();
    await click(instance(SAVE));
    expect(readInstanceMeta).not.toHaveBeenCalled();
  });

  it("loads its metadata when it is selected, and shows each declared prop's reason and default", async () => {
    await mount();
    await click(instance(CARD));
    expect(readInstanceMeta).toHaveBeenCalledTimes(1);
    expect(readInstanceMeta).toHaveBeenCalledWith([{ path: "app/members.tsx", component: "Card" }]);
    await settle();
    const tone = shadow().querySelector("[data-prop=tone]")?.textContent ?? "";
    expect(tone).toContain("NO ADAPTER");
    expect(tone).toContain("calm");
    expect(shadow().querySelector("[data-testid=coverage]")?.textContent).toBe("0 editable props · 2 inspect only");
  });

  it("asks for nothing while the panel is hidden", async () => {
    await mount();
    await click(panelButton("Hide"));
    expect(shadow().querySelector("button[data-instance]")).toBeNull();
    await settle();
    expect(readInstanceMeta).not.toHaveBeenCalled();
  });

  it("keeps today's rows when the dev server can't answer", async () => {
    readInstanceMeta.mockRejectedValueOnce(new Error("restarting"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mount();
    await click(instance(CARD));
    await settle();
    expect(shadow().querySelector("[data-prop=children]")?.textContent).toContain("UNVERIFIED");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
