// The prop metadata of an Instance with no Adapter (PER-180), found on the dev
// server: the call site's import names the module, `meta/` holds that module's
// file (PER-100 §3). Read-only, and `generate` writes nothing for it: the lookup
// is derived from the call site each time, so no index can drift from the source.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { parseAdaptList } from "./adapt-list.js";
import { layerPathOf } from "./generate/plan.js";
import { formatOf } from "./layer-status.js";
import { statStamp } from "./meta/sources.js";
import { META_FORMAT_VERSION } from "./meta/types.js";
import { createResolver } from "./resolve.js";
import type { InstanceMeta, MetaRequest } from "./runtime/instance-meta.js";

export type MetaLookupPaths = {
  /** Absolute repo root; anchors and `meta/` sources are relative to it. */
  root: string;
  /** Absolute path of the Product layer's adapt-list.json. */
  adaptList: string;
};

type Imports = {
  /** Imported name → every specifier importing it by that name. */
  named: Map<string, string[]>;
  /** Specifiers imported whole (`import * as UI`), whose members the loader anchors by property name. */
  namespaces: string[];
  /** Local names of default imports, which the loader anchors under the local name. */
  defaults: Set<string>;
};

const toPosix = (file: string) => file.split(path.sep).join("/");

function realPathOrSame(file: string): string {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
}

/** One answer per request, in order: the export's props, or null when `meta/` doesn't know it. */
export function createMetaLookup(paths: MetaLookupPaths): (requests: readonly MetaRequest[]) => (InstanceMeta | null)[] {
  const resolver = createResolver();
  // The resolver answers with real paths, so the root must be one too.
  const root = realPathOrSame(path.resolve(paths.root));
  const layer = path.dirname(paths.adaptList);
  // Keyed by path and stat, like the Product layer's status: a lookup after the first reads only what changed.
  const importsCache = new Map<string, { stamp: string; imports: Imports }>();
  const metaCache = new Map<string, { stamp: string; exports: Record<string, unknown> | null }>();

  const importsOf = (file: string): Imports | null => {
    const stamp = statStamp(file);
    if (stamp === null) return null;
    const cached = importsCache.get(file);
    if (cached?.stamp === stamp) return cached.imports;
    const imports: Imports = { named: new Map(), namespaces: [], defaults: new Set() };
    try {
      const program = parse(readFileSync(file, "utf8"), {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
        errorRecovery: true,
      }).program;
      for (const node of program.body) {
        if (node.type !== "ImportDeclaration" || node.importKind === "type") continue;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") imports.namespaces.push(node.source.value);
          if (specifier.type === "ImportDefaultSpecifier") imports.defaults.add(specifier.local.name);
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const imported = specifier.imported;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          imports.named.set(name, [...(imports.named.get(name) ?? []), node.source.value]);
        }
      }
    } catch {
      // A file that doesn't parse names nothing.
    }
    importsCache.set(file, { stamp, imports });
    return imports;
  };

  /** The `exports` of a module's `meta/` file, or null when there is none in this Loupe's format. */
  const exportsOf = (file: string, roots: { designSystem: string[]; app: string[] }): Record<string, unknown> | null => {
    const source = toPosix(path.relative(root, file));
    for (const ds of roots.designSystem) {
      for (const app of roots.app) {
        const mirrored = layerPathOf(source, ds, app);
        if (mirrored === undefined) continue;
        const metaFile = path.join(layer, "meta", ...`${mirrored}.json`.split("/"));
        const stamp = statStamp(metaFile);
        if (stamp === null) continue;
        const cached = metaCache.get(metaFile);
        if (cached?.stamp === stamp) return cached.exports;
        let exports: Record<string, unknown> | null = null;
        try {
          const raw = JSON.parse(readFileSync(metaFile, "utf8")) as { formatVersion?: unknown; source?: unknown; exports?: unknown };
          if (raw.formatVersion === META_FORMAT_VERSION && raw.source === source && raw.exports && typeof raw.exports === "object") {
            exports = raw.exports as Record<string, unknown>;
          }
        } catch {
          exports = null;
        }
        metaCache.set(metaFile, { stamp, exports });
        return exports;
      }
    }
    return null;
  };

  const propsIn = (exports: Record<string, unknown> | null, name: string): InstanceMeta | null => {
    const entry = exports?.[name] as { kind?: unknown; props?: unknown } | undefined;
    return entry?.kind === "component" && entry.props && typeof entry.props === "object" ? (entry.props as InstanceMeta) : null;
  };

  return (requests) => {
    let roots: { designSystem: string[]; app: string[] };
    try {
      const text = readFileSync(paths.adaptList, "utf8");
      // An older or newer Product layer can't be trusted, as for its notices.
      if (formatOf(text) !== null) return requests.map(() => null);
      roots = parseAdaptList(text, paths.adaptList);
    } catch {
      return requests.map(() => null);
    }
    return requests.map(({ path: callSite, component }) => {
      // Anchors are repo-relative: anything else never names a call site.
      const relative = path.normalize(callSite);
      if (path.isAbsolute(relative) || relative.split(path.sep).includes("..") || relative.includes("\0")) return null;
      const file = path.join(root, relative);
      const imports = importsOf(file);
      // A default import is anchored under its local name, which says nothing about the export (PER-100 §2).
      if (imports === null || imports.defaults.has(component)) return null;
      // The anchor doesn't say which import a name came through: every module that could
      // have supplied it must agree, or nothing is shown rather than another component's props.
      const modules = new Set<string>();
      for (const specifier of [...(imports.named.get(component) ?? []), ...imports.namespaces]) {
        const target = resolver.resolve(specifier, file);
        if (target !== null && propsIn(exportsOf(target, roots), component) !== null) modules.add(target);
      }
      const [only] = modules;
      return modules.size === 1 && only !== undefined ? propsIn(exportsOf(only, roots), component) : null;
    });
  };
}
