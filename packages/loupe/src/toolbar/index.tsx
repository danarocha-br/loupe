"use client";

// The Toolbar (PER-130): one panel with a component list, selection by clicking the
// page or a row, and an inspector. Since the 2026-11-19 critique it is a column the
// page makes room for (`dock.ts`), with the select tools in its
// header (2026-11-20: one Instance or its whole call site, as Figma selects), so
// nothing of it covers the product but the outlines and the revision marks. It
// reaches the page only through `<LoupeMount />`'s development-only dynamic import,
// so a production build never holds this module.
//
// This module is the collapsed pill's (2026-11-23): the shadow root, the theme, the
// column and whether the panel is open. The open panel is a module of its own
// (`open.tsx`), loaded through `lazy()`, so the host's bundler splits it off and a
// page with Loupe collapsed doesn't load it until it is opened, or preloaded on idle.

import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { Scope } from "../runtime/store.js";
import { columnWidthFor, releaseColumn, reserveColumn, useColumn } from "./dock.js";
import { Launcher } from "./launcher.js";
import { OPEN_KEY } from "./launcher-place.js";
import type { SelectMode } from "./picker.js";
import { loadedPanel, loadPanel, preloadPanelWhenIdle, startToolbar } from "./start.js";
import { CSS, HOST_ATTRIBUTE, SCALE_ATTRIBUTE, SWITCHING_ATTRIBUTE, THEME_ATTRIBUTE, THEME_KEY } from "./styles.js";

export type Theme = "light" | "dark";

export default function Toolbar() {
  useEffect(startToolbar, []);
  const root = useShadowRoot();
  if (!root) return null;
  return createPortal(<ToolbarBody host={root.host as HTMLElement} />, root);
}

/** A host element on the body with an open shadow root, so the app's CSS can't reach the Toolbar. */
function useShadowRoot(): ShadowRoot | null {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    const host = document.createElement("div");
    host.setAttribute(HOST_ATTRIBUTE, "");
    // Loupe's words are English whatever the app's `lang`: a screen reader reads them in an English voice.
    host.setAttribute("lang", "en");
    if (registerTextScale()) host.setAttribute(SCALE_ATTRIBUTE, "");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.append(style);
    document.body.append(host);
    setRoot(shadow);
    return () => host.remove();
  }, []);
  return root;
}

type PropertyRegistry = { registerProperty?(definition: { name: string; syntax: string; inherits: boolean; initialValue: string }): void };

/**
 * Registers `--loupe-px` as a length, so `calc(1em / 16)` on the host resolves there,
 * once, to the reader's default text size over 16, and every font size follows it
 * (styles.ts `size()`). True once it is registered, by this mount or an earlier one;
 * false where the browser can't, and the sizes then stay as written.
 */
function registerTextScale(): boolean {
  // `CSS` here is the stylesheet: the browser's CSS namespace is the window's.
  const registry = (window as unknown as { CSS?: PropertyRegistry }).CSS;
  if (typeof registry?.registerProperty !== "function") return false;
  try {
    registry.registerProperty({ name: "--loupe-px", syntax: "<length>", inherits: true, initialValue: "1px" });
    return true;
  } catch (error) {
    // Registered already: a second mount, or a Fast Refresh.
    return error instanceof DOMException && error.name === "InvalidModificationError";
  }
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
 * Light or dark: the OS preference, until the header's toggle picks one, which
 * this browser then remembers for every app on the origin.
 */
function useTheme(host: HTMLElement): [Theme, () => void] {
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
    const panel = host.shadowRoot?.querySelector(".panel");
    // Reading a style makes the browser apply the new theme now, with transitions still off.
    if (panel) void getComputedStyle(panel).opacity;
    const timer = setTimeout(() => host.removeAttribute(SWITCHING_ATTRIBUTE), 1);
    return () => clearTimeout(timer);
  }, [host, theme]);
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

/** Open or closed, as it was left in this browser: closed on a first visit. */
function storedOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "open";
  } catch {
    return false;
  }
}

function keepOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
  } catch {
    // Not remembered: the next page load starts closed.
  }
}

/**
 * The open panel, when it opens before its module has loaded: a Suspense boundary's
 * fallback is nothing. A new one each time, since `lazy()` keeps a failed load: the
 * next open tries the module again (`loadPanel()` forgets a failure too).
 */
const lazyToolbarOpen = () => lazy(() => loadPanel().then((panel) => ({ default: panel.ToolbarOpen })));

/**
 * Keeps a failure of the panel's inside Loupe: its module not loading (the dev server
 * restarting, a chunk gone stale), or the panel throwing as it renders. The host's page
 * never sees it; Loupe folds back to its pill, and the next click tries again.
 */
