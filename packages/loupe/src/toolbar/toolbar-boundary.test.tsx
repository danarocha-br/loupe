// @vitest-environment jsdom
// The Toolbar's error boundary (surface/): a throw while it renders stops at Loupe,
// and the host's layout keeps rendering. `<LoupeMount />` has Suspense only.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { devMount } from "../mount.js";
import { resetLoupe } from "../runtime/slot.js";
import Toolbar from "./index.js";
import { HOST_ATTRIBUTE } from "./styles.js";

vi.mock("./panel.js", () => ({
  Panel() {
    throw new Error("the panel broke");
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  for (const host of document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) host.remove();
  vi.restoreAllMocks();
});

it("stops a throw in the Toolbar at Loupe: the host's page goes on rendering", async () => {
  resetLoupe();
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
