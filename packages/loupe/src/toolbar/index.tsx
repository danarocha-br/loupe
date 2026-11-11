"use client";

// The Toolbar (PER-130): one fixed-height right-hand panel with a component list,
// selection by clicking the page or a row, and an inspector. It reaches the page
// only through `<LoupeMount />`'s development-only dynamic import, so a production
// build never holds this module.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Highlight } from "./highlight.js";
import { Panel } from "./panel.js";
import { usePicker } from "./picker.js";
import { snapshot, useDebug, usePageVersion } from "./page.js";
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
  const debug = useDebug();
  const version = usePageVersion(host);
  const seen = useRef(new Set<string>()).current;
  const page = useMemo(() => snapshot(debug, seen), [debug, seen, version]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const picker = usePicker(debug, host, (id) => {
    setSelected(id);
    setHovered([]);
  });

  if (hidden) {
    return (
      <div className="dock">
        <button type="button" onClick={() => setHidden(false)}>
          Loupe
        </button>
      </div>
    );
  }

  const highlighted = picker.picking ? (picker.hovered ? [picker.hovered] : []) : hovered;
  return (
    <>
      <Highlight debug={debug} version={version} selected={selected} hovered={highlighted} />
      <Panel
        debug={debug}
        version={version}
        page={page}
        selected={selected}
        onSelect={setSelected}
        onHover={setHovered}
        picking={picker.picking}
        onPick={picker.toggle}
        onHide={() => {
          picker.stop();
          setHidden(true);
        }}
      />
    </>
  );
}
