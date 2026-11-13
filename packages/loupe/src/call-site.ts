// Call-site grammar (PER-95). The one module that knows how Loupe writes and reads
// the three strings that name a call site and its Instances:
//
//   anchor       fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[2]
//   Instance id  <anchor>#user_1/0~2
//   hint         fixture/app/components/product/member-row-menu.tsx:42:11 2/2
//
// The anchor (the call-site id, `data-ds-anchor`) names a call site by where it
// sits among the uses of the same component inside its enclosing component, never
// by its line, so it survives line shifts, prop edits and wrapping.
//
// The Instance id is the anchor, then `#` and the app-authored key path when there
// is one, then `~n` (n ≥ 2, mount order) when the same base is already mounted:
// the same call site rendered twice with no key to tell them apart.
//
// The hint (`data-ds-source`) moves with every edit and is for display and
// jump-to-source only: nothing may key on it. Its total is the one exception: the
// hop guard (PER-125) compares it.
//
// The loader, `generate`, the runtime, the Toolbar and the Proposal all go through
// this module: nothing else splits on the separators or the `#`, `~n` and `[n]` suffixes.

/** The attribute the loader writes the anchor into. */
export const ANCHOR_ATTRIBUTE = "data-ds-anchor";
/** The attribute the loader writes the hint into. */
export const SOURCE_ATTRIBUTE = "data-ds-source";

/** JSX at module top level, outside any named function. */
export const MODULE_SCOPE = "<module>";
/** An anonymous `export default function` or `export default memo(...)`. */
export const DEFAULT_EXPORT_SCOPE = "<default>";

export type CallSiteKey = {
  /** POSIX path relative to the repo root. */
  path: string;
  /** Nearest named function or function-valued `const` around the JSX. */
  enclosing: string;
  /** The imported name, so `import { Button as B }` still counts as Button. */
  component: string;
  /** 1-based position among this component's uses in `enclosing`, in source order. */
  ordinal: number;
};

export type CallSitePosition = {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  /** How many uses of `component` there are in `enclosing`. */
  total: number;
};

/** A hint read back: where the call site was when the page rendered. */
export type CallSiteHint = { path: string; line: number; column: number; ordinal: number; total: number };

const SEPARATOR = " › ";
const ID_PATTERN = /^(.+) › (.+) › (.+)\[(\d+)\]$/;
const HINT_PATTERN = /^(.*):(\d+):(\d+) (\d+)\/(\d+)$/;
const KEY_MARK = "#";
const DUPLICATE_MARK = "~";
const DUPLICATE_SUFFIX = /~\d+$/;
const ORDINAL_SUFFIX = /\[\d+\]$/;
/** The anchor's first segment for an Adapter rendered where the loader added none. */
const UNANCHORED = "<unanchored>";

// ── Anchor ──────────────────────────────────────────────────────────────────

export function callSiteId(key: CallSiteKey): string {
  return `${key.path}${SEPARATOR}${key.enclosing}${SEPARATOR}${key.component}[${key.ordinal}]`;
}

export function parseCallSiteId(id: string): CallSiteKey | null {
  const match = ID_PATTERN.exec(id);
  if (!match) return null;
  const [, path, enclosing, component, ordinal] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  return { path, enclosing, component, ordinal: Number(ordinal) };
}

/** The anchor of an Adapter rendered where the loader added none. It names no call site. */
export function unanchoredId(component: string): string {
  return `${UNANCHORED}${SEPARATOR}${component}`;
}

/** Whether `anchor` came from `unanchoredId`: there is no call site to scope a group to. */
export function isUnanchored(anchor: string): boolean {
  return anchor.startsWith(UNANCHORED);
}

/**
 * What a held page-scope record shows where a call site's anchor would go: the
 * route and the component. Not an anchor: `parseCallSiteId` reads it as null.
 */
export function pageAnchor(route: string, component: string): string {
  return `${route}${SEPARATOR}${component}`;
}

// ── Instance id ─────────────────────────────────────────────────────────────

/** The anchor, then `#` and the key path when there is one. */
export function instanceId(anchor: string, keyPath: string): string {
  return keyPath === "" ? anchor : `${anchor}${KEY_MARK}${keyPath}`;
}

