// A value as the Proposal's JSON holds it. A leaf: the builder and the Toolbar's
// Snapshots both turn what an Instance showed into JSON the same way.

import { formatCurrent } from "../toolbar/format.js";
import type { JsonValue } from "./types.js";

/** A value as JSON: functions, elements and other non-JSON values become how the Toolbar shows them. */
export function toJson(value: unknown, seen: WeakSet<object> = new WeakSet()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  const plain =
    Array.isArray(value) ||
    (typeof value === "object" && !("$$typeof" in value) && Object.getPrototypeOf(value) === Object.prototype);
  if (!plain) return formatCurrent(value);
  const object = value as object;
  if (seen.has(object)) return "[Circular]";
  seen.add(object);
  const result: JsonValue = Array.isArray(object)
    ? object.map((inner) => toJson(inner, seen))
    : Object.fromEntries(Object.entries(object).map(([key, inner]) => [key, toJson(inner, seen)]));
  seen.delete(object);
  return result;
}
