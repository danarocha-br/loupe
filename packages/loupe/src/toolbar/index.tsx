"use client";

// The Toolbar (PER-130): one fixed-height right-hand panel with a component list,
// selection by clicking the page or a row, and an inspector. It reaches the page
// only through `<LoupeMount />`'s development-only dynamic import, so a production
// build never holds this module.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Scope } from "../runtime/store.js";
import { Highlight } from "./highlight.js";
import { useInstanceMeta } from "./instance-meta.js";
import { Panel } from "./panel.js";
import { usePicker } from "./picker.js";
import { type SeenComponents, safeInspect, snapshot, useDebug, usePageVersion } from "./page.js";
import { scopeView } from "./scopes.js";
import { CSS, HOST_ATTRIBUTE } from "./styles.js";

export default function Toolbar() {
  const root = useShadowRoot();
  if (!root) return null;
  return createPortal(<ToolbarBody host={root.host} />, root);
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

function ToolbarBody({ host }: { host: Element }) {
  const [selected, setSelected] = useState<string | null>(null);
  // Never remembered: every selection opens at This instance (PER-90).
  const [scope, setScope] = useState<Scope>("instance");
  const [hidden, setHidden] = useState(false);
  const select = (id: string | null) => {
    setSelected(id);
    setScope("instance");
  };
  if (hidden) {
    return (
      <div className="dock">
        <button type="button" onClick={() => setHidden(false)}>
          Loupe
        </button>
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
}: {
  host: Element;
  selected: string | null;
  onSelect(id: string | null): void;
  scope: Scope;
  onScope(scope: Scope): void;
  onHide(): void;
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
        picking={picker.picking}
        onPick={picker.toggle}
        onHide={onHide}
      />
    </>
  );
}
