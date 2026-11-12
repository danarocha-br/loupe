// Prop metadata for Instances with no Adapter (PER-180). An Adapter carries its
// component's metadata; the others get theirs from `meta/`, which the Toolbar
// loads from the dev server and keeps here. Keyed by call-site file and imported
// name, since that is all an anchor says about the component.

import { parseCallSiteId } from "../call-site.js";
import type { PropMeta } from "../meta/types.js";
import { emitChange, registry } from "./registry.js";

/** A call site's file and the name it imports, both from its anchor. Mirrors the server's `MetaRequest`. */
export type MetaRequest = { path: string; component: string };

type Meta = Readonly<Record<string, PropMeta>>;

const keyOf = (request: MetaRequest) => `${request.path}\u0000${request.component}`;

/** What to ask the dev server for an Instance's metadata; null for an id that isn't a call site. */
export function metaRequestOf(anchor: string): MetaRequest | null {
  const key = parseCallSiteId(anchor);
  return key ? { path: key.path, component: key.component } : null;
}

/** The metadata loaded for this anchor's component, or null while none is (yet). */
export function loadedMeta(anchor: string): Meta | null {
  const request = metaRequestOf(anchor);
  return request ? (registry().instanceMeta.get(keyOf(request)) ?? null) : null;
}

/** Stores the dev server's answers, one per request; redraws only when one changed. */
export function rememberMeta(requests: readonly MetaRequest[], results: readonly (Meta | null)[]): void {
  const store = registry().instanceMeta;
  let changed = false;
  requests.forEach((request, index) => {
    const key = keyOf(request);
    const next = results[index] ?? null;
    const previous = store.get(key) ?? null;
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    if (next === null) store.delete(key);
    else store.set(key, next);
    changed = true;
  });
  if (changed) emitChange();
}
