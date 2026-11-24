// The surface: the shadow root Loupe draws in, and everything it carries with it:
// the stylesheet, the theme, the reader's text size and the language (ADR 0003,
// the architecture review's candidate 3). Two adapters use it:
// - `useToolbarSurface()`, the Toolbar's: a host on the body, so the app's CSS can't reach it;
// - `<Surface>`, a host in place, for a test or the workbench page to draw any primitive
//   inside a real shadow root, under the same stylesheet.
// Whatever renders in a surface does so inside `SurfaceBoundary`: a throw takes the
// surface down, never the host's layout. And beside the `Announcer`'s two live regions,
// mounted with the surface, before anything in it has something to say.

import { Component, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GROUND_CSS, HOST_ATTRIBUTE, SCALE_ATTRIBUTE, SWITCHING_ATTRIBUTE, THEME_ATTRIBUTE, THEME_KEY } from "../styles.js";
// The announcer's own module, not `ui/index.js`: the collapsed pill loads no primitive's component.
import { Announcer } from "../ui/announcer/announcer.js";
import { PRIMITIVES_CSS } from "../ui/styles.js";
import { PATTERNS_CSS } from "../patterns/styles.js";

export type Theme = "light" | "dark";

/** The stylesheet's layers, in cascade order: a later layer wins over an earlier one. */
export const LAYERS = ["tokens", "primitives", "patterns"] as const;

/** On a host `<Surface>` draws: a workbench frame or a test's. */
export const SURFACE_ATTRIBUTE = "data-loupe-surface";

/**
 * The one stylesheet every surface adopts, every rule in a layer: the ground, then the
 * primitives, then the patterns. No view writes a rule of its own.
 */
export const STYLESHEET: string = [
  `@layer ${LAYERS.join(", ")};`,
  `@layer tokens {${GROUND_CSS}}`,
  `@layer primitives {\n${PRIMITIVES_CSS}\n}`,
  `@layer patterns {\n${PATTERNS_CSS}\n}`,
].join("\n");

/** One constructed sheet per document, shared by every surface in it. */
const sheets = new WeakMap<Document, CSSStyleSheet>();

/**
 * Gives a shadow root the stylesheet: adopted where the browser can construct one,
 * so every surface shares a single parsed sheet; a `<style>` otherwise (jsdom).
 */
export function adoptStylesheet(shadow: ShadowRoot): void {
  const doc = shadow.ownerDocument;
  const View = doc.defaultView as (Window & { CSSStyleSheet?: typeof CSSStyleSheet }) | null;
  if (View?.CSSStyleSheet && "adoptedStyleSheets" in shadow && "replaceSync" in View.CSSStyleSheet.prototype) {
    try {
      let sheet = sheets.get(doc);
      if (!sheet) {
        sheet = new View.CSSStyleSheet();
        sheet.replaceSync(STYLESHEET);
        sheets.set(doc, sheet);
      }
      if (!shadow.adoptedStyleSheets.includes(sheet)) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
      return;
    } catch {
      // A browser that has the API but refuses the sheet: the element below always works.
    }
  }
  const style = doc.createElement("style");
  style.textContent = STYLESHEET;
  shadow.prepend(style);
}

/** A host's shadow root with the stylesheet, its language and the reader's text size. */
export function attachSurface(host: HTMLElement): ShadowRoot {
  // Loupe's words are English whatever the app's `lang`: a screen reader reads them in an English voice.
  host.setAttribute("lang", "en");
  if (registerTextScale()) host.setAttribute(SCALE_ATTRIBUTE, "");
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  adoptStylesheet(shadow);
  return shadow;
}

type PropertyRegistry = { registerProperty?(definition: { name: string; syntax: string; inherits: boolean; initialValue: string }): void };

/**
 * Registers `--loupe-px` as a length, so `calc(1em / 16)` on the host resolves there,
 * once, to the reader's default text size over 16, and every font size follows it
 * (tokens.ts `size()`). True once it is registered, by this mount or an earlier one;
 * false where the browser can't, and the sizes then stay as written.
 */
export function registerTextScale(): boolean {
  const registry = (window as unknown as { CSS?: PropertyRegistry }).CSS;
  if (typeof registry?.registerProperty !== "function") return false;
  try {
    registry.registerProperty({ name: "--loupe-px", syntax: "<length>", inherits: true, initialValue: "1px" });
    return true;
  } catch (error) {
    // Registered already: a second surface, or a Fast Refresh.
    return error instanceof DOMException && error.name === "InvalidModificationError";
  }
}

/** The Toolbar's adapter: a host element on the body with an open shadow root. */
export function useToolbarSurface(): ShadowRoot | null {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    const host = document.createElement("div");
    host.setAttribute(HOST_ATTRIBUTE, "");
    const shadow = attachSurface(host);
    document.body.append(host);
    setRoot(shadow);
    return () => host.remove();
  }, []);
  return root;
}

/**
 * The in-place adapter: draws `children` inside a real shadow root, under the same
 * stylesheet, at a theme and, for the workbench, a text size of the reader's choosing.
 */
export function Surface({
  theme = "light",
  textSize,
  label,
  children,
}: {
  theme?: Theme;
  /** The reader's default text size in px, as their browser setting would make it: 20 for a larger one. */
  textSize?: number;
  /** Names the frame, for a page that draws several. */
  label?: string;
  children: ReactNode;
}) {
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const attach = useCallback((host: HTMLDivElement | null) => {
    if (host) setShadow(attachSurface(host));
  }, []);
  // On the host, an outer style wins over `:host { all: initial }`: the size the scale reads.
  const style: CSSProperties | undefined = textSize ? { fontSize: `${textSize}px` } : undefined;
  return (
    <div ref={attach} {...{ [SURFACE_ATTRIBUTE]: "", [THEME_ATTRIBUTE]: theme }} aria-label={label} role={label ? "group" : undefined} style={style}>
      {shadow &&
        createPortal(
          <SurfaceBoundary>
            <Announcer>{children}</Announcer>
          </SurfaceBoundary>,
          shadow,
        )}
    </div>
  );
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

/**
 * Catches a throw from anything drawn in a surface, so it stops at Loupe: the surface
 * goes blank and says why in the console, once, and the host's page carries on.
 */
export class SurfaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Loupe hit an error and stepped aside; the page is unaffected.", error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
