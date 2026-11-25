// Structural sharing (2026-11-24): `panelView()` builds every row, group and word object
// afresh on each call, so without this every pattern sees new props whenever anything
// on the page or in the selection moves, and React Compiler's memoised components can
// skip nothing. `share(previous, next)` walks the new view beside the last one and keeps
// the last one's object wherever the new one is deeply equal to it: an unchanged row,
// group or notice keeps its identity, and only what changed (and the objects holding it)
// is new.
//
// It compares the view as data, after `panelView()` has decided it: whatever input moved
// (the scope, the selection, the page's version, the layer), only rows whose words or
// data changed come out new. A cache keyed by Instance and prop would have to know which
// inputs each row reads; this needs to know nothing about them.

const isPlain = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Two sets with the same members, compared without making an array: the components seen, the outlines landed. */
export function sameMembers(a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean {
  if (a.size !== b.size) return false;
  for (const member of b) if (!a.has(member)) return false;
  return true;
}

/**
 * `next`, with every part deeply equal to the same part of `previous` replaced by
 * `previous`'s object. Returns `previous` itself when the two are deeply equal. Plain
 * objects and arrays are compared by their contents (arrays by index), a Set by its
 * members; anything else (a function, a Map, a class instance) only by identity.
 * Never changes either argument.
 */
export function share<T>(previous: unknown, next: T): T {
  if (Object.is(previous, next)) return next;
  if (Array.isArray(next)) {
    if (!Array.isArray(previous)) return next;
    let same = previous.length === next.length;
    let reused = false;
    const out = next.map((item, index) => {
      const kept = index < previous.length ? share(previous[index], item) : item;
      if (!Object.is(kept, previous[index])) same = false;
      if (!Object.is(kept, item)) reused = true;
      return kept;
    });
    return (same ? previous : reused ? out : next) as T;
  }
  if (isPlain(next)) {
    if (!isPlain(previous)) return next;
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(previous).length;
    let reused = false;
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const had = Object.hasOwn(previous, key);
      const kept = had ? share(previous[key], next[key]) : next[key];
      if (!had || !Object.is(kept, previous[key])) same = false;
      if (!Object.is(kept, next[key])) reused = true;
      out[key] = kept;
    }
    // Nothing of the last one kept inside it: `next` as it is.
    return (same ? previous : reused ? out : next) as T;
  }
  if (next instanceof Set && previous instanceof Set && sameMembers(previous, next)) return previous as T;
  return next;
}
