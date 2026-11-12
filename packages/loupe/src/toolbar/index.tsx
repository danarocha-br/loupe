"use client";

// The Toolbar (PER-130): one right-hand panel with a component list, selection by
// clicking the page or a row, and an inspector, over a dock at the bottom right
// (PER-140). It reaches the page only through `<LoupeMount />`'s development-only
// dynamic import, so a production build never holds this module.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Scope } from "../runtime/store.js";
import { Highlight } from "./highlight.js";
import { CaptureIcon, CursorIcon, LayersIcon, PanelIcon } from "./icons.js";
import { useInstanceMeta } from "./instance-meta.js";
import { Panel } from "./panel.js";
import { usePicker } from "./picker.js";
import { type SeenComponents, safeInspect, snapshot, useDebug, usePageVersion } from "./page.js";
import { scopeView } from "./scopes.js";
import { useCapture } from "./snapshots-card.js";
import { CSS, HOST_ATTRIBUTE, THEME_ATTRIBUTE, THEME_KEY } from "./styles.js";

export type Theme = "light" | "dark";

export default function Toolbar() {
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
  // Before paint, so a dark system never sees one light frame.
  useLayoutEffect(() => host.setAttribute(THEME_ATTRIBUTE, theme), [host, theme]);
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
  // Never remembered: every selection opens at This instance (PER-90).
  const [scope, setScope] = useState<Scope>("instance");
  const [hidden, setHidden] = useState(false);
  const [theme, toggleTheme] = useTheme(host);
  const select = (id: string | null) => {
    setSelected(id);
    setScope("instance");
  };
  if (hidden) {
    return (
      <div className="dock">
        <div className="capsule">
          <div className="inner">
            <button type="button" className="btn" onClick={() => setHidden(false)} title="Show the Loupe panel">
              <PanelIcon />
              Loupe
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <ToolbarOpen
      host={host}
      selected={selected}
      onSelect={select}
      scope={scope}
      onScope={setScope}
      onHide={() => setHidden(true)}
      theme={theme}
      onTheme={toggleTheme}
    />
  );
}

/** Everything that watches the page, mounted only while the panel is open. */
function ToolbarOpen({
  host,
  selected,
  onSelect,
  scope,
  onScope,
  onHide,
  theme,
  onTheme,
}: {
  host: Element;
  selected: string | null;
  onSelect(id: string | null): void;
  scope: Scope;
  onScope(scope: Scope): void;
  onHide(): void;
  theme: Theme;
  onTheme(): void;
}) {
  const debug = useDebug();
  const version = usePageVersion(host);
  const seen = useRef<SeenComponents>({ route: "", components: new Set() }).current;
  const page = useMemo(() => snapshot(debug, seen), [debug, seen, version]);
  useInstanceMeta(page, selected);
  const [hovered, setHovered] = useState<string[]>([]);
  const picker = usePicker(debug, host, (id) => {
    onSelect(id);
    setHovered([]);
  });
  const selectedLabel = selected === null ? null : (safeInspect(debug, selected)?.component ?? null);
  const view = useMemo(() => {
    if (selected === null || scope === "instance" || !debug.status.overrides) return null;
    const row = page.rows.find((candidate) => candidate.id === selected && candidate.adapted);
    return row ? scopeView(debug, page.rows, page.records, row, scope) : null;
  }, [debug, page, selected, scope]);
  // The Instance left (its dialog closed, say): when it comes back it opens at This instance.
  useEffect(() => {
    if (scope !== "instance" && view === null) onScope("instance");
  }, [scope, view, onScope]);
  const instances = page.groups.reduce((sum, group) => sum + group.instances.length, 0);

  return (
    <>
      <Highlight
        debug={debug}
        version={version}
        selected={selected}
        selectedLabel={selectedLabel}
        hovered={picker.picking ? (picker.hovered ? [picker.hovered] : []) : hovered}
        members={view && !picker.picking ? view.members : null}
      />
      <Panel
        debug={debug}
        version={version}
        page={page}
        selected={selected}
        onSelect={onSelect}
        scope={view ? scope : "instance"}
        onScope={onScope}
        view={view}
        onHover={setHovered}
        onHide={onHide}
        theme={theme}
        onTheme={onTheme}
      />
      <Dock
        picking={picker.picking}
        onPick={picker.toggle}
        listing={selected === null}
        instances={instances}
        onList={() => onSelect(null)}
        onHide={onHide}
      />
    </>
  );
}

/** Pick, back to the component list, hide the panel and Capture screen, with what is under way beside them. */
function Dock({
  picking,
  onPick,
  listing,
  instances,
  onList,
  onHide,
}: {
  picking: boolean;
  onPick(): void;
  listing: boolean;
  instances: number;
  onList(): void;
  onHide(): void;
}) {
  const { busy, run } = useCapture();
  const toast =
    busy.capturing !== null ? (
      <>
        <span className="dot purple" />
        Capturing… before/after of the screen in view
      </>
    ) : busy.error !== null ? (
      <>
        <span className="dot red" />
        Capture failed: {busy.error}
      </>
    ) : picking ? (
      <>
        <span className="dot purple" />
        Click an Instance on the page · <kbd>Esc</kbd> cancels
      </>
    ) : null;
  return (
    <div className="dock">
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <div className="capsule">
        <div className="inner">
          <button
            type="button"
            className="btn round"
            aria-pressed={picking}
            onClick={onPick}
            title="Click an Instance on the page (Esc cancels)"
          >
            <CursorIcon />
            <span className="sr-only">Pick</span>
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={listing && !picking}
            onClick={onList}
            title="Every component on this page"
          >
            <LayersIcon />
            <span className="n">{instances}</span>
            <span className="sr-only"> Instances: all components</span>
          </button>
          <span className="sep" />
          <button type="button" className="btn round" onClick={onHide} title="Hide the panel">
            <PanelIcon />
            <span className="sr-only">Hide the panel</span>
          </button>
          <button
            type="button"
            className="btn round"
            disabled={picking || busy.capturing !== null}
            title={busy.error ?? "A before/after Snapshot of the screen in view, for the Proposal"}
            onClick={() => run()}
          >
            <CaptureIcon />
            <span className="sr-only">
              {busy.capturing !== null ? "Capturing…" : busy.error !== null ? "Capture failed" : "Capture screen"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
