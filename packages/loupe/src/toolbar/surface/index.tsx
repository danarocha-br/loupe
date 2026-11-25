// The Toolbar's surface: Loupe's adapters over the design system's (`@loupe/ui/surface`,
// ADR 0003, 0010). The shadow root, the layered stylesheet, the reader's text size, the
// language and the boundary are the package's; what is the Toolbar's is here:
// - `STYLESHEET`, the system's with the patterns' layer on top;
// - `useToolbarSurface()`, the Toolbar's: a host on the body, so the app's CSS can't reach it;
// - `<Surface>`, a host in place under `STYLESHEET`, for a test or the workbench page to draw
//   any primitive or pattern inside a real shadow root;
// - `useTheme()`, light or dark as the reader last chose it.

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { attachSurface, Surface as SystemSurface, type SurfaceProps, stylesheet, SWITCHING_ATTRIBUTE, type Theme, THEME_ATTRIBUTE } from "@loupe/ui/surface";
import { HOST_ATTRIBUTE, THEME_KEY } from "../styles.js";
import { PATTERNS_CSS } from "../patterns/styles.js";

export { SurfaceBoundary, type Theme } from "@loupe/ui/surface";

/**
 * The one stylesheet every surface of the Toolbar adopts, every rule in a layer: the
 * ground, then the primitives, then the patterns. No view writes a rule of its own.
 */
export const STYLESHEET: string = stylesheet(PATTERNS_CSS);

/** The Toolbar's adapter: a host element on the body with an open shadow root. */
export function useToolbarSurface(): ShadowRoot | null {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    const host = document.createElement("div");
    host.setAttribute(HOST_ATTRIBUTE, "");
    const shadow = attachSurface(host, STYLESHEET);
    document.body.append(host);
    setRoot(shadow);
    return () => host.remove();
  }, []);
  return root;
}

/**
 * The in-place adapter: draws `children` inside a real shadow root, under `STYLESHEET`,
 * at a theme and, for the workbench, a text size of the reader's choosing.
 */
export function Surface(props: Omit<SurfaceProps, "stylesheet">) {
  return <SystemSurface {...props} stylesheet={STYLESHEET} />;
}

/** Storage can throw (a private window, blocked site data): the OS preference decides then. */
function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * Light or dark: the OS preference, until a toggle picks one, which this browser then
 * remembers for every app on the origin. `probe` is an element in the shadow root
 * whose style is read to land the theme before transitions come back on.
 */
export function useTheme(host: HTMLElement, probe: string): [Theme, () => void] {
  const [chosen, setChosen] = useState<Theme | null>(storedTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(DARK_QUERY);
    const change = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener?.("change", change);
    return () => query.removeEventListener?.("change", change);
  }, []);
  const theme = chosen ?? system;
  // Before paint, so a dark system never sees one light frame. Transitions are off for
  // the frame the theme lands in: every colour easing at once would smear the switch.
  useLayoutEffect(() => {
    host.setAttribute(SWITCHING_ATTRIBUTE, "");
    host.setAttribute(THEME_ATTRIBUTE, theme);
    const element = host.shadowRoot?.querySelector(probe);
    // Reading a style makes the browser apply the new theme now, with transitions still off.
    if (element) void getComputedStyle(element).opacity;
    const timer = setTimeout(() => host.removeAttribute(SWITCHING_ATTRIBUTE), 1);
    return () => clearTimeout(timer);
  }, [host, theme, probe]);
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setChosen(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Not remembered: it still holds for this page load.
    }
  }, [theme]);
  return [theme, toggle];
}
