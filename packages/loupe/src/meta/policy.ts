import type {
  DefaultValue,
  EditableOptionsProp,
  InspectOnlyProp,
  InspectReason,
  OptionValue,
  PropMeta,
} from "./types.js";
import { packageOf } from "./sources.js";
import type { VariantConfig } from "./variant-config.js";

/**
 * Packages whose declared props are listed alongside the repo's own (PER-84:
 * "design-system/product code plus Base UI").
 */
export function isPrimitiveLibrary(pkg: string): boolean {
  return (
    pkg === "@base-ui/react" ||
    pkg === "@base-ui-components/react" ||
    pkg === "radix-ui" ||
    pkg.startsWith("@radix-ui/")
  );
}

/** `repo` when any declaration is the repo's, else the declaring package, a primitive library first. */
export function originOf(files: readonly string[]): string {
  if (files.length === 0 || files.some((f) => packageOf(f) === undefined)) return "repo";
  const packages = files.map((f) => packageOf(f) as string);
  return packages.find(isPrimitiveLibrary) ?? packages[0] ?? "repo";
}

/** Props that change what gets rendered. Never Editable, whoever declares them. */
const STRUCTURAL_PROPS: ReadonlySet<string> = new Set(["as", "asChild", "nativeButton", "render"]);

/** DOM attributes a primitive library acts on (PER-84: Button "gets `disabled` from Base UI"). */
const LISTED_DOM_PROPS: ReadonlySet<string> = new Set(["children", "disabled"]);

const NEVER_LISTED: ReadonlySet<string> = new Set(["key", "ref"]);

/** Whether a declared prop is listed at all; other DOM and React attributes are not. */
export function isListed(name: string, from: string): boolean {
  if (NEVER_LISTED.has(name)) return false;
  return from === "repo" || isPrimitiveLibrary(from) || LISTED_DOM_PROPS.has(name);
}

export function isStructural(name: string): boolean {
  return STRUCTURAL_PROPS.has(name);
}

export function inspectOnly(reason: InspectReason, from: string, detail?: string): InspectOnlyProp {
  return detail ? { editable: false, reason, from, detail } : { editable: false, reason, from };
}

export type VariantKeys = { keys: string[] } | { dynamic: string };

/**
 * Finds the variant keys backing a prop. A config that could not be read
 * whole taints only props derived from a config, never a hand-typed `open`.
 */
export function variantLookup(configs: VariantConfig[]): (name: string, configDerived: boolean) => VariantKeys | undefined {
  const keys = new Map<string, VariantKeys>();
  for (const config of configs) {
    for (const [name, value] of Object.entries(config.variants)) if (!keys.has(name)) keys.set(name, value);
  }
  const wholeDynamic = configs.find((c) => c.dynamic)?.dynamic;
  return (name, configDerived) =>
    keys.get(name) ?? (wholeDynamic && configDerived ? { dynamic: wholeDynamic } : undefined);
}

/** Judges a closed set from the checker against the config that backs it (PER-80 "verified"). */
export function judgeOptions(typeOptions: OptionValue[], config: VariantKeys | undefined, from: string): PropMeta {
  if (config === undefined) {
    return { editable: true, kind: "options", from, status: "type-only", options: sortOptions(typeOptions) };
  }
  if ("dynamic" in config) return inspectOnly("UNVERIFIED", from, config.dynamic);

  const typeKeys = new Set(typeOptions.map(String));
  const configKeys = config.keys;
  const isBoolean = typeOptions.length === 2 && typeOptions.every((o) => typeof o === "boolean");

  // A boolean variant only needs to style `true`; `false` stays legal.
  if (isBoolean && configKeys.includes("true") && configKeys.every((k) => k === "true" || k === "false")) {
    return { editable: true, kind: "options", from, status: "verified", options: [false, true] };
  }

  const onlyInConfig = configKeys.filter((k) => !typeKeys.has(k));
  const onlyInType = [...typeKeys].filter((k) => !configKeys.includes(k)).sort();
  const byKey = new Map(typeOptions.map((o) => [String(o), o]));
  const shared = configKeys.filter((k) => typeKeys.has(k)).map((k) => byKey.get(k) as OptionValue);

  if (onlyInConfig.length === 0 && onlyInType.length === 0) {
    return { editable: true, kind: "options", from, status: "verified", options: shared };
  }
  if (shared.length === 0) return inspectOnly("UNVERIFIED", from, "type and variant config share no option");
  const partial: EditableOptionsProp = {
    editable: true,
    kind: "options",
    from,
    status: "verified-partial",
    options: shared,
    mismatch: { onlyInType, onlyInConfig },
  };
  return partial;
}

const typeRank = { boolean: 0, number: 1, string: 2 } as const;

/** The checker's union order is not stable, so unbacked sets are sorted. */
function sortOptions(options: OptionValue[]): OptionValue[] {
  return [...options].sort((a, b) => {
    const ta = typeRank[typeof a as keyof typeof typeRank];
    const tb = typeRank[typeof b as keyof typeof typeRank];
    if (ta !== tb) return ta - tb;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  });
}

export type Destructured = { value: OptionValue | null; expression?: string };

/** Destructure first, then `defaultVariants`; a disagreement is a `conflict` that destructure wins (PER-80). */
export function combineDefaults(
  destructured: Destructured | undefined,
  fromVariants: OptionValue | null | undefined,
  from: string,
): DefaultValue | undefined {
  if (destructured && fromVariants !== undefined && destructured.expression === undefined && destructured.value !== fromVariants) {
    return { source: "conflict", value: destructured.value, defaultVariants: fromVariants };
  }
  if (destructured) {
    return destructured.expression === undefined
      ? { source: "destructure", value: destructured.value }
      : { source: "destructure", value: null, expression: destructured.expression };
  }
  if (fromVariants !== undefined) return { source: "defaultVariants", value: fromVariants };
  return isPrimitiveLibrary(from) ? { source: "unknown" } : undefined;
}

export function variantDefaults(configs: VariantConfig[]): Record<string, OptionValue | null> {
  return Object.assign({}, ...configs.map((c) => c.defaults));
}

/** Config files in the repo, which the module's metadata then depends on. */
export function repoConfigFiles(configs: VariantConfig[]): string[] {
  return configs.map((c) => c.filePath).filter((f) => !f.includes("/node_modules/"));
}


/** Applies the default and the State flag every engine adds after classifying. */
export function finishProp(prop: PropMeta, def: DefaultValue | undefined, state: boolean): PropMeta {
  let result = prop;
  if (def) result = { ...result, default: def };
  if (state) result = { ...result, state: true };
  return result;
}
