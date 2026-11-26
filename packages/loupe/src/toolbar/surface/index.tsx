// The Toolbar's surface: Loupe's adapter over the design system's (`@loupe/ui/surface`,
// ADR 0003, 0010, 0012). The shadow root, the layered stylesheet, the reader's text size, the
// language and the boundary are the package's; the stylesheet the Toolbar adopts is
// `@loupe/patterns`'; what is the Toolbar's is here:
// - `STYLESHEET`, `@loupe/patterns/stylesheet`'s: the system's with the patterns' layer on
//   top, and the Toolbar's own tokens (`@loupe/patterns/tokens`) on the host;
// - `useToolbarSurface()`, the Toolbar's: a host on the body, so the app's CSS can't reach it;
// - `useTheme()`, light or dark as the reader last chose it.

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { attachSurface, SWITCHING_ATTRIBUTE, type Theme, THEME_ATTRIBUTE } from "@loupe/ui/surface";
import { STYLESHEET } from "@loupe/patterns/stylesheet";
import { HOST_ATTRIBUTE, THEME_KEY } from "../styles.js";

export { SurfaceBoundary, type Theme } from "@loupe/ui/surface";

/**
 * The one stylesheet every surface of the Toolbar adopts, every rule in a layer: the
 * ground, with the Toolbar's own tokens on the host after the system's, then the
 * primitives, then the patterns. No view writes a rule of its own.
 */
export { STYLESHEET };

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
