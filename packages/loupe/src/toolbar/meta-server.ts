"use server";

// `meta/` for Instances with no Adapter (PER-180), read on the dev server: the
// browser can't resolve a call site's import, and the Toolbar can't import the
// app's Product layer by a name it only learns at runtime. `withLoupe` hands over
// the paths it already resolved, under `next dev` only.
//
// Only the Toolbar imports this module, and the Toolbar reaches the page through
// `<LoupeMount />`'s development-only import, so a production build holds neither.

import { createMetaLookup } from "../instance-meta.js";
import type { InstanceMeta, MetaRequest } from "../runtime/instance-meta.js";

/** A string only this module holds: `loupe doctor --build` looks for it to prove the action stayed out. */
const MARKER = "loupe-instance-meta";

/** More than any page holds call sites; a larger request is refused rather than read. */
const MAX_REQUESTS = 500;

/** The lookup for the paths `withLoupe` handed over; its caches live as long as the dev server. */
let cached: { paths: string; lookup: ReturnType<typeof createMetaLookup> } | null = null;

/** One answer per request, in order; null when `withLoupe` isn't active, so there is no Product layer to read. */
export async function readInstanceMeta(requests: MetaRequest[]): Promise<(InstanceMeta | null)[] | null> {
  const root = process.env.LOUPE_ROOT;
  const adaptList = process.env.LOUPE_ADAPT_LIST;
  if (!root || !adaptList) return null;
  if (!Array.isArray(requests) || requests.length > MAX_REQUESTS) return null;
  const valid = requests.every(
    (request) => typeof request?.path === "string" && typeof request?.component === "string",
  );
  if (!valid) return null;
  try {
    const paths = `${root}\u0000${adaptList}`;
    if (cached?.paths !== paths) cached = { paths, lookup: createMetaLookup({ root, adaptList }) };
    return cached.lookup(requests);
  } catch (error) {
    console.warn(`[loupe] ${MARKER}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
