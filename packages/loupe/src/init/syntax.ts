import { createHash } from "node:crypto";
import ts from "typescript";

/** sha256 hex of a string. */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Generated files are hashed with their line endings normalised to LF (PER-93). */
export function fileHash(content: string): string {
  return sha256(content.replace(/\r\n?/g, "\n"));
}

export function parse(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

/**
 * The AST-normalised form of an inserted node: reprinted, without comments,
 * parentheses or the source's quote style. Whitespace and quotes are formatting;
 * anything else that changes this string is a hand edit.
 */
export function canonical(node: ts.Node, sf: ts.SourceFile): string {
  const strip: ts.TransformerFactory<ts.Node> = (context) => {
    const visit = (n: ts.Node): ts.Node => {
      if (ts.isParenthesizedExpression(n)) return visit(n.expression);
      if (ts.isStringLiteral(n)) return ts.factory.createStringLiteral(n.text);
      return ts.visitEachChild(n, visit, context);
    };
    return (root) => visit(root);
  };
  const result = ts.transform(node, [strip]);
  try {
    return printer.printNode(ts.EmitHint.Unspecified, result.transformed[0] as ts.Node, sf);
  } finally {
    result.dispose();
  }
}

export function unwrap(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
}

/** The import declaration that brings `name` in from `from`, if any. */
export function findImport(sf: ts.SourceFile, name: string, from: string): ts.ImportDeclaration | undefined {
  return sf.statements.find(
    (s): s is ts.ImportDeclaration =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === from &&
      importsName(s, name),
  );
}

/** Whether any import in the file binds `name`. */
export function bindsName(sf: ts.SourceFile, name: string): boolean {
  return sf.statements.some((s) => ts.isImportDeclaration(s) && importsName(s, name));
}

function importsName(decl: ts.ImportDeclaration, name: string): boolean {
  const clause = decl.importClause;
  if (!clause) return false;
  if (clause.name?.text === name) return true;
  const bindings = clause.namedBindings;
  if (!bindings) return false;
  if (ts.isNamespaceImport(bindings)) return bindings.name.text === name;
  return bindings.elements.some((e) => e.name.text === name);
}

/**
 * Where a new package import goes: before the first package import whose
 * specifier sorts after it, so a sorted import block stays sorted; otherwise
 * after the last import. Side-effect and relative imports are skipped.
 */
export function insertImport(text: string, sf: ts.SourceFile, line: string, from: string): string {
  const imports = sf.statements.filter(ts.isImportDeclaration);
  const after = imports.find((s) => {
    if (!s.importClause || !ts.isStringLiteral(s.moduleSpecifier)) return false;
    const spec = s.moduleSpecifier.text;
    return !spec.startsWith(".") && spec > from;
  });
  if (after) {
    const at = lineStart(text, after.getStart(sf));
    return `${text.slice(0, at)}${line}\n${text.slice(at)}`;
  }
  const last = imports.at(-1);
  if (last) return `${text.slice(0, last.end)}\n${line}${text.slice(last.end)}`;
  return `${line}\n${text}`;
}

export function lineStart(text: string, offset: number): number {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

/** The whitespace that opens the line holding `offset`. */
export function indentAt(text: string, offset: number): string {
  const start = lineStart(text, offset);
  return /^[ \t]*/.exec(text.slice(start))?.[0] ?? "";
}
