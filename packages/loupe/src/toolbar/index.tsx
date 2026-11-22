"use client";

// The Toolbar (PER-130): one panel with a component list, selection by clicking the
// page or a row, and an inspector. Since the 2026-11-19 critique it is a column the
// page makes room for (`dock.ts`), with the select tools in its
// header (2026-11-20: one Instance or its whole call site, as Figma selects), so
// nothing of it covers the product but the outlines and the revision marks. It
// reaches the page only through `<LoupeMount />`'s development-only dynamic import,
// so a production build never holds this module.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { debugOf } from "../runtime/debug.js";
import type { Scope } from "../runtime/store.js";
import { useDeselect } from "./deselect.js";
import { type Column, useColumn } from "./dock.js";
import { Highlight } from "./highlight.js";
import { useInstanceMeta } from "./instance-meta.js";
import { Launcher } from "./launcher.js";
import { useLayerStatus } from "./notices.js";
import { usePageVersion } from "./page.js";
import { Panel } from "./panel.js";
import { panelView, type SeenComponents } from "./panel-view/index.js";
import { type SelectMode, usePicker } from "./picker.js";
import { startToolbar } from "./start.js";
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

function ToolbarBody({ host }: { host: HTMLElement }) {
  const [selected, setSelected] = useState<string | null>(null);
  // The header's select tool (2026-11-20): one Instance, or every Instance from its
  // call site, as Figma selects. It stays as chosen across selections for the page load.
  const [mode, setMode] = useState<SelectMode>("one");
  // Select multiple, widened to every Instance of the component on the page. A new selection starts at its call site again.
  const [widened, setWidened] = useState(false);
  const scope: Scope = mode === "one" ? "instance" : widened ? "page" : "group";
  const [hidden, setHidden] = useState(false);
  // Hide marks (2026-11-20): the selection's outlines and the revision clouds come off
  // the page, so a change can be judged as it will ship. Kept for the page load.
  const [marksHidden, setMarksHidden] = useState(false);
  const [theme, toggleTheme] = useTheme(host);
  const column = useColumn(!hidden);
  // Hide and Show swap the panel for its tab: focus goes with them when it was on the one
  // pressed, so a keyboard isn't dropped on the page (review 2026-11-20).
  const focusSwap = useRef(false);
  useEffect(() => {
    if (!focusSwap.current) return;
    focusSwap.current = false;
    host.shadowRoot?.querySelector<HTMLElement>(hidden ? ".launcher" : "h2.name")?.focus();
  }, [hidden, host]);
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
  if (hidden) {
    return (
      <Launcher
        onOpen={() => {
          focusSwap.current = focusIsHere();
          setHidden(false);
        }}
      />
    );
  }
  return (
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
      onHide={() => {
        focusSwap.current = focusIsHere();
        setHidden(true);
      }}
      theme={theme}
      onTheme={toggleTheme}
    />
  );
}

/** Everything that watches the page, mounted only while the panel is open. */
function ToolbarOpen({
  host,
  column,
  selected,
  onSelect,
  mode,
  scope,
  onScope,
  marksHidden,
  onMarks,
  onHide,
  theme,
  onTheme,
}: {
  host: Element;
  column: Column;
  selected: string | null;
  onSelect(id: string | null, mode?: SelectMode): void;
  mode: SelectMode;
  scope: Scope;
  onScope(scope: Scope): void;
  marksHidden: boolean;
  onMarks(): void;
  onHide(): void;
  theme: Theme;
  onTheme(): void;
}) {
  const debug = useMemo(debugOf, []);
  const version = usePageVersion(host);
  const layer = useLayerStatus(version);
  // "Appears on interaction" remembers components across page versions: `panelView()`
  // takes what it returned last time and returns the next.
  const seen = useRef<SeenComponents>({ route: "", components: new Set() });
  // `version` is the trigger: it moves whenever the registry or the page changes.
  const view = useMemo(
    () => panelView({ debug, layer, selected, scope, seen: seen.current }),
    [debug, layer, selected, scope, version],
  );
  seen.current = view.seen;
  useInstanceMeta(view.metaAnchor);
  const [hovered, setHovered] = useState<string[]>([]);
  // A row's hover can repeat as the pointer crosses its children: the same Instances change nothing.
  const hover = useCallback(
    (ids: string[]) => setHovered((previous) => (previous.length === ids.length && previous.every((id, i) => id === ids[i]) ? previous : ids)),
    [],
  );
  const picker = usePicker(debug, host, (id) => {
    onSelect(id);
    setHovered([]);
  });
  // A select tool sets the scope at once, for the selection there is, and arms picking
  // for the next one; pressed again while picking, it stops.
  const tool = (next: SelectMode) => {
    if (picker.picking && next === mode) {
      picker.stop();
      return;
    }
    onScope(next === "one" ? "instance" : "group");
    if (!picker.picking) picker.start();
  };
  // Esc, or a click on the page outside what is selected, goes back to the list.
  const selection = useMemo(
    () => (selected === null ? [] : [selected, ...(view.outline.members ?? []).map((member) => member.id)]),
    [selected, view.outline.members],
  );
  useDeselect({ debug, host, ids: selection, active: selected !== null && !picker.picking, onDeselect: () => onSelect(null) });

  return (
    <>
      <Highlight
        debug={debug}
        version={version}
        selected={selected}
        selectedLabel={view.outline.label}
        hovered={hovered}
        members={view.outline.members}
        marks={view.marks}
        pick={picker.picking ? { hovered: picker.hovered, mode } : null}
        marksHidden={marksHidden}
      />
      <Panel
        debug={debug}
        view={view}
        layer={layer}
        column={column}
        mode={mode}
        picking={picker.picking}
        onTool={tool}
        onSelect={onSelect}
        onScope={onScope}
        onHover={hover}
        marksHidden={marksHidden}
        onMarks={onMarks}
        onHide={onHide}
        theme={theme}
        onTheme={onTheme}
      />
    </>
  );
}
