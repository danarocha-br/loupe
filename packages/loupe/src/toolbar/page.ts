// What the Toolbar draws from: the registry and the page, re-read whenever either
// changes. Nothing here writes; the rules live in the runtime (`inspect.ts`).

import { useEffect, useMemo, useState } from "react";
import { createDebug, type InstanceRow, type LoupeDebug, type RecordRow } from "../runtime/debug.js";
import type { Inspection } from "../runtime/inspect.js";
import { onRegistryChange, registry, type Status } from "../runtime/registry.js";

export type ComponentGroup = {
  component: string;
  instances: InstanceRow[];
  /** Supported: at least one Editable prop on a browser-rendered Instance (PER-84). */
  supported: boolean;
  /** Why not, when it isn't. */
  reason: string | null;
  overrides: number;
};

export type PageSnapshot = {
  status: Status;
  groups: ComponentGroup[];
  /** Components seen earlier on this page with no Instance mounted now, such as a closed menu's. */
  interaction: string[];
  records: RecordRow[];
  /** Override values across every record. */
  overrideCount: number;
};

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

export function useDebug(): LoupeDebug {
  return useMemo(() => {
    const host = window as typeof window & { __loupe?: LoupeDebug };
    return host.__loupe ?? createDebug();
  }, []);
}

/** Every component on the page, grouped, with the Coverage badge each one gets. */
export function snapshot(debug: LoupeDebug, seen: Set<string>): PageSnapshot {
  const rows = debug.list();
  const byComponent = new Map<string, InstanceRow[]>();
  for (const row of rows) {
    const list = byComponent.get(row.component) ?? [];
    list.push(row);
    byComponent.set(row.component, list);
    seen.add(row.component);
  }
  const status = registry().status;
  const groups: ComponentGroup[] = [...byComponent.entries()]
    .map(([component, instances]) => {
      const client = instances.filter((row) => row.rendered === "client");
      const supported = client.some((row) => safeInspect(debug, row.id)?.coverage.editable);
      return {
        component,
        instances,
        supported,
        reason: supported
          ? null
          : client.length === 0
            ? "Rendered on the server"
            : !status.overrides
              ? "Overrides are off"
              : "No props with fixed options",
        overrides: instances.reduce((sum, row) => sum + Object.keys(row.overrides).length, 0),
      };
    })
    .sort((a, b) => a.component.localeCompare(b.component));
  const records = debug.records();
  return {
    status,
    groups,
    interaction: [...seen].filter((component) => !byComponent.has(component)).sort(),
    records,
    overrideCount: records.reduce((sum, record) => sum + Object.keys(record.values).length, 0),
  };
}

/** The Instance's inspection, or null once it is no longer on the page. */
export function safeInspect(debug: LoupeDebug, id: string): Inspection | null {
  try {
    return debug.inspect(id);
  } catch {
    return null;
  }
}
