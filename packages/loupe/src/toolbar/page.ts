// What the Toolbar draws from: the registry and the page, re-read whenever either
// changes. Nothing here writes; the rules live in the runtime (`inspect.ts`).

import { useEffect, useMemo, useState } from "react";
import { createDebug, type InstanceProps, type InstanceRow, type LoupeDebug, type RecordRow } from "../runtime/debug.js";
import type { Inspection } from "../runtime/inspect.js";
import { currentRoute, type LastSeen, onRegistryChange, registry, type Status } from "../runtime/registry.js";

/** Components seen on the current route, for "Appears on interaction". */
export type SeenComponents = { route: string; components: Set<string> };

/** An Instance that isn't mounted but still holds an Instance-scope record: listed as "No Instance mounted". */
export type HeldInstance = {
  id: string;
  record: RecordRow;
  /** How it last rendered; null when it unmounted before the registry kept track. */
  lastSeen: LastSeen | null;
};

export type ComponentGroup = {
  component: string;
  /** Mounted Instances. */
  instances: InstanceRow[];
  /** Unmounted Instances that still hold something (PER-136); one that holds nothing isn't listed. */
  held: HeldInstance[];
  /** Supported: at least one Editable prop on a browser-rendered Instance (PER-84). */
  supported: boolean;
  /** Why not, when it isn't. */
  reason: string | null;
  overrides: number;
};

export type PageSnapshot = {
  status: Status;
  /** Every Instance on the page: adapted, browser-rendered with no Adapter, and server-rendered. */
  rows: InstanceRow[];
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
export function snapshot(debug: LoupeDebug, seen: SeenComponents): PageSnapshot {
  if (seen.route !== currentRoute()) {
    seen.route = currentRoute();
    seen.components.clear();
  }
  const rows = debug.list();
  const byComponent = new Map<string, InstanceRow[]>();
  for (const row of rows) {
    const list = byComponent.get(row.component) ?? [];
    list.push(row);
    byComponent.set(row.component, list);
    seen.components.add(row.component);
  }
  const status = registry().status;
  const records = debug.records();
  const held = heldInstances(debug, records);
  const components = new Set([...byComponent.keys(), ...held.keys()]);
  const groups: ComponentGroup[] = [...components]
    .map((component) => {
      const instances = byComponent.get(component) ?? [];
      const heldHere = held.get(component) ?? [];
      const client = instances.filter((row) => row.rendered === "client");
      // Only an adapted Instance takes Overrides; inspecting the others would walk the fibers once each.
      const supported = client.some((row) => row.adapted && safeInspect(debug, row.id)?.coverage.editable);
      return {
        component,
        instances,
        held: heldHere,
        supported,
        reason: supported
          ? null
          : instances.length === 0
            ? "No Instance mounted"
            : client.length === 0
              ? "Rendered on the server"
              : !status.overrides
                ? "Overrides are off"
                : client.every((row) => !row.adapted)
                  ? "No Adapter"
                  : "No props with fixed options",
        overrides:
          instances.reduce((sum, row) => sum + Object.keys(row.overrides).length, 0) +
          heldHere.reduce((sum, entry) => sum + Object.keys(entry.record.values).length, 0),
      };
    })
    .sort((a, b) => a.component.localeCompare(b.component));
  return {
    status,
    rows,
    groups,
    interaction: [...seen.components].filter((component) => !components.has(component)).sort(),
    records,
    overrideCount: records.reduce((sum, record) => sum + Object.keys(record.values).length, 0),
  };
}

/**
 * Unmounted Instances with an Instance-scope record, by component, on this route
 * only: a record for an Instance on another page is listed there.
 */
function heldInstances(debug: LoupeDebug, records: RecordRow[]): Map<string, HeldInstance[]> {
  const held = new Map<string, HeldInstance[]>();
  for (const record of records) {
    if (record.target.scope !== "instance" || record.mounted.length > 0) continue;
    if (Object.keys(record.values).length === 0) continue;
    const id = record.target.id;
    const lastSeen = debug.lastSeen(id);
    if (lastSeen && lastSeen.route !== currentRoute()) continue;
    const component = lastSeen?.component ?? componentOfAnchor(id);
    held.set(component, [...(held.get(component) ?? []), { id, record, lastSeen }]);
  }
  return held;
}

/** `path › Enclosing › Button[2]~2#key` → `Button`. */
function componentOfAnchor(id: string): string {
  const last = id.split("#")[0]?.split(" › ").at(-1) ?? id;
  return last.replace(/~\d+$/, "").replace(/\[\d+\]$/, "");
}

/** The record holding an Instance-scope Override for this id, whether it applies or is held for review. */
export function instanceRecord(records: RecordRow[], id: string): RecordRow | null {
  return records.find((record) => record.target.scope === "instance" && record.target.id === id) ?? null;
}

/** The Instance's inspection, or null once it is no longer on the page. */
export function safeInspect(debug: LoupeDebug, id: string): Inspection | null {
  try {
    return debug.inspect(id);
  } catch {
    return null;
  }
}

/** A mounted Instance's live props and Overrides, or null when it isn't mounted in the browser. */
export function safeProps(debug: LoupeDebug, id: string): InstanceProps | null {
  try {
    return debug.props(id);
  } catch {
    return null;
  }
}

/** Whether an Instance-scope record holds an Override for this Instance, mounted or not. */
export function hasInstanceRecord(debug: LoupeDebug, id: string): boolean {
  return debug
    .records()
    .some((record) => record.target.scope === "instance" && record.target.id === id && Object.keys(record.values).length > 0);
}
