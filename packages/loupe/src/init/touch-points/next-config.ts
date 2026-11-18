// The app's next.config.ts: withLoupe, imported from the Product layer and
// wrapped around the default export, outermost.

import ts from "typescript";
import { PRODUCT_LAYER } from "../../names.js";
import {
  bindsName,
  canonical,
  canonicalImport,
  defaultExportAssignment,
  findAll,
  findImport,
  findNode,
  hasDefaultModifier,
  insertImport,
  isIdentifier,
  parse,
  unwrap,
} from "../syntax.js";
import type { TouchPoint } from "../touch-points.js";
import { type Candidates, cut, lines, type Range, revertToCandidate } from "./shared.js";

const NEXT_MODULE = `${PRODUCT_LAYER.name}/next`;
const NEXT_IMPORT = `import { withLoupe } from "${NEXT_MODULE}";`;

const isWithLoupeCall = (n: ts.Node) => ts.isCallExpression(n) && isIdentifier(n.expression, "withLoupe");

/** The touch point in `file`, the app's next.config. */
export function nextConfig(file: string): TouchPoint {
  const tp: TouchPoint = {
    id: "next-config",
    role: "imports-layer",
    file,
    applyByHand: [
      `In ${file}, import withLoupe:`,
      `  ${NEXT_IMPORT}`,
      "and make it the outermost wrapper of the default export:",
      "  export default withLoupe(<your config>);",
    ],
    revertByHand: "remove the withLoupe import and unwrap the default export: withLoupe(<your config>) becomes <your config>",
    find(text) {
      const sf = parse(file, text);
      const imp = findImport(sf, "withLoupe", NEXT_MODULE);
      const call = findNode(sf, isWithLoupeCall);
      if (!imp && !call) return undefined;
      const exported = defaultExportAssignment(sf);
      const outer = exported ? unwrap(exported.expression) : undefined;
      const exact =
        imp !== undefined &&
        canonical(imp, sf) === canonicalImport(NEXT_IMPORT) &&
        outer !== undefined &&
        outer === call &&
        ts.isCallExpression(outer) &&
        outer.arguments.length === 1;
      // Only the wrapper is Loupe's: its argument is the app's config and may change freely.
      const wrapper = call && ts.isCallExpression(call)
        ? `withLoupe(${call.arguments.length} argument${call.arguments.length === 1 ? "" : "s"})${call === outer ? ", outermost" : ""}`
        : "";
      return { canonical: `${imp ? canonical(imp, sf) : ""}\n${wrapper}`, exact };
    },
    apply(text) {
      if (text === undefined) return { unexpected: `${file} doesn't exist.` };
      if (!file.endsWith(".ts") && !file.endsWith(".mts")) return { unexpected: `${file} isn't TypeScript.` };
      const sf = parse(file, text);
      if (bindsName(sf, "withLoupe")) return { unexpected: `${file} already imports a withLoupe.` };
      const assignments = sf.statements.filter((s) => ts.isExportAssignment(s) && !s.isExportEquals);
      const otherDefaults = sf.statements.some(
        (s) =>
          hasDefaultModifier(s) ||
          (ts.isExportDeclaration(s) &&
            s.exportClause !== undefined &&
            ts.isNamedExports(s.exportClause) &&
            s.exportClause.elements.some((e) => e.name.text === "default")),
      );
      const [assignment] = assignments as ts.ExportAssignment[];
      if (!assignment || assignments.length > 1 || otherDefaults) {
        return { unexpected: `${file} doesn't have exactly one \`export default <expression>\`.` };
      }
      const value = unwrap(assignment.expression);
      if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
        return { unexpected: `${file} exports a function, not a config object.` };
      }
      const expr = assignment.expression;
      const start = expr.getStart(sf);
      const wrapped = `${text.slice(0, start)}withLoupe(${text.slice(start, expr.end)})${text.slice(expr.end)}`;
      const withImport = insertImport(wrapped, parse(file, wrapped), NEXT_IMPORT, NEXT_MODULE);
      return { text: withImport, summary: "wrapped the default export in withLoupe" };
    },
    revert(text) {
      return revertToCandidate(tp, text, candidates(file, text), "unwrapped the default export and removed the withLoupe import");
    },
  };
  return tp;
}

function candidates(file: string, text: string): Candidates {
  const sf = parse(file, text);
  const imp = findImport(sf, "withLoupe", NEXT_MODULE);
  const calls = findAll(sf, isWithLoupeCall);
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
