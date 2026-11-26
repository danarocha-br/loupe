// @vitest-environment jsdom
// `<LoupeMount />` loads the Toolbar only where `withLoupe` said Loupe runs: under
// `next dev`, which sets `LOUPE_TOOLBAR` "on", or "off" for `LOUPE=0`. Next inlines
// both reads, so the host's bundler folds the other cases to the stub (build.test.ts
// holds the condition in `dist/mount.js`); here they are read at runtime instead.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetLoupe } from "./runtime/slot.js";
import { HOST_ATTRIBUTE } from "./toolbar/styles.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mounts a fresh copy of the module under these env values, and lets the Toolbar load. */
async function mountWith(env: { NODE_ENV: string; LOUPE_TOOLBAR?: string }) {
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  if (env.LOUPE_TOOLBAR === undefined) delete process.env.LOUPE_TOOLBAR;
  else vi.stubEnv("LOUPE_TOOLBAR", env.LOUPE_TOOLBAR);
  vi.resetModules();
  const { LoupeMount } = await import("./mount.js");
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  act(() => root.render(<LoupeMount />));
  // Where it loads, long enough for the Toolbar's lazy module, the first time it is
  // transformed; elsewhere, long enough that it would have.
  const ticks = env.NODE_ENV === "development" && env.LOUPE_TOOLBAR === "on" ? 50 : 5;
  for (let wait = 0; wait < ticks && !document.querySelector(`[${HOST_ATTRIBUTE}]`); wait++) {
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 100)));
  }
  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.unstubAllEnvs();
  delete process.env.LOUPE_TOOLBAR;
  resetLoupe();
});

describe("LoupeMount", () => {
  it("loads the Toolbar and its window.__loupe when withLoupe turned Loupe on", async () => {
    unmount = await mountWith({ NODE_ENV: "development", LOUPE_TOOLBAR: "on" });
    expect(document.querySelector(`[${HOST_ATTRIBUTE}]`)).not.toBeNull();
    expect(typeof (window as { __loupe?: { proposal?: unknown } }).__loupe?.proposal).toBe("function");
  });

  it.each([
    ["LOUPE=0 next dev", { NODE_ENV: "development", LOUPE_TOOLBAR: "off" }],
    ["a layout without withLoupe", { NODE_ENV: "development" }],
    ["a production build", { NODE_ENV: "production", LOUPE_TOOLBAR: "on" }],
  ])("renders nothing and makes no window.__loupe under %s", async (_, env) => {
    unmount = await mountWith(env);
    expect(document.querySelector(`[${HOST_ATTRIBUTE}]`)).toBeNull();
    expect("__loupe" in window).toBe(false);
  });
});
