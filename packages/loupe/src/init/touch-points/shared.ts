// What the touch points share: how a revert is checked (PER-126), and the JSON
// helpers. Each revert proposes candidates for the original; the one its own
// `apply` turns back into today's text byte for byte is the file as it was
// before `init`. When none does (a hand edit moved things), the revert's own
// fallback is used, which takes out only what Loupe wrote.

// jsonc-parser ships UMD as `main`, which Node can't read named exports from.
import jsonc from "jsonc-parser";
import { lineStart } from "../syntax.js";
import type { Reverted, TouchPoint } from "../touch-points.js";

// ── Reverting ────────────────────────────────────────────────────────────────

/** Likeliest original first; `fallback` is what to use when no candidate redoes exactly. */
export type Candidates = { candidates: string[]; fallback: string } | { manual: string };

/**
 * The first candidate that holds no Loupe edit and that `tp.apply` turns back into `text` byte for byte;
 * else the fallback, unless that still holds a Loupe edit, which makes it a manual step.
 */
export function revertToCandidate(tp: Pick<TouchPoint, "find" | "apply">, text: string, proposed: Candidates, summary: string): Reverted {
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

/** A span of text, as offsets. */
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

/** `text` parsed as JSON with comments, when it is an object. */
export function readObject(text: string): JsonObject | undefined {
  const errors: jsonc.ParseError[] = [];
  const value: unknown = jsonc.parse(text, errors);
  return errors.length === 0 && isRecord(value) ? value : undefined;
}

/** How jsonc-parser should format an insertion so it matches `text`'s indentation. */
export function jsonFormatting(text: string): jsonc.FormattingOptions {
  const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? "  ";
  return indent.startsWith("\t")
    ? { insertSpaces: false, tabSize: 1, eol: "\n" }
    : { insertSpaces: true, tabSize: indent.length, eol: "\n" };
}
