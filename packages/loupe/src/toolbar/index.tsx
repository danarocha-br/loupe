"use client";

// The Toolbar (PER-130): one panel with a component list, selection by clicking the
// page or a row, and an inspector. Since the 2026-11-19 critique it is a column the
// page makes room for (`dock.ts`), with the select tools in its
// header (2026-11-20: one Instance or its whole call site, as Figma selects), so
// nothing of it covers the product but the outlines and the revision marks. It
// reaches the page only through `<LoupeMount />`'s development-only dynamic import,
// so a production build never holds this module.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { LayerStatus } from "../layer-status.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import type { Scope } from "../runtime/store.js";
import { useDeselect } from "./deselect.js";
import { type Column, columnWidthFor, releaseColumn, reserveColumn, useColumn } from "./dock.js";
import { Highlight } from "./highlight.js";
import { useInstanceMeta } from "./instance-meta.js";
import { Launcher } from "./launcher.js";
import { useLayerStatus } from "./notices.js";
import { usePageVersion } from "./page.js";
import { Panel } from "./panel.js";
import { type PanelView, panelView, type SeenComponents } from "./panel-view/index.js";
import { type SelectMode, usePicker } from "./picker.js";
import { startToolbar } from "./start.js";
import { SurfaceBoundary, type Theme, useTheme, useToolbarSurface } from "./surface/index.js";

export type { Theme } from "./surface/index.js";

export default function Toolbar() {
  return (
    <SurfaceBoundary>
      <ToolbarSurface />
    </SurfaceBoundary>
  );
}

function ToolbarSurface() {
  useEffect(startToolbar, []);
  const root = useToolbarSurface();
  if (!root) return null;
  return createPortal(<ToolbarBody host={root.host as HTMLElement} />, root);
}

/** The drawer's close and the handle's tuck (styles.ts `.panel.closing`, `.launcher.leaving`). */
const CLOSE_MS = 220;
const TUCK_MS = 160;

/** Whether the page can play the open and close: none in a test's DOM, where they would only wait. */
function animates(): boolean {
  return typeof matchMedia === "function";
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
    setHidden(false);
    if (!animates()) return;
    setTucking(true);
    clearTimeout(tuckTimer.current);
    tuckTimer.current = setTimeout(() => setTucking(false), TUCK_MS);
  };
  const hide = () => {
    if (closing) return;
    focusSwap.current = focusIsHere();
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
  const [theme, toggleTheme] = useTheme(host, ".panel");
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
  return (
    <>
      {(hidden || tucking) && <Launcher leaving={!hidden} onOpen={open} />}
      {!hidden && (
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
        />
      )}
    </>
  );
}

/**
 * What the panel shows, from `panelView()`. "Appears on interaction" remembers components
 * across page versions: `panelView()` takes what it returned last time and returns the
 * next, kept in a ref read while rendering. That is why this is a hook of its own: React
 * Compiler skips a function that reads a ref in render, and the skip stays here rather
 * than taking `ToolbarOpen` with it, whose memoised `<Panel>` keeps a hover from
 * re-rendering the whole Panel (ADR 0003).
 */
function usePanelView(debug: LoupeDebug, layer: LayerStatus | null, selected: string | null, scope: Scope, version: number): PanelView {
  const seen = useRef<SeenComponents>({ route: "", components: new Set() });
  // `version` is the trigger: it moves whenever the registry or the page changes.
  const view = useMemo(() => panelView({ debug, layer, selected, scope, seen: seen.current }), [debug, layer, selected, scope, version]);
  seen.current = view.seen;
  return view;
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
  closing,
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
  closing: boolean;
  theme: Theme;
  onTheme(): void;
}) {
  // An inline function: React Compiler skips a component whose useMemo takes a reference.
  const debug = useMemo(() => debugOf(), []);
  const version = usePageVersion(host);
  const layer = useLayerStatus(version);
  const view = usePanelView(debug, layer, selected, scope, version);
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
        closing={closing}
        theme={theme}
        onTheme={onTheme}
      />
    </>
  );
}
