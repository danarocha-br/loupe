// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { columnFor, pageWidth, reservedWidth, useColumn } from "./dock.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.documentElement.removeAttribute("style");
});

describe("the panel's column", () => {
  it("is 360px, 400px from 1600px wide, and docks only where the page keeps room for itself", () => {
    expect(columnFor(1024)).toEqual({ width: 360, docked: true });
    expect(columnFor(1600)).toEqual({ width: 400, docked: true });
    expect(columnFor(700)).toEqual({ width: 360, docked: false });
  });

  it("is never wider than the viewport, so nothing of it is off-screen at 320px", () => {
    expect(columnFor(360)).toEqual({ width: 360, docked: false });
    expect(columnFor(320)).toEqual({ width: 320, docked: false });
  });

  it("takes the root's right margin while open and puts the app's own back when it closes", () => {
    document.documentElement.style.setProperty("margin-right", "8px");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    const container = document.createElement("div");
    const root = createRoot(container);
    function Probe({ open }: { open: boolean }) {
      useColumn(open);
      return null;
    }
    act(() => root.render(createElement(Probe, { open: true })));
    expect(document.documentElement.style.marginRight).toBe("360px");
    expect(reservedWidth()).toBe(360);
    expect(pageWidth()).toBe(920);

    act(() => root.render(createElement(Probe, { open: false })));
    expect(document.documentElement.style.marginRight).toBe("8px");
    expect(reservedWidth()).toBe(0);
    act(() => root.unmount());
  });
});
