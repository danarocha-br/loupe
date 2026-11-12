// The Product layer's notices (PER-133): components whose source changed since
// the last `loupe generate`, and a Product layer in another format. Regeneration
// stays explicit (PER-100 §5), so each notice names the command and runs nothing.

import { useEffect, useRef, useState } from "react";
import type { LayerStatus } from "../layer-status.js";
import { formatNotice } from "../format-notice.js";
import { readProductLayerStatus } from "./layer-server.js";

/** At most one check this often while the page keeps changing; each one stats the sources. */
const MIN_INTERVAL_MS = 2000;

/** Logged once per message, so a re-check doesn't repeat it. */
const logged = new Set<string>();

/**
 * The Product layer's status, checked when the panel opens, when the window gets
 * focus back (from the editor, typically) and after the page changes.
 */
export function useLayerStatus(version: number): LayerStatus | null {
  const [status, setStatus] = useState<LayerStatus | null>(null);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const check = useRef<() => void>(() => {});
  check.current = () => {
    if (timer.current !== null) return;
    const wait = Math.max(0, last.current + MIN_INTERVAL_MS - Date.now());
    timer.current = setTimeout(() => {
      timer.current = null;
      last.current = Date.now();
      readProductLayerStatus().then(
        (next) => setStatus((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next)),
        () => {},
      );
    }, wait);
  };
  useEffect(() => {
    const onFocus = () => check.current();
    const onVisible = () => document.visibilityState === "visible" && check.current();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);
  // A new page version is the trigger; the check reads nothing from it.
  useEffect(() => check.current(), [version]);
  useEffect(() => {
    if (status?.format == null) return;
    const message = `${formatNotice(status.format)} ${status.command}`;
    if (logged.has(message)) return;
    logged.add(message);
    console.error(`[loupe] ${message}`);
  }, [status]);
  return status;
}

/** Component names whose module's source changed since the last `generate`. */
export function staleComponents(status: LayerStatus | null): Set<string> {
  return new Set(status?.stale.flatMap((module) => module.components) ?? []);
}

export function LayerNotices({ status }: { status: LayerStatus | null }) {
  if (status === null) return null;
  if (status.format !== null) {
    return (
      <div className="banner" role="alert" data-testid="format-notice">
        {formatNotice(status.format)}
        <div className="mono">{status.command}</div>
      </div>
    );
  }
  if (status.stale.length === 0) return null;
  const count = status.stale.reduce((sum, module) => sum + module.components.length, 0);
  return (
    <div className="banner" role="status" data-testid="stale-notice">
      <div>
        {count} component{count === 1 ? "" : "s"} changed since the last generate. Their props here may be out of date.
      </div>
      <ul className="list">
        {status.stale.map((module) => (
          <li key={module.source}>
            {module.components.join(", ") || "No components"}{" "}
            <span className="mono muted" title={module.changed.join("\n")}>
              {module.source.split("/").slice(-2).join("/")}
            </span>
          </li>
        ))}
      </ul>
      <div className="mono">{status.command}</div>
    </div>
  );
}
