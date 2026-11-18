// The version the Toolbar redraws on: it moves whenever the registry or the page
// changes. What the panel shows is `panelView()`'s to decide (PER-214), read
// through `debugOf()`.

import { useEffect, useState } from "react";
import { onRegistryChange } from "../runtime/registry.js";

/** A version that moves whenever the registry or the page's DOM changes, at most once a frame. */
export function usePageVersion(host: Element | null): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let frame = 0;
    const bump = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setVersion((n) => n + 1);
      });
    };
    const stop = onRegistryChange(bump);
    // Server-rendered Instances leave no trace in the registry: a navigation or a
    // refresh shows only in the DOM. The Toolbar's own nodes are in a shadow root,
    // which a MutationObserver on the body doesn't see.
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => !host?.contains(mutation.target))) bump();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      stop();
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [host]);
  return version;
}
