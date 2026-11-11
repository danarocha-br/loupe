// What a call site writes (PER-96, PER-113). At runtime an authored prop and one a
// library injected look the same, and so do `Cancelar` and `{roleActionLabel}`:
// both are just strings. Only the source can tell them apart, so the loader reads
// it here and hands the record to the runtime on the element as `data-ds-writes`.

/** The JSX attribute carrying a call site's record, as a JSON string. */
export const WRITES_ATTRIBUTE = "data-ds-writes";

/**
 * How the call site writes a value. A literal (`variant="ghost"`, `{-1}`, a bare
 * `disabled`) is a one-line source edit; an expression comes from app logic.
 */
export type WrittenAs = "literal" | "expression";

export type AttributeWrite = {
  name: string;
  writtenAs: WrittenAs;
  /** The expression's source on one line, truncated. Absent for a literal. */
  expression?: string;
};

/**
 * What the call site writes as children, judged as React renders them:
 *   text       one piece of text and nothing else: JSXText, `{"…"}`, a template
 *              literal with no `${}`, entities allowed. Only this gets a text field.
 *   from-code  a variable, a catalogue string, any conditional, any other expression
 *   mixed      more than one of text, code and elements
 *   elements   elements only, such as an icon
 *   none       no children at all
 */
export type ChildrenKind = "text" | "from-code" | "mixed" | "elements" | "none";

export type CallSiteWrites = {
  /** The props the call site writes, in source order; `key` is not a prop. */
  attributes: AttributeWrite[];
  /** Whether it spreads props (`{...props}`), so its authored props can't be told apart. */
  spreads: boolean;
  children: ChildrenKind;
};

// A loose view of Babel's AST: the fields this module reads.
type Node = { type: string; start: number; end: number; [key: string]: unknown };

const EXPRESSION_LENGTH = 80;
const CHILDREN_KINDS: readonly ChildrenKind[] = ["text", "from-code", "mixed", "elements", "none"];

/**
 * Reads the record for one JSX element. `ignored` names attributes that are not
 * the call site's own, such as the anchors this loader added on an earlier pass.
 */
export function readCallSiteWrites(
  element: Node,
  source: string,
  ignored: ReadonlySet<string>,
): CallSiteWrites {
  const opening = element.openingElement as Node;
  const written = new Map<string, AttributeWrite>();
  let spreads = false;
  let childrenAttribute: Node | null | undefined;

  for (const attribute of opening.attributes as Node[]) {
    if (attribute.type === "JSXSpreadAttribute") {
      spreads = true;
      continue;
    }
    const name = attributeName(attribute.name as Node);
    if (name === "key" || ignored.has(name)) continue;
    const value = (attribute.value as Node | null) ?? null;
    if (name === "children") childrenAttribute = value;
    // A repeated name: the last one wins, as in React, at the first one's place.
    written.set(name, describeValue(name, value, source));
  }

  let children = classifyChildren((element.children as Node[] | undefined) ?? []);
  // React keeps a `children` attribute only when the element has no children of its own.
  if (children === "none" && childrenAttribute !== undefined) {
    children = childrenAttribute === null ? "from-code" : classifyChildren([childrenAttribute]);
  }

  return { attributes: [...written.values()], spreads, children };
}

/** The value of `WRITES_ATTRIBUTE` for a record. */
export function encodeCallSiteWrites(writes: CallSiteWrites): string {
  return JSON.stringify(writes);
}

/** Reads `WRITES_ATTRIBUTE` back, or null when it isn't a record this version wrote. */
export function parseCallSiteWrites(value: unknown): CallSiteWrites | null {
  if (typeof value !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { attributes, spreads, children } = data as Record<string, unknown>;
  if (!Array.isArray(attributes) || typeof spreads !== "boolean") return null;
  if (!CHILDREN_KINDS.includes(children as ChildrenKind)) return null;
  const valid = attributes.every((attribute: unknown) => {
    if (typeof attribute !== "object" || attribute === null) return false;
    const { name, writtenAs, expression } = attribute as Record<string, unknown>;
    return (
      typeof name === "string" &&
      (writtenAs === "literal" || writtenAs === "expression") &&
      (expression === undefined || typeof expression === "string")
    );
  });
  return valid ? (data as CallSiteWrites) : null;
}

function attributeName(name: Node): string {
  if (name.type === "JSXNamespacedName") {
    const namespace = name.namespace as { name: string };
    return `${namespace.name}:${(name.name as { name: string }).name}`;
  }
  return name.name as string;
}

function describeValue(name: string, value: Node | null, source: string): AttributeWrite {
  if (value === null || value.type === "StringLiteral") return { name, writtenAs: "literal" };
  const expression = value.type === "JSXExpressionContainer" ? (value.expression as Node) : value;
  if (isLiteral(expression)) return { name, writtenAs: "literal" };
  return { name, writtenAs: "expression", expression: shorten(source.slice(expression.start, expression.end)) };
}

function isLiteral(node: Node): boolean {
  switch (node.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BigIntLiteral":
    case "BooleanLiteral":
    case "NullLiteral":
      return true;
    case "TemplateLiteral":
      return (node.expressions as Node[]).length === 0;
    case "UnaryExpression":
      return (
        (node.operator === "-" || node.operator === "+") &&
        (node.argument as Node).type === "NumericLiteral"
      );
    default:
      return false;
  }
}

function shorten(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= EXPRESSION_LENGTH ? line : `${line.slice(0, EXPRESSION_LENGTH - 1)}…`;
}

type Piece = "text" | "space" | "code" | "elements";

function classifyChildren(nodes: readonly Node[]): ChildrenKind {
  const pieces = nodes.flatMap(piece);
  const kinds = new Set(pieces.filter((kind) => kind !== "space"));
  // A space between elements is not a label; a space alone is the whole text.
  if (kinds.size === 0) return pieces.length > 0 ? "text" : "none";
  if (kinds.size > 1) return "mixed";
  const [kind] = kinds;
  return kind === "code" ? "from-code" : kind === "elements" ? "elements" : "text";
}

function piece(node: Node): Piece[] {
  switch (node.type) {
    case "JSXText":
      return textPiece(node.value as string, true);
    case "StringLiteral":
      return textPiece(node.value as string, false);
    case "TemplateLiteral": {
      if ((node.expressions as Node[]).length > 0) return ["code"];
      const quasis = node.quasis as { value: { cooked: string | null } }[];
      return textPiece(quasis[0]?.value.cooked ?? "", false);
    }
    case "JSXElement":
    case "JSXFragment":
      return ["elements"];
    case "JSXExpressionContainer": {
      const expression = node.expression as Node;
      return expression.type === "JSXEmptyExpression" ? [] : piece(expression);
    }
    default:
      return ["code"];
  }
}

function textPiece(value: string, isJsxText: boolean): Piece[] {
  if (value.trim() !== "") return ["text"];
  // React drops JSXText that is only whitespace across lines.
  if (isJsxText && value.includes("\n")) return [];
  return ["space"];
}