/** `base`, or `base~2`, `~3`… when `taken` already holds it. */
export function uniqueId(base: string, taken: { has(id: string): boolean }): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}${DUPLICATE_MARK}${n}`;
  return id;
}

/** Whether `id` is `base` or one of its mount-order duplicates, `base~n`. */
export function sharesBase(id: string, base: string): boolean {
  return (
    id === base ||
    (id.startsWith(`${base}${DUPLICATE_MARK}`) && /^\d+$/.test(id.slice(base.length + DUPLICATE_MARK.length)))
  );
}

/**
 * An Instance id taken apart. `anchor` has no `~n`. `key` is everything after the
 * first `#`: the key path, with a keyed duplicate's `~n` still on it. Empty when
 * the Instance has no key path, in which case an unkeyed duplicate's `~n` is dropped.
 * An anchor passes through as itself with an empty key.
 */
export function parseInstanceId(id: string): { anchor: string; key: string } {
  const mark = id.indexOf(KEY_MARK);
  const base = mark === -1 ? id : id.slice(0, mark);
  return { anchor: base.replace(DUPLICATE_SUFFIX, ""), key: mark === -1 ? "" : id.slice(mark + KEY_MARK.length) };
}

// ── Labels ──────────────────────────────────────────────────────────────────

export type CallSiteLabels = {
  /** `Button`: the component, also for an unanchored or duplicated Instance. */
  component: string;
  /** `MemberRowMenu`; null when the anchor names no call site. */
  enclosing: string | null;
  /** `Button[2]`: the anchor's last segment. */
  site: string;
  /** `MemberRowMenu › Button[2]#user_1~2`: the last two segments, with what follows them. */
  short: string;
  /** `#user_1~2`: what tells repeated Instances apart; empty for an anchor or an unkeyed Instance. */
  key: string;
};

/** The short names the Toolbar and the report show for an anchor or an Instance id. */
export function callSiteLabels(idOrAnchor: string): CallSiteLabels {
  const { anchor, key } = parseInstanceId(idOrAnchor);
  const site = anchor.split(SEPARATOR).at(-1) ?? anchor;
  return {
    component: site.replace(ORDINAL_SUFFIX, ""),
    enclosing: parseCallSiteId(anchor)?.enclosing ?? null,
    site,
    short: idOrAnchor.split(SEPARATOR).slice(-2).join(SEPARATOR),
    key: key === "" ? "" : `${KEY_MARK}${key}`,
  };
}

// ── Hint ────────────────────────────────────────────────────────────────────

export function callSiteHint(key: CallSiteKey, position: CallSitePosition): string {
  return `${key.path}:${position.line}:${position.column} ${key.ordinal}/${position.total}`;
}

/** A hint read back, or null when there is no hint or it isn't one. For display, and the hop guard's total. */
export function parseHint(hint: string | null): CallSiteHint | null {
  const match = hint === null ? null : HINT_PATTERN.exec(hint);
  if (!match) return null;
  const [, path, line, column, ordinal, total] = match as unknown as [string, string, string, string, string, string];
  return { path, line: Number(line), column: Number(column), ordinal: Number(ordinal), total: Number(total) };
}

// ── Ordinals ────────────────────────────────────────────────────────────────

export type Occurrence = {
  enclosing: string;
  component: string;
  /** Source offset of the JSX element; orders occurrences. */
  start: number;
};

/**
 * Numbers each occurrence within its (enclosing, component) group, in source
 * order. Returns the ordinal and total for each input, in input order.
 */
export function assignOrdinals(
  occurrences: readonly Occurrence[],
): { ordinal: number; total: number }[] {
  const groups = new Map<string, number[]>();
  occurrences.forEach((occurrence, index) => {
    const key = `${occurrence.enclosing}\u0000${occurrence.component}`;
    const group = groups.get(key);
    if (group) group.push(index);
    else groups.set(key, [index]);
  });

  const result: { ordinal: number; total: number }[] = occurrences.map(() => ({
    ordinal: 0,
    total: 0,
  }));
  for (const group of groups.values()) {
    group.sort((a, b) => (occurrences[a]?.start ?? 0) - (occurrences[b]?.start ?? 0));
    group.forEach((index, position) => {
      result[index] = { ordinal: position + 1, total: group.length };
    });
  }
  return result;
}
