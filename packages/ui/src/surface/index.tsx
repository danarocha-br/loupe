// The surface: the shadow root the primitives draw in, and what it carries with it: the
// layered stylesheet, the reader's text size and the language (ADR 0003, 0010). The
// primitives' CSS applies only inside one. A consumer brings the stylesheet's top layer
// (Loupe's patterns) and its own host; this module is the rest:
// - `stylesheet()` assembles `@layer tokens, primitives, patterns`;
// - `attachSurface()` gives a host a shadow root under it;
// - `<Surface>` draws anything in place inside one, for a test or a workbench.
// Whatever renders in a `<Surface>` does so inside `SurfaceBoundary`: a throw takes the
// surface down, never the host's layout. And beside the `Announcer`'s two live regions,
// mounted with the surface, before anything in it has something to say.

import { Component, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useState } from "react";
import { createPortal } from "react-dom";
// The announcer's own module, not `index.js`: a consumer's collapsed chrome loads no primitive's component.
import { Announcer } from "../announcer/announcer.js";
import { PRIMITIVES_CSS } from "../styles.js";
import type { Theme } from "../tokens.js";
import { GROUND_CSS, SCALE_ATTRIBUTE, THEME_ATTRIBUTE } from "./ground.js";

export type { Theme } from "../tokens.js";
export { GROUND_CSS, SCALE_ATTRIBUTE, SWITCHING_ATTRIBUTE, THEME_ATTRIBUTE } from "./ground.js";

/** The stylesheet's layers, in cascade order: a later layer wins over an earlier one. */
export const LAYERS = ["tokens", "primitives", "patterns"] as const;

/** On a host `<Surface>` draws: a workbench frame or a test's. */
export const SURFACE_ATTRIBUTE = "data-loupe-surface";

/**
 * The one stylesheet a surface adopts, every rule in a layer: the ground, then the
 * primitives, then `patterns`, the consumer's compositions of them. With none, the
 * system alone, with its top layer declared and empty.
 */
export function stylesheet(patterns = ""): string {
  return [
    `@layer ${LAYERS.join(", ")};`,
    `@layer tokens {${GROUND_CSS}}`,
    `@layer primitives {\n${PRIMITIVES_CSS}\n}`,
    `@layer patterns {\n${patterns}\n}`,
  ].join("\n");
}

/** The system alone: the ground and the primitives. What this package's own tests draw in. */
export const SYSTEM_STYLESHEET: string = stylesheet();

/** One constructed sheet per document and stylesheet, shared by every surface in it. */
const sheets = new WeakMap<Document, Map<string, CSSStyleSheet>>();

/** The sheet, or the `<style>`, each shadow root took from `adoptStylesheet`: replaced when the stylesheet changes, never stacked. */
const ownedSheet = new WeakMap<ShadowRoot, CSSStyleSheet>();
const ownedStyle = new WeakMap<ShadowRoot, HTMLStyleElement>();

/**
 * Gives a shadow root `css`: adopted where the browser can construct a sheet, so every
 * surface shares a single parsed one; a `<style>` otherwise (jsdom). A second call with
 * other `css` replaces what the first put there, in its place, and leaves any other sheet
 * the root holds alone.
 */
export function adoptStylesheet(shadow: ShadowRoot, css: string): void {
  const doc = shadow.ownerDocument;
  const View = doc.defaultView as (Window & { CSSStyleSheet?: typeof CSSStyleSheet }) | null;
  if (View?.CSSStyleSheet && "adoptedStyleSheets" in shadow && "replaceSync" in View.CSSStyleSheet.prototype) {
    try {
      let byCss = sheets.get(doc);
      if (!byCss) {
        byCss = new Map();
        sheets.set(doc, byCss);
      }
      let sheet = byCss.get(css);
      if (!sheet) {
        sheet = new View.CSSStyleSheet();
        sheet.replaceSync(css);
        byCss.set(css, sheet);
      }
      const adopted = [...shadow.adoptedStyleSheets];
      const previous = ownedSheet.get(shadow);
      const at = previous ? adopted.indexOf(previous) : -1;
      if (at >= 0) adopted[at] = sheet;
      else if (!adopted.includes(sheet)) adopted.push(sheet);
      shadow.adoptedStyleSheets = adopted;
      ownedSheet.set(shadow, sheet);
      return;
    } catch {
      // A browser that has the API but refuses the sheet: the element below always works.
    }
  }
  const previous = ownedStyle.get(shadow);
  if (previous?.parentNode === shadow) {
    previous.textContent = css;
    return;
  }
  const style = doc.createElement("style");
  style.textContent = css;
  shadow.prepend(style);
  ownedStyle.set(shadow, style);
}

/** A host's shadow root with `css`, its language and the reader's text size. */
export function attachSurface(host: HTMLElement, css: string): ShadowRoot {
  // Loupe's words are English whatever the app's `lang`: a screen reader reads them in an English voice.
  host.setAttribute("lang", "en");
  if (registerTextScale()) host.setAttribute(SCALE_ATTRIBUTE, "");
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  adoptStylesheet(shadow, css);
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

export type SurfaceProps = {
  /** The stylesheet it adopts: `stylesheet(patterns)`. The system alone if none is given. */
  stylesheet?: string;
  theme?: Theme;
  /** The reader's default text size in px, as their browser setting would make it: 20 for a larger one. */
  textSize?: number;
  /** Names the frame, for a page that draws several. */
  label?: string;
  children: ReactNode;
};

/**
 * The in-place adapter: draws `children` inside a real shadow root, under a stylesheet,
 * at a theme and, for a workbench, a text size of the reader's choosing.
 */
export function Surface({ stylesheet: css = SYSTEM_STYLESHEET, theme = "light", textSize, label, children }: SurfaceProps) {
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const attach = useCallback(
    (host: HTMLDivElement | null) => {
      if (host) setShadow(attachSurface(host, css));
    },
    [css],
  );
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
