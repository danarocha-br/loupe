// The Product layer's status for its notices (PER-133, PER-179, PER-227): read from the
// dev server when the panel opens, when the window gets focus back and after the page
// changes. What the notices say is panel-view's (`notices.ts`), and the cards are
// patterns/notice/'s.

import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerStatus } from "../layer-status.js";
import { formatNotice } from "../format-notice.js";
import { readProductLayerStatus } from "./layer-server.js";
import { warnOnce } from "./warn-once.js";

/** At most one check this often while the page keeps changing; each one stats the sources. */
const MIN_INTERVAL_MS = 2000;

/**
 * The Product layer's status, checked when the panel opens, when the window gets
 * focus back (from the editor, typically) and after the page changes.
 */
export function useLayerStatus(version: number): LayerStatus | null {
  const [status, setStatus] = useState<LayerStatus | null>(null);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reads only refs and the state setter, so one closure serves every render.
  const check = useCallback(() => {
    if (timer.current !== null) return;
    const wait = Math.max(0, last.current + MIN_INTERVAL_MS - Date.now());
    timer.current = setTimeout(() => {
      timer.current = null;
      last.current = Date.now();
      readProductLayerStatus().then(
        (next) => setStatus((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next)),
        // A restarting dev server refuses the call; the next check tries again.
        (error: unknown) => warnOnce(`[loupe] Couldn't read the Product layer's status: ${String(error)}`),
      );
    }, wait);
  }, []);
  useEffect(() => {
    const onFocus = () => check();
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [check]);
  // A new page version is the trigger; the check reads nothing from it.
  useEffect(() => check(), [check, version]);
  useEffect(() => {
    if (status?.format == null) return;
    warnOnce(`[loupe] ${formatNotice(status.format)} ${status.command}`, console.error);
  }, [status]);
  return status;
}
