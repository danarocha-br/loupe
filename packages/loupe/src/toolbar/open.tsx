"use client";

// The open panel (2026-11-23, candidate 7 of the architecture review): everything that
// watches the page, and the panel itself, in a module of its own. `index.tsx` reaches it
// only through `loadPanel()` (`start.ts`), a dynamic import, so the host's bundler puts
// it in a chunk of its own and the collapsed pill never loads it: it loads on the first
// open, or earlier, on idle or with the pointer over the pill, so opening doesn't wait.
//
// The trackers the Proposal reads (`tracker.ts`, `numbers.ts`) start on the first open
// here, unless the first change made through `__loupe` started them already (`start.ts`).

import { useEffect, useMemo, useRef } from "react";
import type { LayerStatus } from "../layer-status.js";
import { debugOf, type LoupeDebug } from "../runtime/debug.js";
import type { Scope } from "../runtime/store.js";
import { useDeselect } from "./deselect.js";
import type { Column } from "./dock.js";
import { Highlight } from "./highlight.js";
import type { Theme } from "./surface/index.js";
import { useInstanceMeta } from "./instance-meta.js";
import { useLayerStatus } from "./notices.js";
import { createPageSignal, PageSignalContext, usePageVersion } from "./page-signal.js";
import { Panel } from "./panel.js";
import { type PanelView, panelView, type SeenComponents } from "./panel-view/index.js";
import { type SelectMode, usePicker } from "./picker.js";
import { startTrackers } from "./start.js";
import { scopeOf, useToolbar, useToolbarStore } from "./toolbar-store.js";

export { collectProposal, collectProposalText } from "./proposal.js";

export type ToolbarOpenProps = {
  host: Element;
  column: Column;
  onHide(): void;
  closing: boolean;
  theme: Theme;
  onTheme(): void;
  /** Once the panel is on the page: focus can go to its heading now. */
  onShown(): void;
};

const NONE_SEEN: SeenComponents = { route: "", components: new Set() };

/**
 * What the panel shows, from `panelView()`. It takes what it returned last time and
 * returns the next: "Appears on interaction" remembers components across page versions,
 * and every row, group and word object that didn't change keeps its identity, so the
 * patterns given them skip their render (`panel-view/share.ts`). The last view is kept
 * in a ref read while rendering. That is why this is a hook of its own: React Compiler
 * skips a function that reads a ref in render, and the skip stays here rather than
 * taking `ToolbarOpen` with it, whose memoised `<Panel>` keeps a hover from
 * re-rendering the whole Panel (ADR 0003, `hover-render.test.tsx`).
 */
function usePanelView(debug: LoupeDebug, layer: LayerStatus | null, selected: string | null, scope: Scope, version: number): PanelView {
  const last = useRef<PanelView | null>(null);
  // `version` is the trigger: it moves whenever the registry or the page changes.
  const view = useMemo(() => {
    const previous = last.current;
    return panelView({ debug, layer, selected, scope, seen: previous?.seen ?? NONE_SEEN, previous });
  }, [debug, layer, selected, scope, version]);
  last.current = view;
  return view;
}

/**
 * Everything that watches the page, mounted only while the panel is open. The selection
 * and its tool are the Toolbar's store's (toolbar-store.ts); what a row points at goes
 * from the panel's rows to the outlines through it, not through here.
 */
export function ToolbarOpen({ host, column, onHide, closing, theme, onTheme, onShown }: ToolbarOpenProps) {
  const store = useToolbarStore();
  const selected = useToolbar((state) => state.selected);
  const mode = useToolbar((state) => state.mode);
  const scope = useToolbar(scopeOf);
  // What a row or a block pointed at goes with the panel, as this component's own state
  // did: an element the panel removes says no leave or blur, and the store outlives it.
  useEffect(() => () => store.hover([]), [store]);
  useEffect(startTrackers, []);
  // After the panel's own effects: its heading is there to take focus.
  useEffect(onShown, [onShown]);
  // An inline function: React Compiler skips a component whose useMemo takes a reference.
  const debug = useMemo(() => debugOf(), []);
  // Awake while the panel is open: collapsed, the Toolbar watches nothing on the page.
  const signal = useMemo(() => createPageSignal({ doc: document, debug: () => debug, host: () => host }), [debug, host]);
  const version = usePageVersion(signal);
  const layer = useLayerStatus(version);
  const view = usePanelView(debug, layer, selected, scope, version);
  useInstanceMeta(view.metaAnchor);
  const picker = usePicker(debug, host, (id) => {
    store.select(id);
    store.hover([]);
  });
  // A select tool sets the scope at once, for the selection there is, and arms picking
  // for the next one; pressed again while picking, it stops.
  const tool = (next: SelectMode) => {
    if (picker.picking && next === mode) {
      picker.stop();
      return;
    }
    store.setScope(next === "one" ? "instance" : "group");
    if (!picker.picking) picker.start();
  };
  // Esc, or a click on the page outside what is selected, goes back to the list.
  const selection = useMemo(
    () => (selected === null ? [] : [selected, ...(view.outline.members ?? []).map((member) => member.id)]),
    [selected, view.outline.members],
  );
  useDeselect({ debug, host, ids: selection, active: selected !== null && !picker.picking, onDeselect: () => store.select(null) });

  return (
    <PageSignalContext value={signal}>
      <Highlight
        debug={debug}
        signal={signal}
        version={version}
        selected={selected}
        selectedLabel={view.outline.label}
        members={view.outline.members}
        marks={view.marks}
        pick={picker.picking ? { hovered: picker.hovered, mode } : null}
      />
      <Panel
        debug={debug}
        view={view}
        column={column}
        picking={picker.picking}
        onTool={tool}
        onHide={onHide}
        closing={closing}
        theme={theme}
        onTheme={onTheme}
      />
    </PageSignalContext>
  );
}