class PanelBoundary extends Component<{ onFail(error: unknown): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onFail(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The drawer's close and the handle's tuck (styles.ts `.panel.closing`, `.launcher.leaving`). */
const CLOSE_MS = 220;
const TUCK_MS = 160;

/** Whether the page can play the open and close: none in a test's DOM, where they would only wait. */
function animates(): boolean {
  return typeof matchMedia === "function";
}

/** With the pointer over the pill, or focus on it: it is about to be opened. */
const preload = () => void loadPanel().catch(() => {});

function ToolbarBody({ host }: { host: HTMLElement }) {
  const [selected, setSelected] = useState<string | null>(null);
  // The header's select tool (2026-11-20): one Instance, or every Instance from its
  // call site, as Figma selects. It stays as chosen across selections for the page load.
  const [mode, setMode] = useState<SelectMode>("one");
  // Select multiple, widened to every Instance of the component on the page. A new selection starts at its call site again.
  const [widened, setWidened] = useState(false);
  const scope: Scope = mode === "one" ? "instance" : widened ? "page" : "group";
  const [hidden, setHidden] = useState(() => !storedOpen());
  // A handle and its drawer: opening tucks the pill into its side while the panel slides
  // out of its own; closing slides the panel back out of the window, and once it has gone
  // the page takes its column back and the pill slides out of its side again.
  const [closing, setClosing] = useState(false);
  const [tucking, setTucking] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tuckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
      clearTimeout(tuckTimer.current);
    },
    [],
  );
  const open = () => {
    focusSwap.current = focusIsHere();
    // Before the panel renders: the page map measures the page as it will be beside it.
    reserveColumn(columnWidthFor(window.innerWidth));
    keepOpen(true);
    setHidden(false);
    if (!animates()) return;
    setTucking(true);
    clearTimeout(tuckTimer.current);
    tuckTimer.current = setTimeout(() => setTucking(false), TUCK_MS);
  };
  const hide = () => {
    if (closing) return;
    focusSwap.current = focusIsHere();
    keepOpen(false);
    if (!animates()) {
      releaseColumn();
      setHidden(true);
      return;
    }
    // Mid-open, the panel's slide turns round from where it is (a transition, not a timeline).
    setClosing(true);
    const panel = host.shadowRoot?.querySelector<HTMLElement>(".panel") ?? null;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      panel?.removeEventListener("transitionend", onEnd);
      clearTimeout(closeTimer.current);
      // In the same task as the unmount: the page widens in the frame the panel goes.
      releaseColumn();
      flushSync(() => {
        setClosing(false);
        setHidden(true);
      });
    };
    // Ends on the slide's own end (the fade's, under reduced motion), not on a clock.
    const onEnd = (event: TransitionEvent) => {
      if (event.target === panel && (event.propertyName === "translate" || event.propertyName === "opacity")) finish();
    };
    panel?.addEventListener("transitionend", onEnd);
    // In case the end never comes (a hidden tab, a theme switch cancelling transitions).
    closeTimer.current = setTimeout(finish, CLOSE_MS + 80);
  };
  // Hide marks (2026-11-20): the selection's outlines and the revision clouds come off
  // the page, so a change can be judged as it will ship. Kept for the page load.
  const [marksHidden, setMarksHidden] = useState(false);
  const [theme, toggleTheme] = useTheme(host);
  const column = useColumn(!hidden);
  // Hide and Show swap the panel for its tab: focus goes with them when it was on the one
  // pressed, so a keyboard isn't dropped on the page (review 2026-11-20).
  const focusSwap = useRef(false);
  useEffect(() => {
    if (!hidden || !focusSwap.current) return;
    focusSwap.current = false;
    host.shadowRoot?.querySelector<HTMLElement>(".launcher")?.focus();
  }, [hidden, host]);
  // To the heading once the panel is there: on the click itself, or once its module has loaded.
  const shown = useCallback(() => {
    if (!focusSwap.current) return;
    focusSwap.current = false;
    host.shadowRoot?.querySelector<HTMLElement>("h2.name")?.focus();
  }, [host]);
  // While collapsed, the panel's module loads when the page is idle, so opening doesn't wait for it.
  useEffect(() => (hidden ? preloadPanelWhenIdle() : undefined), [hidden]);
  // Loaded already, it renders in the click; else through `lazy()`. Chosen as it opens, so it never remounts while open.
  const ToolbarOpen = useMemo(() => (hidden ? null : (loadedPanel()?.ToolbarOpen ?? lazyToolbarOpen())), [hidden]);
  // The panel failed to load or to render: the page gets its column back and the pill
  // comes back, with focus if the panel had it. Open stays kept: a reload tries again.
  const failed = (error: unknown) => {
    console.warn("[loupe] The panel couldn't open; click the Loupe pill to try again.", error);
    focusSwap.current ||= focusIsHere();
    clearTimeout(tuckTimer.current);
    releaseColumn();
    setTucking(false);
    setClosing(false);
    setHidden(true);
  };
  const focusIsHere = () => (host.shadowRoot?.activeElement ?? null) !== null;
  const select = (id: string | null, next?: SelectMode) => {
    setSelected(id);
    setWidened(false);
    if (next) setMode(next);
  };
  const changeScope = (next: Scope) => {
    setMode(next === "instance" ? "one" : "many");
    setWidened(next === "page");
  };
  return (
    <>
      {(hidden || tucking) && <Launcher leaving={!hidden} onOpen={open} onPreload={preload} />}
      {ToolbarOpen && (
        <PanelBoundary onFail={failed}>
          <Suspense fallback={null}>
            <ToolbarOpen
              host={host}
              column={column}
              selected={selected}
              onSelect={select}
              mode={mode}
              scope={scope}
              onScope={changeScope}
              marksHidden={marksHidden}
              onMarks={() => setMarksHidden((was) => !was)}
              onHide={hide}
              closing={closing}
              theme={theme}
              onTheme={toggleTheme}
              onShown={shown}
            />
          </Suspense>
        </PanelBoundary>
      )}
    </>
  );
}
