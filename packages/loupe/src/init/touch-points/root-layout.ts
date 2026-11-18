// The app's root layout: <LoupeMount />, imported from the Product layer and
// mounted in development as the last child of <body>.

import ts from "typescript";
import { PRODUCT_LAYER, type TouchPoint } from "../touch-points.js";
import { bindsName, canonical, findImport, indentAt, insertImport, lineStart, parse, unwrap } from "../syntax.js";
import {
  type Candidates,
  canonicalImport,
  cut,
  defaultExportAssignment,
  findAll,
  findNode,
  hasDefaultModifier,
  lines,
  revertTo,
} from "./shared.js";

const MOUNT_IMPORT = `import { LoupeMount } from "${PRODUCT_LAYER.name}/mount";`;
const MOUNT_BLOCK = `{process.env.NODE_ENV === "development" && <LoupeMount />}`;

export function rootLayout(file: string): TouchPoint {
  const tp: TouchPoint = {
    id: "root-layout",
    file,
    applyByHand: [
      `In ${file}, import the mount:`,
      `  ${MOUNT_IMPORT}`,
      "and add it as the last child of <body>, after every other block:",
      `  ${MOUNT_BLOCK}`,
    ],
    revertByHand: `remove the LoupeMount import and the {process.env.NODE_ENV === "development" && <LoupeMount />} block`,
    find(text) {
      const sf = parse(file, text);
      const imp = findImport(sf, "LoupeMount", `${PRODUCT_LAYER.name}/mount`);
      const block = findNode(sf, (n) => ts.isJsxExpression(n) && containsMount(n));
      if (!imp && !block) return undefined;
      const fn = defaultExportFunction(sf);
      const bodies = fn ? bodyElements(fn) : [];
      const only = bodies.length === 1 ? bodies[0] : undefined;
      const last = only && ts.isJsxElement(only) ? lastChild(only) : undefined;
      const exact =
        imp !== undefined &&
        canonical(imp, sf) === canonicalImport(MOUNT_IMPORT) &&
        block !== undefined &&
        last === block &&
        canonical(block, sf) === canonicalMount();
      return { canonical: [imp, block].map((n) => (n ? canonical(n, sf) : "")).join("\n"), exact };
    },
    apply(text) {
      if (text === undefined) return { unexpected: `${file} doesn't exist.` };
      const sf = parse(file, text);
      if (bindsName(sf, "LoupeMount")) return { unexpected: `${file} already imports a LoupeMount.` };
      const fn = defaultExportFunction(sf);
      if (!fn) return { unexpected: `${file} has no default-exported layout function.` };
      const bodies = bodyElements(fn);
      const [body] = bodies;
      if (!body || bodies.length > 1 || !ts.isJsxElement(body)) {
        return { unexpected: `${file} doesn't render exactly one <body> with children.` };
      }

      const close = body.closingElement.getStart(sf);
      const closeIndent = indentAt(text, close);
      const last = lastChild(body);
      const at = last ? last.end : body.openingElement.end;
      const childIndent = last && lineStart(text, last.getStart(sf)) > lineStart(text, body.getStart(sf))
        ? indentAt(text, last.getStart(sf))
        : `${closeIndent}  `;
      // A closing tag on the same line as the last child gets a line of its own.
      const sameLine = !text.slice(at, close).includes("\n");
      const insertion = `\n${childIndent}${MOUNT_BLOCK}${sameLine ? `\n${closeIndent}` : ""}`;
      const mounted = `${text.slice(0, at)}${insertion}${text.slice(at)}`;
      const withImport = insertImport(mounted, parse(file, mounted), MOUNT_IMPORT, `${PRODUCT_LAYER.name}/mount`);
      return { text: withImport, summary: "mounted <LoupeMount /> as the last child of <body>" };
    },
    revert(text) {
      return revertTo(tp, text, candidates(file, text), "removed <LoupeMount /> and its import");
    },
  };
  return tp;
}

function candidates(file: string, text: string): Candidates {
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
  // apply wrote `\n<indent>{block}`, plus `\n<indent>` when </body> shared the last child's line.
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

type FunctionLike = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;

function defaultExportFunction(sf: ts.SourceFile): FunctionLike | undefined {
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && hasDefaultModifier(s)) return s;
  }
  const assignment = defaultExportAssignment(sf);
  if (!assignment) return undefined;
  const value = unwrap(assignment.expression);
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
  if (!ts.isIdentifier(value)) return undefined;
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name?.text === value.text) return s;
    if (!ts.isVariableStatement(s)) continue;
    for (const d of s.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== value.text || !d.initializer) continue;
      const init = unwrap(d.initializer);
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
    }
  }
  return undefined;
}

/** Every `<body>`, self-closing ones included, so one of those makes the count wrong. */
function bodyElements(fn: ts.Node): (ts.JsxElement | ts.JsxSelfClosingElement)[] {
  const found: (ts.JsxElement | ts.JsxSelfClosingElement)[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === "body") found.push(n);
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText() === "body") found.push(n);
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}

/** The last child that isn't whitespace-only text. */
function lastChild(body: ts.JsxElement): ts.JsxChild | undefined {
  return [...body.children].reverse().find((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
}

function containsMount(n: ts.Node): boolean {
  if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText() === "LoupeMount") {
    return true;
  }
  return ts.forEachChild(n, containsMount) ?? false;
}

let mountCanonical: string | undefined;
function canonicalMount(): string {
  if (mountCanonical === undefined) {
    const sf = parse("mount.tsx", `const mount = <body>${MOUNT_BLOCK}</body>;`);
    const block = findNode(sf, ts.isJsxExpression);
    mountCanonical = block ? canonical(block, sf) : "";
  }
  return mountCanonical;
}
