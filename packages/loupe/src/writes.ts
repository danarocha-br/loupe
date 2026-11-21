// What a call site writes (PER-96, PER-113). At runtime an authored prop and one a
// library injected look the same, and so do `Cancelar` and `{roleActionLabel}`:
// both are just strings. Only the source can tell them apart, so the loader reads
// it here and hands the record to the runtime on the element as `data-ds-writes`.
// `loupe locate` (ADR 0002) reads the same record from the file on disk, with the
// literal values the page never needs.

/** The JSX attribute carrying a call site's record, as a JSON string. */
export const WRITES_ATTRIBUTE = "data-ds-writes";

/**
 * How the call site writes a value. A literal (`variant="ghost"`, `{-1}`, a bare
 * `disabled`) is a one-line source edit; an expression comes from app logic.
 */
export type WrittenAs = "literal" | "expression";

/** A literal's value as JSON holds it: a bare attribute is `true`. */
export type LiteralValue = string | number | boolean | null;

export type AttributeWrite = {
  name: string;
  writtenAs: WrittenAs;
  /** The expression's source on one line, truncated. Absent for a literal. */
  expression?: string;
  /** A literal's value, read from source. Never sent to the page: `encodeCallSiteWrites` drops it. */
  value?: LiteralValue;
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
  /** The text React renders when `children` is `text`. Never sent to the page, like `value`. */
  text?: string;
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

  let content = partsOf((element.children as Node[] | undefined) ?? []);
  let children = classifyChildren(content);
  // React keeps a `children` attribute only when the element has no children of its own.
  if (childrenAttribute !== undefined) {
    if (children !== "none") written.delete("children");
    else {
      content = childrenAttribute === null ? [{ kind: "code", text: "" }] : partsOf([childrenAttribute]);
      children = classifyChildren(content);
    }
  }

  const writes: CallSiteWrites = { attributes: [...written.values()], spreads, children };
  if (children === "text") writes.text = content.map((part) => part.text).join("");
  return writes;
}

/** The value of `WRITES_ATTRIBUTE` for a record: what the page needs, without the literal values. */
export function encodeCallSiteWrites(writes: CallSiteWrites): string {
  const attributes = writes.attributes.map(({ name, writtenAs, expression }) =>
    expression === undefined ? { name, writtenAs } : { name, writtenAs, expression },
  );
  return JSON.stringify({ attributes, spreads: writes.spreads, children: writes.children });
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
  const written: AttributeWrite[] = [];
  for (const attribute of attributes as unknown[]) {
    if (typeof attribute !== "object" || attribute === null) return null;
    const { name, writtenAs, expression } = attribute as Record<string, unknown>;
    if (typeof name !== "string" || name === "") return null;
    if (writtenAs === "literal" && expression === undefined) written.push({ name, writtenAs });
    else if (writtenAs === "expression" && typeof expression === "string") {
      written.push({ name, writtenAs, expression });
    } else return null;
  }
  return { attributes: written, spreads, children: children as ChildrenKind };
}

function attributeName(name: Node): string {
  if (name.type === "JSXNamespacedName") {
    const namespace = name.namespace as { name: string };
    return `${namespace.name}:${(name.name as { name: string }).name}`;
  }
  return name.name as string;
}

function describeValue(name: string, value: Node | null, source: string): AttributeWrite {
  if (value === null) return { name, writtenAs: "literal", value: true };
  const expression = value.type === "JSXExpressionContainer" ? (value.expression as Node) : value;
  const inner = unwrap(expression);
  if (isLiteral(inner)) {
    const literal = literalValue(inner);
    return literal === undefined ? { name, writtenAs: "literal" } : { name, writtenAs: "literal", value: literal };
  }
  return { name, writtenAs: "expression", expression: shorten(source.slice(expression.start, expression.end)) };
}

