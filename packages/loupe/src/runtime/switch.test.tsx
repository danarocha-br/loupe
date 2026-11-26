// @vitest-environment jsdom
// The runtime under `withLoupe`'s switch: `LOUPE=0 next dev` sets LOUPE_SWITCH "off",
// and an Adapter the app imports directly, not through the loader, is then its
// component as it is: importing the runtime makes no `window.__loupe`, and rendering
// the Adapter starts no registry. Anywhere `withLoupe` didn't say "off", it adapts.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetLoupe } from "./slot.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Button({ children }: { children?: string }) {
  return <button type="button">{children}</button>;
}

/** The page's state, as `slot.ts` keeps it. */
const pageState = () => (globalThis as { [key: symbol]: Map<string, unknown> | undefined })[Symbol.for("loupe.state")];

/** A fresh copy of the runtime under this LOUPE_SWITCH, an Adapter made with it, rendered. */
async function renderAdapted(value: string | undefined) {
  if (value === undefined) delete process.env.LOUPE_SWITCH;
  else vi.stubEnv("LOUPE_SWITCH", value);
  vi.resetModules();
  const { createAdapter } = await import("./index.js");
  const Adapted = createAdapter("Button", Button);
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  act(() => root.render(<Adapted>Save</Adapted>));
  unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  return { Adapted, container };
}

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.unstubAllEnvs();
  delete process.env.LOUPE_SWITCH;
  resetLoupe();
});

describe("the runtime under LOUPE_SWITCH", () => {
  it('is off under "off": the Adapter is its component, with no registry and no window.__loupe', async () => {
    const { Adapted, container } = await renderAdapted("off");
    expect(Adapted).toBe(Button);
    expect(container.textContent).toBe("Save");
    expect("__loupe" in window).toBe(false);
    expect(pageState()?.has("registry") ?? false).toBe(false);
  });

  it.each([
    ['"on"', "on"],
    ["unset (a test, a layout without withLoupe)", undefined],
  ])("adapts when %s: window.__loupe from the import, the Instance registered", async (_, value) => {
    const { Adapted, container } = await renderAdapted(value);
    expect(Adapted).not.toBe(Button);
    expect(container.textContent).toBe("Save");
    expect("__loupe" in window).toBe(true);
    expect(pageState()?.has("registry")).toBe(true);
  });
});
