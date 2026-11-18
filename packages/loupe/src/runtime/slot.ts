// Loupe's page state (PER-218): one hidden slot on `globalThis` that holds every
// value Loupe keeps for a page load. That covers the Instance registry, the Proposal
// tracker, the Snapshots, the export form, and the `window.__loupe` the page made.
// A module that Fast Refresh evaluates again finds the same values here, so
// Instances, Overrides and Snapshots survive an edit. A reload starts the page
// over, and `resetLoupe()` does the same for tests.
//
// The key is a `Symbol.for`, not a property name. The symbol registry is global,
// so a module evaluated again finds the same key, and the slot stays out of the
// console's autocomplete beside `__loupe`. This file imports nothing of Loupe's,
// so any of its modules can keep a value here.

export type PerPageOptions<T> = {
  /** Called when `resetLoupe()` drops the value: stop listening, clear timers. */
  stop?(value: T): void;
  /** What `resetLoupe()` keeps in the value's place instead of dropping it. */
  restart?(value: T): T;
};

type Part = { value: unknown } & PerPageOptions<unknown>;

const SLOT = Symbol.for("loupe.state");

/** Per key, in the order the values were made. */
function slot(): Map<string, Part> {
  const host = globalThis as typeof globalThis & { [SLOT]?: Map<string, Part> };
  host[SLOT] ??= new Map();
  return host[SLOT];
}

/**
 * The page's value for `key`. It's made on first use and kept, across a Fast
 * Refresh, until the page reloads or `resetLoupe()` runs. The options that count
 * are the ones the value was made with. A module evaluated again finds the value
 * as it was, with its `stop` and `restart`.
 */
export function perPage<T>(key: string, make: () => T, options?: PerPageOptions<T>): T {
  const parts = slot();
  const part = parts.get(key);
  if (part) return part.value as T;
  const value = make();
  parts.set(key, { value, ...(options as PerPageOptions<unknown> | undefined) });
  return value;
}

/**
 * Starts Loupe over as a page load does. Tests call it, and the page never does.
 * Values go newest first, so one made from another stops before the one it was
 * made from. A value with `restart` is replaced in place. Every other value is
 * dropped, then stopped.
 */
export function resetLoupe(): void {
  const parts = slot();
  for (const [key, part] of [...parts].reverse()) {
    if (part.restart) {
      parts.set(key, { ...part, value: part.restart(part.value) });
      continue;
    }
    parts.delete(key);
    part.stop?.(part.value);
  }
}
