// What the touch points share: JSON and TypeScript helpers, and how a revert is
// checked (PER-126). Each revert proposes candidates for the original; the one
// its own `apply` turns back into today's text byte for byte is the file as it
// was before `init`. When none does (a hand edit moved things), the revert's own
// fallback is used, which takes out only what Loupe wrote.

// jsonc-parser ships UMD as `main`, which Node can't read named exports from.
import jsonc from "jsonc-parser";
import ts from "typescript";
import type { Reverted, TouchPoint } from "../touch-points.js";
import { canonical, lineStart, parse } from "../syntax.js";

// ── Reverting ────────────────────────────────────────────────────────────────

/** Likeliest original first; `fallback` is what to use when no candidate redoes exactly. */
export type Candidates = { candidates: string[]; fallback: string } | { manual: string };

/** The candidate `tp` would turn back into `text`, else the fallback, unless that still holds a Loupe edit. */
export function revertTo(tp: Pick<TouchPoint, "find" | "apply">, text: string, proposed: Candidates, summary: string): Reverted {
  if ("manual" in proposed) return proposed;
  const exact = proposed.candidates.find((c) => {
    if (tp.find(c) !== undefined) return false;
    const redone = tp.apply(c);
    return "text" in redone && redone.text === text;
  });
  if (exact !== undefined) return { text: exact, summary };
  if (tp.find(proposed.fallback) !== undefined) return { manual: "couldn't take Loupe's edit out on its own" };
  return { text: proposed.fallback, summary };
}

export type Range = [start: number, end: number];

/** Replaces ranges, which must not overlap, with `replacements` (default: nothing). */
export function cut(text: string, ranges: Range[], replacements: string[] = []): string {
  const order = ranges.map((r, i) => ({ r, with: replacements[i] ?? "" })).sort((a, b) => b.r[0] - a.r[0]);
  let out = text;
  for (const { r, with: w } of order) out = `${out.slice(0, r[0])}${w}${out.slice(r[1])}`;
  return out;
}

/** The node's own line(s), newline included, when nothing else shares them; else just the node. */
export function lines(text: string, start: number, end: number): Range {
  const from = lineStart(text, start);
  const eol = text.indexOf("\n", end);
  const to = eol === -1 ? text.length : eol + 1;
  const alone = /^[ \t]*$/.test(text.slice(from, start)) && /^[ \t]*$/.test(text.slice(end, eol === -1 ? text.length : eol));
  return alone ? [from, to] : [start, end];
}

// ── JSON ─────────────────────────────────────────────────────────────────────

export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readObject(text: string): JsonObject | undefined {
  const errors: jsonc.ParseError[] = [];
  const value: unknown = jsonc.parse(text, errors);
  return errors.length === 0 && isRecord(value) ? value : undefined;
}

export function jsonFormatting(text: string): jsonc.FormattingOptions {
  const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? "  ";
  return indent.startsWith("\t")
    ? { insertSpaces: false, tabSize: 1, eol: "\n" }
    : { insertSpaces: true, tabSize: indent.length, eol: "\n" };
}

// ── TypeScript ───────────────────────────────────────────────────────────────

export function hasDefaultModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

export function isIdentifier(node: ts.Node, name: string): boolean {
  return ts.isIdentifier(node) && node.text === name;
}

export function defaultExportAssignment(sf: ts.SourceFile): ts.ExportAssignment | undefined {
  return sf.statements.find((s): s is ts.ExportAssignment => ts.isExportAssignment(s) && !s.isExportEquals);
}

/** The first node, depth first, that passes `test`. */
export function findNode(root: ts.Node, test: (n: ts.Node) => boolean): ts.Node | undefined {
  let found: ts.Node | undefined;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (test(n)) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(root);
  return found;
}

/** Every node that passes `test`, without looking inside one that does. */
export function findAll(root: ts.Node, test: (n: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (n: ts.Node): void => {
    if (test(n)) found.push(n);
    else ts.forEachChild(n, visit);
  };
  visit(root);
  return found;
}

/** An import line as `canonical` prints it. */
export function canonicalImport(line: string): string {
  const sf = parse("import.ts", line);
  return canonical(sf.statements[0] as ts.Statement, sf);
}
