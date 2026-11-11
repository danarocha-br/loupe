// How a Current value reads in the inspector: one line, never a guess.

import type { DefaultValue } from "../meta/types.js";

const MAX = 120;

function elementName(type: unknown): string {
  if (typeof type === "string") return type;
  if (typeof type === "function") return (type as { displayName?: string }).displayName ?? type.name ?? "Component";
  if (typeof type === "object" && type !== null) {
    const named = type as { displayName?: string; render?: { name?: string }; type?: unknown };
    return named.displayName ?? named.render?.name ?? (named.type ? elementName(named.type) : "Component");
  }
  return "Component";
}

export function formatCurrent(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "function") return `ƒ ${value.name || "anonymous"}()`;
  if (typeof value === "object" && value !== null && "$$typeof" in value) {
    return `<${elementName((value as { type?: unknown }).type)} />`;
  }
  if (Array.isArray(value)) return `[${value.map(formatCurrent).join(", ")}]`.slice(0, MAX);
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > MAX ? `${text.slice(0, MAX - 1)}…` : text;
}

export function formatDefault(value: DefaultValue): string {
  if (value.source === "unknown" || value.value === null) return "DEFAULT";
  return `DEFAULT ${formatCurrent(value.value)}`;
}

/**
 * The app's value as a control starts from it: set, else a known default. A
 * `conflict` or `unknown` default is no value at all: we never guess (PER-84).
 */
export function appValue(row: { set: boolean; value: unknown; default?: DefaultValue }): unknown {
  if (row.set) return row.value;
  const known = row.default;
  if (known && (known.source === "destructure" || known.source === "defaultVariants")) return known.value ?? undefined;
  return undefined;
}
