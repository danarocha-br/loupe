// What `panelView()` reads about Instances from `__loupe`, each at most once per
// call (PER-214): inspecting an Instance walks React's tree, so the list, the
// Inspector and a scope's members share one read. Nothing is kept between calls.

import type { InstanceProps, LoupeDebug } from "../../runtime/debug.js";
import type { Inspection } from "../../runtime/inspect.js";
import type { LastSeen } from "../../runtime/registry.js";
import { appValue, formatCurrent } from "../format.js";
import { screenName } from "./names.js";
import { NOT_SET } from "./words.js";

/** The app's value for a prop, as a pill counts it: its label, and the value itself unless it is unset. */
export type AppValue = { label: string; value: unknown; unset: boolean };

export type Reads = {
  /** Null once the Instance has gone. */
  inspect(id: string): Inspection | null;
  /** Null for an Instance that isn't a mounted, adapted one. */
  props(id: string): InstanceProps | null;
  /** Null once the Instance has gone. */
  appValue(id: string, prop: string): AppValue | null;
  /** How an unmounted Instance last rendered. */
  lastSeen(id: string): LastSeen | null;
  /** The adapted Instances around it, nearest first. */
  ancestors(id: string): string[];
  /** What it is called on screen: its accessible name or visible text; null when it shows none. */
  name(id: string): string | null;
};

/**
 * Loupe's lookups throw a `[loupe] ` error for an Instance that has gone, or that
 * can't be read that way: that reads as null. Anything else is a bug, and throws.
 */
function orNull<T>(read: () => T): T | null {
  try {
    return read();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[loupe] ")) return null;
    throw error;
  }
}

export function createReads(debug: LoupeDebug): Reads {
  const inspections = new Map<string, Inspection | null>();
  const props = new Map<string, InstanceProps | null>();
  const values = new Map<string, Map<string, AppValue> | null>();
  const names = new Map<string, string | null>();
  const reads: Reads = {
    inspect(id) {
      if (!inspections.has(id)) inspections.set(id, orNull(() => debug.inspect(id)));
      return inspections.get(id) ?? null;
    },
    props(id) {
      if (!props.has(id)) props.set(id, orNull(() => debug.props(id)));
      return props.get(id) ?? null;
    },
    appValue(id, prop) {
      if (!values.has(id)) {
        const inspection = reads.inspect(id);
        values.set(
          id,
          inspection &&
            new Map(
              inspection.rows.map((row) => {
                const value = appValue(row);
                const unset = value === undefined && !row.set;
                return [row.name, { label: unset ? NOT_SET : formatCurrent(value), value, unset }];
              }),
            ),
        );
      }
      const byProp = values.get(id);
      if (!byProp) return null;
      return byProp.get(prop) ?? { label: NOT_SET, value: undefined, unset: true };
    },
    lastSeen: (id) => debug.lastSeen(id),
    ancestors: (id) => debug.ancestors(id),
    name(id) {
      if (!names.has(id)) names.set(id, orNull(() => screenName(debug.nodes(id))));
      return names.get(id) ?? null;
    },
  };
  return reads;
}