/** What a literal evaluates to; undefined for a BigInt, which JSON can't hold. */
function literalValue(node: Node): LiteralValue | undefined {
  switch (node.type) {
    case "StringLiteral":
      return node.value as string;
    case "NumericLiteral":
      return node.value as number;
    case "BooleanLiteral":
      return node.value as boolean;
    case "NullLiteral":
      return null;
    case "TemplateLiteral":
      return cooked(node) ?? undefined;
    case "UnaryExpression": {
      const number = (node.argument as Node).value as number;
      return node.operator === "-" ? -number : number;
    }
    default:
      return undefined;
  }
}

/** A template literal's one string, as JavaScript reads it; null when it holds an invalid escape. */
function cooked(node: Node): string | null {
  return (node.quasis as { value: { cooked: string | null } }[])[0]?.value.cooked ?? null;
}

/** JSX's whitespace rule: lines trimmed where they meet, blank lines dropped, the rest joined by a space. */
function cleanJsxText(value: string): string {
  const lines = value.split(/\r\n|\n|\r/);
  let lastFilled = 0;
  lines.forEach((line, index) => {
    if (/[^ \t]/.test(line)) lastFilled = index;
  });
  let text = "";
  lines.forEach((line, index) => {
    let trimmed = line.replace(/\t/g, " ");
    if (index > 0) trimmed = trimmed.replace(/^[ ]+/, "");
    if (index < lines.length - 1) trimmed = trimmed.replace(/[ ]+$/, "");
    if (trimmed === "") return;
    text += index === lastFilled ? trimmed : `${trimmed} `;
  });
  return text;
}

// `"ghost" as const` and friends: still the literal, as far as a source edit goes.
const TYPE_WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ParenthesizedExpression",
]);

function unwrap(node: Node): Node {
  let inner = node;
  while (TYPE_WRAPPERS.has(inner.type)) inner = inner.expression as Node;
  return inner;
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
  // By code point, so an emoji is never cut in half.
  const line = [...text.replace(/\s+/g, " ").trim()];
  return line.length <= EXPRESSION_LENGTH
    ? line.join("")
    : `${line.slice(0, EXPRESSION_LENGTH - 1).join("")}…`;
}

type Piece = "text" | "space" | "code" | "elements";

/** One piece of children as React renders it: its kind, and for text and space, the text. */
type Part = { kind: Piece; text: string };

function classifyChildren(parts: readonly Part[]): ChildrenKind {
  const kinds = new Set(parts.map((part) => part.kind).filter((kind) => kind !== "space"));
  // A plain space beside other content is not a label (`<Icon /> <Icon />` is
  // elements, not mixed); a space alone is the whole text.
  if (kinds.size === 0) return parts.length > 0 ? "text" : "none";
  if (kinds.size > 1) return "mixed";
  const [kind] = kinds;
  return kind === "code" ? "from-code" : kind === "elements" ? "elements" : "text";
}

function partsOf(nodes: readonly Node[]): Part[] {
  return nodes.flatMap(part);
}

function part(node: Node): Part[] {
  switch (node.type) {
    case "JSXText":
      return textPart(node.value as string, true);
    case "StringLiteral":
      return textPart(node.value as string, false);
    case "TemplateLiteral":
      return (node.expressions as Node[]).length > 0 ? [{ kind: "code", text: "" }] : textPart(cooked(node) ?? "", false);
    case "JSXElement":
    case "JSXFragment":
      return [{ kind: "elements", text: "" }];
    case "JSXExpressionContainer": {
      const expression = node.expression as Node;
      return expression.type === "JSXEmptyExpression" ? [] : part(unwrap(expression));
    }
    default:
      return [{ kind: "code", text: "" }];
  }
}

// Only what React's JSX cleanup trims: a non-breaking space is text.
const BLANK = /^[ \t\r\n]*$/;

function textPart(value: string, isJsxText: boolean): Part[] {
  const text = isJsxText ? cleanJsxText(value) : value;
  if (!BLANK.test(value)) return [{ kind: "text", text }];
  // React drops JSXText that is only whitespace across lines.
  if (isJsxText && value.includes("\n")) return [];
  return [{ kind: "space", text }];
}
