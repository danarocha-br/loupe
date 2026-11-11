// The inverse of each touch point's edit (PER-126). Every undo proposes
// candidates; the one `edit` turns back into today's text byte for byte is the
// file as it was before `init`. When none does (a hand edit moved things), the
// undo's own fallback is used, which takes out only what Loupe wrote.

// jsonc-parser ships UMD as `main`, which Node can't read named exports from.
import jsonc from "jsonc-parser";
import ts from "typescript";
import { findImport, lineStart, parse } from "../init/syntax.js";
import {
  BIOME_COMMENT,
  containsMount,
  EXCLUSION,
  NPM_PACKAGE,
  PRODUCT_LAYER,
  type TouchPoint,
  type TouchPointId,
} from "../init/touch-points.js";

export type Undo = { text: string } | { manual: string };

/** Likeliest original first; `fallback` is what to use when no candidate redoes exactly. */
type Candidates = { candidates: string[]; fallback: string } | { manual: string };

const NPM_NAMES = [NPM_PACKAGE, PRODUCT_LAYER.name];

/** What to undo by hand, per touch point, when `remove` leaves one alone. */
export const undoByHand: Record<TouchPointId, string> = {
  "root-layout": `remove the LoupeMount import and the {process.env.NODE_ENV === "development" && <LoupeMount />} block`,
  "next-config": "remove the withLoupe import and unwrap the default export: withLoupe(<your config>) becomes <your config>",
  "package-json": `remove ${NPM_NAMES.join(" and ")} from "devDependencies", then run pnpm install`,
  "biome-config": `remove "${EXCLUSION}" and the comment above it from "files.includes"`,
};

export function undo(tp: TouchPoint, text: string): Undo {
  const proposed = candidatesFor(tp, text);
  if ("manual" in proposed) return proposed;
  const exact = proposed.candidates.find((c) => {
    if (tp.find(c) !== undefined) return false;
    const redone = tp.edit(c);
    return "text" in redone && redone.text === text;
  });
  if (exact !== undefined) return { text: exact };
  if (tp.find(proposed.fallback) !== undefined) return { manual: "couldn't take Loupe's edit out on its own" };
  return { text: proposed.fallback };
}

function candidatesFor(tp: TouchPoint, text: string): Candidates {
  switch (tp.id) {
    case "root-layout":
      return rootLayout(tp.file, text);
    case "next-config":
      return nextConfig(tp.file, text);
    case "package-json":
      return packageJson(text);
    case "biome-config":
      return biomeConfig(text);
  }
}

type Range = [start: number, end: number];

/** Replaces ranges, which must not overlap, with `replacements` (default: nothing). */
function cut(text: string, ranges: Range[], replacements: string[] = []): string {
  const order = ranges.map((r, i) => ({ r, with: replacements[i] ?? "" })).sort((a, b) => b.r[0] - a.r[0]);
  let out = text;
  for (const { r, with: w } of order) out = `${out.slice(0, r[0])}${w}${out.slice(r[1])}`;
  return out;
}

/** The node's own line(s), newline included, when nothing else shares them; else just the node. */
function lines(text: string, start: number, end: number): Range {
  const from = lineStart(text, start);
  const eol = text.indexOf("\n", end);
  const to = eol === -1 ? text.length : eol + 1;
  const alone = /^[ \t]*$/.test(text.slice(from, start)) && /^[ \t]*$/.test(text.slice(end, eol === -1 ? text.length : eol));
  return alone ? [from, to] : [start, end];
}

// ── app/layout.tsx ───────────────────────────────────────────────────────────

function rootLayout(file: string, text: string): Candidates {
  const sf = parse(file, text);
  const imp = findImport(sf, "LoupeMount", `${PRODUCT_LAYER.name}/mount`);
  const blocks = findAll(sf, (n) => ts.isJsxExpression(n) && containsMount(n));
  const block = blocks[0];
  if (!imp || blocks.length !== 1 || !block) return { manual: "the LoupeMount import or block isn't where loupe init put it" };
  const start = block.getStart(sf);
  const from = lineStart(text, start);
  const importRange = lines(text, imp.getStart(sf), imp.end);
  if (from === 0 || !/^[ \t]*$/.test(text.slice(from, start))) {
    const only = cut(text, [importRange, [start, block.end]]);
    return { candidates: [only], fallback: only };
  }
  // init wrote `\n<indent>{block}`, plus `\n<indent>` when </body> shared the last child's line.
  // Both originals redo to the same text, so the tie goes to the likelier one: </body> on its own
  // line, unless what came before the block shares the <body> line.
  const own = cut(text, [importRange, [from - 1, block.end]]);
  const closing = /^\n[ \t]*(?=<\/body>)/.exec(text.slice(block.end))?.[0];
  if (!closing) return { candidates: [own], fallback: own };
  const shared = cut(text, [importRange, [from - 1, block.end + closing.length]]);
  const body = block.parent;
  const oneLine = ts.isJsxElement(body) && lineStart(text, from - 1) === lineStart(text, body.getStart(sf));
  return { candidates: oneLine ? [shared, own] : [own, shared], fallback: own };
}

