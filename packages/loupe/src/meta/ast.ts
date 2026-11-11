import type * as tsm from "ts-morph";
import type { Destructured } from "./policy.js";
import type { ComponentShape } from "./types.js";

type Ns = typeof tsm;

/** Syntax-only reads both engines share; nothing here asks the checker for a type. */
export function hasUseClient(ns: Ns, sf: tsm.SourceFile): boolean {
  for (const statement of sf.getStatements()) {
    if (!ns.Node.isExpressionStatement(statement)) return false;
    const expression = statement.getExpression();
    if (!ns.Node.isStringLiteral(expression)) return false;
    if (expression.getLiteralValue() === "use client") return true;
  }
  return false;
}

function unwrap(ns: Ns, node: tsm.Node | undefined): tsm.Node | undefined {
  let current = node;
  while (
    current &&
    (ns.Node.isParenthesizedExpression(current) ||
      ns.Node.isAsExpression(current) ||
      ns.Node.isSatisfiesExpression(current))
  ) {
    current = current.getExpression();
  }
  return current;
}

function calleeName(ns: Ns, call: tsm.CallExpression): string {
  const callee = call.getExpression();
  return ns.Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText();
}

export function shapeOf(ns: Ns, name: string, decl: tsm.Node, sf: tsm.SourceFile): ComponentShape {
  if (decl.getSourceFile() !== sf) return "re-export";
  if (name === "default") return "default-export";
  if (ns.Node.isFunctionDeclaration(decl)) return "function";
  if (ns.Node.isClassDeclaration(decl)) return "class";
  if (!ns.Node.isVariableDeclaration(decl)) return "unknown";
  const init = unwrap(ns, decl.getInitializer());
  if (!init) return "unknown";
  if (ns.Node.isArrowFunction(init) || ns.Node.isFunctionExpression(init)) return "function";
  if (ns.Node.isIdentifier(init) || ns.Node.isPropertyAccessExpression(init)) return "alias";
  if (!ns.Node.isCallExpression(init)) return "unknown";
  const callee = calleeName(ns, init);
  if (callee === "forwardRef" || callee === "memo" || callee === "lazy") return callee;
  return "unknown";
}

/** The function whose first parameter holds the props, through `forwardRef` / `memo`. */
export function componentFunction(ns: Ns, decl: tsm.Node): tsm.Node | undefined {
  if (ns.Node.isFunctionDeclaration(decl)) return decl;
  let node = ns.Node.isVariableDeclaration(decl) ? unwrap(ns, decl.getInitializer()) : undefined;
  for (let depth = 0; node && depth < 3; depth += 1) {
    if (ns.Node.isArrowFunction(node) || ns.Node.isFunctionExpression(node)) return node;
    if (!ns.Node.isCallExpression(node)) return undefined;
    node = unwrap(ns, node.getArguments()[0]);
  }
  return undefined;
}

/** Initializers in the props binding pattern, resolved to literals where the checker can. */
export function destructureDefaults(ns: Ns, fn: tsm.Node | undefined): Record<string, Destructured> {
  const result: Record<string, Destructured> = {};
  if (!fn || !(ns.Node.isFunctionDeclaration(fn) || ns.Node.isArrowFunction(fn) || ns.Node.isFunctionExpression(fn))) {
    return result;
  }
  const first = fn.getParameters()[0]?.getNameNode();
  if (!first || !ns.Node.isObjectBindingPattern(first)) return result;
  for (const element of first.getElements()) {
    const init = element.getInitializer();
    if (!init) continue;
    const name = element.getPropertyNameNode()?.getText() ?? element.getName();
    const t = init.getType();
    if (t.isStringLiteral() || t.isNumberLiteral() || t.isEnumLiteral()) {
      const value = t.getLiteralValue();
      if (typeof value === "string" || typeof value === "number") {
        result[name] = { value };
        continue;
      }
    }
    if (t.isBooleanLiteral()) result[name] = { value: t.getText() === "true" };
    else if (t.isNull()) result[name] = { value: null };
    else result[name] = { value: null, expression: init.getText() };
  }
  return result;
}
