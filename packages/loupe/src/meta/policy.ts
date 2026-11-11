import type { EditableOptionsProp, InspectOnlyProp, OptionValue } from "./types.js";

/**
 * Packages whose declared props are listed alongside the repo's own (PER-84:
 * "design-system/product code plus Base UI"). Everything else from
 * `node_modules`, DOM and React typings included, is left out.
 */
export function isPrimitiveLibrary(pkg: string): boolean {
  return (
    pkg === "@base-ui/react" ||
    pkg === "@base-ui-components/react" ||
    pkg === "radix-ui" ||
    pkg.startsWith("@radix-ui/")
  );
}

/** Props that change what gets rendered, per primitive library. Never Editable. */
export const STRUCTURAL_PROPS: Readonly<Record<string, readonly string[]>> = {
  "*": ["as", "asChild", "render"],
  "@base-ui/react": ["render", "nativeButton"],
  "@base-ui-components/react": ["render", "nativeButton"],
  "radix-ui": ["asChild"],
};

export function isStructural(name: string, from: string): boolean {
  const scoped = STRUCTURAL_PROPS[from] ?? (from.startsWith("@radix-ui/") ? STRUCTURAL_PROPS["radix-ui"] : []);
  return (STRUCTURAL_PROPS["*"] ?? []).includes(name) || (scoped ?? []).includes(name);
}

/**
 * DOM attributes a primitive library acts on, listed even though React's
 * typings declare them (PER-84: Button "gets `disabled` from Base UI").
 */
export const LISTED_DOM_PROPS: ReadonlySet<string> = new Set(["children", "disabled"]);

/** React attributes that are never listed. */
export const NEVER_LISTED: ReadonlySet<string> = new Set(["key", "ref"]);

export type VariantKeys = { keys: string[] } | { dynamic: string };

/**
 * Judges a closed set from the checker against the variant config that backs
 * the prop, if any (PER-80 "verified").
 */
export function judgeOptions(
  typeOptions: OptionValue[],
  config: VariantKeys | undefined,
): Pick<EditableOptionsProp, "status" | "options" | "mismatch"> | Pick<InspectOnlyProp, "reason" | "detail"> {
  if (config === undefined) {
    return { status: "type-only", options: sortOptions(typeOptions) };
  }
  if ("dynamic" in config) {
    return { reason: "UNVERIFIED", detail: config.dynamic };
  }

  const typeKeys = new Set(typeOptions.map(String));
  const configKeys = config.keys;
  const isBoolean = typeOptions.length === 2 && typeOptions.every((o) => typeof o === "boolean");

  // A boolean variant only needs to style `true`; `false` stays legal (PER-80).
  if (isBoolean && configKeys.length > 0 && configKeys.every((k) => k === "true" || k === "false")) {
    return { status: "verified", options: [false, true] };
  }

  const onlyInConfig = configKeys.filter((k) => !typeKeys.has(k));
  const onlyInType = [...typeKeys].filter((k) => !configKeys.includes(k)).sort();
  const byKey = new Map(typeOptions.map((o) => [String(o), o]));
  // Config source order, so generated output follows how the author wrote it.
  const shared = configKeys.filter((k) => typeKeys.has(k)).map((k) => byKey.get(k) as OptionValue);

  if (onlyInConfig.length === 0 && onlyInType.length === 0) {
    return { status: "verified", options: shared };
  }
  if (shared.length === 0) {
    return { reason: "UNVERIFIED", detail: "type and variant config share no option" };
  }
  return { status: "verified-partial", options: shared, mismatch: { onlyInType, onlyInConfig } };
}

const typeRank = { boolean: 0, number: 1, string: 2 } as const;

/** The checker's union order is not stable, so unbacked sets are sorted. */
export function sortOptions(options: OptionValue[]): OptionValue[] {
  return [...options].sort((a, b) => {
    const ta = typeRank[typeof a as keyof typeof typeRank];
    const tb = typeRank[typeof b as keyof typeof typeRank];
    if (ta !== tb) return ta - tb;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  });
}

/** `open` / `onOpenChange`, `value` / `onValueChange` … (PER-96). */
export function stateSiblingName(name: string): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}Change`;
}
