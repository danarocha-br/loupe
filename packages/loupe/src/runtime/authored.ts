// The app's props vs the ones a library injected (PER-96, PER-123). At runtime the
// two look the same: a Button cloned by Base UI's `render` receives its call
// site's `variant` next to Base UI's `onClick`, `aria-expanded`, `id` and
// `data-slot`. Only the call site's source can tell them apart, so the loader
// records what it writes (`data-ds-writes`, PER-119) and this splits on that.

import { type CallSiteWrites, parseCallSiteWrites, WRITES_ATTRIBUTE } from "../writes.js";
import type { Props } from "./store.js";

/**
 * `recorded`: the call site's record separates the two.
 * `spreads`: the call site spreads props, so every live prop counts as the app's.
 * `unrecorded`: no usable record (an unanchored Adapter); every live prop counts as the app's.
 */
export type Authorship = "recorded" | "spreads" | "unrecorded";

export type Split = {
  /** The app's own props: the Current value. */
  current: Props;
  /** What a library set; empty unless `authorship` is `recorded`. */
  injected: Props;
  authorship: Authorship;
};

/** Reads the record off the props the call site passed, or null when there is none. */
export function writesOf(props: Props): CallSiteWrites | null {
  return parseCallSiteWrites(props[WRITES_ATTRIBUTE]);
}

/** Splits live props, already without the loader's attributes, by the call site's record. */
export function splitAuthored(props: Props, writes: CallSiteWrites | null): Split {
  if (writes === null) return { current: props, injected: {}, authorship: "unrecorded" };
  if (writes.spreads) return { current: props, injected: {}, authorship: "spreads" };
  const written = new Set(writes.attributes.map((attribute) => attribute.name));
  if (writes.children !== "none") written.add("children");
  const current: Props = {};
  const injected: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (written.has(key)) current[key] = value;
    else injected[key] = value;
  }
  return { current, injected, authorship: "recorded" };
}
