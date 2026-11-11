// Call-site identity (PER-95). A call site is named by where it sits among the
// uses of the same component inside its enclosing component, never by its line:
//
//   id    fixture/app/components/product/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[2]
//   hint  fixture/app/components/product/member-row-menu.tsx:42:11 2/2
//
// The id survives line shifts, prop edits and wrapping. The hint moves with every
// edit and is for display and jump-to-source only: nothing may key on it.
// The loader, `generate` and the Proposal all name call sites through this module.

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

const SEPARATOR = " › ";
const ID_PATTERN = /^(.+) › (.+) › (.+)\[(\d+)\]$/;

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

export function callSiteHint(key: CallSiteKey, position: CallSitePosition): string {
  return `${key.path}:${position.line}:${position.column} ${key.ordinal}/${position.total}`;
}

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
