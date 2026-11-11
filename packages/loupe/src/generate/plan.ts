// What `generate` writes into the Product layer, as a pure function of the
// prop metadata (PER-100). Nothing here touches the disk, so the whole output,
// byte for byte, is testable from `ModuleMeta` alone.

import path from "node:path";
import { ADAPT_LIST_FORMAT_VERSION, type AdaptList } from "../adapt-list.js";
import { compare } from "../meta/sources.js";
import type { ComponentExport, ComponentShape, ModuleMeta } from "../meta/types.js";
import { stableJson } from "../meta/write.js";
import { stampJson, stampModule } from "./header.js";

/** Where Adapters import `createAdapter` from (the runtime, PER-120). */
export const RUNTIME_SPECIFIER = "@danarocha/loupe/runtime";

/** Shapes `createAdapter` wraps (PER-100 §2); every other shape is skipped and reported. */
const SUPPORTED_SHAPES: ReadonlySet<ComponentShape> = new Set(["function", "forwardRef", "memo"]);

export type Side = "ds" | "app";

export type PlanInput = {
  /** Product layer directory, POSIX and relative to the repo root. */
  outDir: string;
  /** Import specifier of the Product layer, e.g. `@repo/loupe`. */
  specifier: string;
  designSystem: {
    /** Package root, relative to the repo root. Adapted modules live under `<root>/components/`. */
    root: string;
    /** Set when `<name>/<path>` imports the package's files, i.e. the package has no `exports` map. */
    packageName?: string;
  };
  app: { root: string };
  /** Metadata whose `source` and `files` are relative to the repo root. */
  modules: readonly ModuleMeta[];
};

export type Coverage =
  | { outcome: "adapter" }
  | { outcome: "inspect-only"; reason: "server component" | "no Editable prop" }
  | { outcome: "skipped-by-shape"; reason: ComponentShape };

export type CoverageEntry = { source: string; name: string; side: Side; coverage: Coverage };

export type Plan = {
  /** Path relative to the Product layer → exact file bytes. */
  files: Map<string, string>;
  coverage: CoverageEntry[];
};

/**
 * Whether one exported component gets an Adapter, and if not, why (PER-100 §1–2).
 * Shape comes first: a shape `createAdapter` cannot wrap is reported as such
 * whatever its props. The Toolbar can call this on the same metadata to show the reason.
 */
export function coverageOf(module: ModuleMeta, entry: ComponentExport, side: Side): Coverage {
  if (!SUPPORTED_SHAPES.has(entry.shape)) return { outcome: "skipped-by-shape", reason: entry.shape };
  // A product file without `'use client'` renders on the server: there is no client
  // import to swap (PER-86). Design-system modules are swapped from client files.
  if (side === "app" && !module.client) return { outcome: "inspect-only", reason: "server component" };
  if (!Object.values(entry.props).some((prop) => prop.editable)) {
    return { outcome: "inspect-only", reason: "no Editable prop" };
  }
  return { outcome: "adapter" };
}

export function plan(input: PlanInput): Plan {
  const files = new Map<string, string>();
  const coverage: CoverageEntry[] = [];
  const adaptList: AdaptList = {
    formatVersion: ADAPT_LIST_FORMAT_VERSION,
    designSystem: [input.designSystem.root],
    app: [input.app.root],
    modules: {},
  };
  const dsComponents = `${input.designSystem.root}/components/`;
  const appRoot = `${input.app.root}/`;

  for (const module of [...input.modules].sort((a, b) => compare(a.source, b.source))) {
    const side: Side | undefined = module.source.startsWith(dsComponents)
      ? "ds"
      : module.source.startsWith(appRoot)
        ? "app"
        : undefined;
    if (!side) throw new Error(`${module.source} is under neither the design system's components/ nor the app`);
    const mirrored = `${side}/${module.source.slice(side === "ds" ? dsComponents.length : appRoot.length)}`;

    files.set(`meta/${mirrored}.json`, stampJson(stableJson(module)));

    const adapted: string[] = [];
    for (const name of Object.keys(module.exports).sort(compare)) {
      const entry = module.exports[name];
      if (entry?.kind !== "component") continue;
      const result = coverageOf(module, entry, side);
      coverage.push({ source: module.source, name, side, coverage: result });
      if (result.outcome === "adapter") adapted.push(name);
    }
    if (adapted.length === 0) continue;

    const adapterFile = `adapters/${mirrored}`;
    const original = originalSpecifier(input, side, module.source, adapterFile);
    files.set(adapterFile, stampModule(adapterModule(module, adapted, original)));
    adaptList.modules[module.source] = {
      adapter: `${input.specifier}/${withoutExtension(adapterFile)}`,
      adapted,
    };
  }

  files.set("adapt-list.json", stampJson(stableJson(adaptList)));
  return { files, coverage };
}

/**
 * One Adapter module: `'use client'`, explicit named re-exports of everything the
 * original exports (never `export *`), and `createAdapter` for the adapted names.
 */
export function adapterModule(module: ModuleMeta, adapted: readonly string[], original: string): string {
  const adaptedSet = new Set(adapted);
  const names = Object.keys(module.exports).sort(compare);
  const values = names.filter((name) => !adaptedSet.has(name) && module.exports[name]?.kind !== "type");
  const types = names.filter((name) => module.exports[name]?.kind === "type");
  const local = (name: string) => `${name}$original`;
  const from = JSON.stringify(original);

  const lines = [
    `"use client";`,
    "",
    `import { createAdapter } from ${JSON.stringify(RUNTIME_SPECIFIER)};`,
    `import { ${adapted.map((name) => `${name} as ${local(name)}`).join(", ")} } from ${from};`,
    "",
  ];
  if (values.length > 0) lines.push(`export { ${values.join(", ")} } from ${from};`);
  if (types.length > 0) lines.push(`export type { ${types.join(", ")} } from ${from};`);
  if (values.length > 0 || types.length > 0) lines.push("");
  for (const name of adapted) {
    lines.push(`export const ${name} = createAdapter(${JSON.stringify(name)}, ${local(name)});`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * How an Adapter imports its original. Design-system files by package name when the
 * package exposes its files directly; product files always by relative path (PER-100 §9).
 */
function originalSpecifier(input: PlanInput, side: Side, source: string, adapterFile: string): string {
  const { packageName, root } = input.designSystem;
  if (side === "ds" && packageName) return `${packageName}/${withoutExtension(source.slice(root.length + 1))}`;
  const from = path.posix.dirname(path.posix.join(input.outDir, adapterFile));
  const relative = path.posix.relative(from, withoutExtension(source));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function withoutExtension(file: string): string {
  return file.replace(/\.(tsx|ts)$/, "");
}
