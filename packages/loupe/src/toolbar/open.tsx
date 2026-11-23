"use client";

// The open panel (2026-11-23, candidate 7 of the architecture review): everything that
// watches the page, and the panel itself, in a module of its own. `index.tsx` reaches it
// only through `loadPanel()` (`start.ts`), a dynamic import, so the host's bundler puts
// it in a chunk of its own and the collapsed pill never loads it: it loads on the first
// open, or earlier, on idle or with the pointer over the pill, so opening doesn't wait.
//
// The trackers the Proposal reads (`proposal.ts`, `numbers.ts`) start here too, on the
// first open, or on the first change made through `__loupe` with the panel closed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setOnKey } from "../proposal/build.js";
import { debugOf } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";
import type { Scope } from "../runtime/store.js";
import { useDeselect } from "./deselect.js";
import type { Column } from "./dock.js";
import { Highlight } from "./highlight.js";
import type { Theme } from "./index.js";
import { useInstanceMeta } from "./instance-meta.js";
import { useLayerStatus } from "./notices.js";
import { pageNumbering } from "./numbers.js";
import { usePageVersion } from "./page.js";
import { Panel } from "./panel.js";
import { panelView, type SeenComponents } from "./panel-view/index.js";
import { type SelectMode, usePicker } from "./picker.js";
import { startTracking } from "./proposal.js";
import type { FirstChange } from "./start.js";

export { collectProposal, collectProposalText } from "./proposal.js";

/**
 * Starts what the Proposal reads from the page: the tracker (what each Instance last
 * showed, and the route each record was set on) and the change numbering. Once per
 * page: starting again changes nothing, and `resetLoupe()` stops both.
 */
export function startTrackers(first?: FirstChange): void {
  const tracker = startTracking();
  // Made before the trackers loaded (`start.ts`): set on the route it was made on, if it is still there.
  if (first && registry().store.records().some((record) => setOnKey(record.target) === setOnKey(first.target))) {
    tracker.setOn[setOnKey(first.target)] ??= first.route;
  }
  // So changes number in the order they are made, even several made at once.
  pageNumbering();
}

export type ToolbarOpenProps = {
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
  /** Once the panel is on the page: focus can go to its heading now. */
  onShown(): void;
};

/** Everything that watches the page, mounted only while the panel is open. */
export function ToolbarOpen({
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
  onShown,
}: ToolbarOpenProps) {
  useEffect(() => startTrackers(), []);
  // After the panel's own effects: its heading is there to take focus.
  useEffect(onShown, [onShown]);
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
        closing={closing}
        theme={theme}
        onTheme={onTheme}
      />
    </>
  );
}
