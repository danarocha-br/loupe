// `adapt-list.json`: what the dev loader reads from the Product layer (PER-100 §3).
// `generate` will write it; until then it is written by hand. Every path is POSIX
// and relative to the repo root, so the file holds no machine-specific content.
// It sits at the Product layer's root, and the loader never transforms anything
// under that directory: an Adapter's own import of its original must not be swapped.
//
// {
//   "formatVersion": 1,
//   "designSystem": ["packages/design-system"],
//   "app": ["apps/app"],
//   "modules": {
//     "packages/design-system/components/ui/button.tsx": {
//       "adapter": "@repo/playground/adapters/ds/ui/button",
//       "adapted": ["Button"]
//     }
//   }
// }

export const ADAPT_LIST_FORMAT_VERSION = 1;

export type AdaptedModule = {
  /** Import specifier of the Adapter module, written into the import as is. */
  adapter: string;
  /** Exports the Adapter replaces; it re-exports the module's other names. */
  adapted: string[];
};

export type AdaptList = {
  formatVersion: typeof ADAPT_LIST_FORMAT_VERSION;
  /**
   * Design-system roots. JSX of their components is anchored everywhere, and
   * imports inside these roots are never swapped (PER-100 §1).
   */
  designSystem: string[];
  /** App roots. JSX of components imported from them is anchored. */
  app: string[];
  /** Source module path → its Adapter. */
  modules: Record<string, AdaptedModule>;
};

export class AdaptListError extends Error {
  override name = "AdaptListError";
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function parseAdaptList(json: string, where = "adapt-list.json"): AdaptList {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new AdaptListError(`${where} is not valid JSON: ${(error as Error).message}`);
  }
  const fail = (reason: string): never => {
    throw new AdaptListError(`${where}: ${reason}`);
  };
  if (typeof raw !== "object" || raw === null) return fail("expected an object");
  const list = raw as Record<string, unknown>;

  if (list.formatVersion !== ADAPT_LIST_FORMAT_VERSION) {
    fail(
      `formatVersion is ${JSON.stringify(list.formatVersion)}, this Loupe reads ${ADAPT_LIST_FORMAT_VERSION}`,
    );
  }
  if (!isStringArray(list.designSystem)) fail("designSystem must be an array of paths");
  if (!isStringArray(list.app)) fail("app must be an array of paths");
  if (typeof list.modules !== "object" || list.modules === null || Array.isArray(list.modules)) {
    fail("modules must be an object");
  }

  const modules: Record<string, AdaptedModule> = {};
  for (const [source, entry] of Object.entries(list.modules as Record<string, unknown>)) {
    const value = entry as Partial<AdaptedModule> | null;
    if (typeof value?.adapter !== "string" || value.adapter === "") {
      fail(`modules["${source}"].adapter must be a non-empty string`);
    }
    if (!isStringArray(value?.adapted) || value.adapted.length === 0) {
      fail(`modules["${source}"].adapted must list at least one export`);
    }
    modules[trimSlashes(source)] = {
      adapter: value?.adapter as string,
      adapted: [...(value?.adapted as string[])],
    };
  }

  return {
    formatVersion: ADAPT_LIST_FORMAT_VERSION,
    designSystem: (list.designSystem as string[]).map(trimSlashes),
    app: (list.app as string[]).map(trimSlashes),
    modules,
  };
}

function trimSlashes(path: string): string {
  return path.replace(/^\.\//, "").replace(/\/+$/, "");
}