// ── next.config.ts ───────────────────────────────────────────────────────────

function nextConfig(file: string, text: string): Candidates {
  const sf = parse(file, text);
  const imp = findImport(sf, "withLoupe", `${PRODUCT_LAYER.name}/next`);
  const calls = findAll(sf, (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "withLoupe");
  const call = calls[0];
  if (!imp || calls.length !== 1 || !call || !ts.isCallExpression(call) || call.arguments.length !== 1) {
    return { manual: "withLoupe isn't one call with one argument, as loupe init wrote it" };
  }
  const arg = call.arguments[0] as ts.Expression;
  const importRange = lines(text, imp.getStart(sf), imp.end);
  const callRange: Range = [call.getStart(sf), call.end];
  // Everything between the parentheses as written, then the bare argument.
  const between = cut(text, [importRange, callRange], ["", text.slice(call.arguments.pos, call.arguments.end)]);
  const bare = cut(text, [importRange, callRange], ["", text.slice(arg.getStart(sf), arg.end)]);
  return { candidates: [between, bare], fallback: between };
}

// ── package.json ─────────────────────────────────────────────────────────────

function packageJson(text: string): Candidates {
  const options = jsonFormatting(text);
  let next = text;
  for (const name of NPM_NAMES) {
    next = jsonc.applyEdits(next, jsonc.modify(next, ["devDependencies", name], undefined, { formattingOptions: options }));
  }
  const dev = (jsonc.parse(next) as { devDependencies?: unknown } | undefined)?.devDependencies;
  // An emptied "devDependencies" redoes the same as none at all; none is likelier, as init creates it.
  if (dev && typeof dev === "object" && Object.keys(dev).length === 0) {
    const without = jsonc.applyEdits(next, jsonc.modify(next, ["devDependencies"], undefined, { formattingOptions: options }));
    return { candidates: [without, next], fallback: next };
  }
  return { candidates: [next], fallback: next };
}

function jsonFormatting(text: string): jsonc.FormattingOptions {
  const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? "  ";
  return indent.startsWith("\t")
    ? { insertSpaces: false, tabSize: 1, eol: "\n" }
    : { insertSpaces: true, tabSize: indent.length, eol: "\n" };
}

// ── biome.jsonc ──────────────────────────────────────────────────────────────

function biomeConfig(text: string): Candidates {
  const tree = jsonc.parseTree(text, [], { allowTrailingComma: true });
  const includes = tree ? jsonc.findNodeAtLocation(tree, ["files", "includes"]) : undefined;
  const items = includes?.type === "array" ? (includes.children ?? []) : [];
  const index = items.findIndex((c) => c.value === EXCLUSION);
  const node = items[index];
  if (!node) return { manual: `"${EXCLUSION}" isn't in "files.includes"` };
  const previous = items[index - 1];
  const prevEnd = previous ? previous.offset + previous.length : undefined;
  const nodeEnd = node.offset + node.length;
  // The fallback takes out the entry's line and Loupe's comment line just above it,
  // never what else sits between, plus the comma that now has nothing after it.
  const trailing = /^[ \t]*,/.exec(text.slice(nodeEnd))?.[0] ?? "";
  const ranges: Range[] = [lines(text, node.offset, nodeEnd + trailing.length)];
  const entryLine = lineStart(text, node.offset);
  const above = entryLine > 0 ? lineStart(text, entryLine - 1) : -1;
  if (above >= 0 && text.slice(above, entryLine - 1).trim() === BIOME_COMMENT) ranges.push([above, entryLine]);
  const comma = prevEnd === undefined || trailing ? -1 : text.indexOf(",", prevEnd);
  if (comma !== -1 && comma < node.offset && /^\s*$/.test(text.slice(prevEnd, comma))) ranges.push([comma, comma + 1]);
  const fallback = cut(text, ranges);
  const candidates: string[] = [];
  if (prevEnd !== undefined) {
    // init wrote `,<comment><entry>` after the last entry, or `<comment><entry>,` after its trailing comma.
    candidates.push(cut(text, [[prevEnd, nodeEnd]]));
    const before = /^\s*,/.exec(text.slice(prevEnd))?.[0];
    const after = /^\s*,/.exec(text.slice(nodeEnd))?.[0];
    if (before && after) candidates.push(cut(text, [[prevEnd + before.length, nodeEnd + after.length]]));
  }
  return { candidates: [...candidates, fallback], fallback };
}

// ── shared ───────────────────────────────────────────────────────────────────

function findAll(root: ts.Node, test: (n: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (n: ts.Node): void => {
    if (test(n)) found.push(n);
    else ts.forEachChild(n, visit);
  };
  visit(root);
  return found;
}
