// @vitest-environment jsdom
// The Toolbar's error boundary (surface/): a throw anywhere in it stops at Loupe, and
// the host's layout keeps rendering. `<LoupeMount />` has Suspense only, and the open
// panel has a boundary of its own (index.tsx `PanelBoundary`); this is the pill's.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { OPEN_KEY } from "./launcher-place.js";
import { HOST_ATTRIBUTE } from "./styles.js";

vi.mock("./launcher.js", () => ({
  Launcher() {
    throw new Error("the pill broke");
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  vi.restoreAllMocks();
});

it("stops a throw in the Toolbar at Loupe: the host's page goes on rendering", async () => {
  resetLoupe();
  // Collapsed: the pill is what renders, and throws.
  localStorage.setItem(OPEN_KEY, "closed");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const LoupeMount = devMount(Toolbar);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <>
        <h1>The app</h1>
        <LoupeMount />
      </>,
    ),
  );
  await act(async () => await new Promise((resolve) => setTimeout(resolve, 50)));
  expect(container.querySelector("h1")?.textContent).toBe("The app");
  expect(document.querySelector(`[${HOST_ATTRIBUTE}]`)).toBeNull();
  expect(error.mock.calls.some((call) => String(call[0]).startsWith("Loupe hit an error and stepped aside"))).toBe(true);
  act(() => root.unmount());
  container.remove();
});
