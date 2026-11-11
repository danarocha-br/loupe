// The dev loader's work, as a pure function: no Next, no file system. The
// loader supplies resolution and the `'use client'` check through `ctx`.
//
// For every JSX element whose component is imported from a design-system or app
// root, it adds two dev-only attributes and leaves the call site's own text alone:
//   data-ds-anchor  the call-site id (call-site.ts), stable across edits
//   data-ds-source  the line:col n/total hint, which moves with every edit
// and, where `adapt-list.json` names an Adapter, rewrites the import specifier.

import path from "node:path";
import { parse } from "@babel/parser";
import MagicString from "magic-string";
import type { AdaptList } from "./adapt-list.js";
import {
  assignOrdinals,
  callSiteHint,
  callSiteId,
  DEFAULT_EXPORT_SCOPE,
  MODULE_SCOPE,
} from "./call-site.js";

export const ANCHOR_ATTRIBUTE = "data-ds-anchor";
export const SOURCE_ATTRIBUTE = "data-ds-source";

export type TransformContext = {
  /** Absolute repo root; every path in `adaptList` is relative to it. */
  root: string;
  adaptList: AdaptList;
  /** Absolute directory of the Product layer. Its files are never transformed. */
  layerDir: string;
  /** Absolute real path of the module `specifier` names from `fromFile`, or null. */
  resolve: (specifier: string, fromFile: string) => string | null;
  /** Whether the module at this absolute path starts with `'use client'`. */
  isClientModule: (file: string) => boolean;
};

export type CallSite = {
  id: string;
  hint: string;
  path: string;
  enclosing: string;
  component: string;
  ordinal: number;
  total: number;
  line: number;
  column: number;
  /** Repo-relative path of the module the component is imported from. */
  module: string;
  /** Whether this call site renders through an Adapter. */
  adapted: boolean;
};

export type TransformResult = {
  code: string;
  /** Source map as JSON, or null when nothing changed. */
  map: string | null;
  callSites: CallSite[];
};

// A loose view of Babel's AST: the fields this module reads.
type Node = {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number; column: number } };
  [key: string]: unknown;
};

type Binding = { component: string; module: string; adapted: boolean };
type Namespace = { module: string; adapted: readonly string[] };

const SKIPPED_KEYS = new Set([
  "loc",
  "start",
  "end",
  "extra",
  "range",
  "leadingComments",
  "trailingComments",
  "innerComments",
]);

const WRAPPERS = new Set(["memo", "forwardRef"]);

export function transform(source: string, file: string, ctx: TransformContext): TransformResult {
  const unchanged: TransformResult = { code: source, map: null, callSites: [] };
  const rel = toRepoPath(ctx.root, file);
  if (rel === null || isWithin(file, ctx.layerDir) || !source.includes("import")) {
    return unchanged;
  }

  let program: Node;
  try {
    program = parse(source, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    }).program as unknown as Node;
  } catch {
    // A file mid-edit; let the real compiler report it.
    return unchanged;
  }

  const { adaptList } = ctx;
  const directives = (program.directives as Node[] | undefined) ?? [];
  const isClientFile = directives.some(
    (directive) => (directive.value as { value: string }).value === "use client",
  );
  const inDesignSystem = isUnderAny(rel, adaptList.designSystem);
  const s = new MagicString(source);
  const bindings = new Map<string, Binding>();
  const namespaces = new Map<string, Namespace>();

  for (const statement of program.body as Node[]) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
    const sourceNode = statement.source as Node & { value: string };
    const target = ctx.resolve(sourceNode.value, file);
    if (target === null || isWithin(target, ctx.layerDir)) continue;
    const targetRel = toRepoPath(ctx.root, target);
    if (targetRel === null) continue;

    const entry = adaptList.modules[targetRel];
    const anchored =
      entry !== undefined ||
      isUnderAny(targetRel, adaptList.designSystem) ||
      isUnderAny(targetRel, adaptList.app);
    if (!anchored) continue;

    const specifiers = (statement.specifiers as Node[]).filter(
      (specifier) => specifier.importKind !== "type",
    );
    const importedNames = specifiers.flatMap((specifier) =>
      specifier.type === "ImportSpecifier" ? [importedName(specifier)] : [],
    );
    // Never move a call site across the server/client line, and never inside
    // the design system: swap only in a client file or for a client target.
    const swap =
      entry !== undefined &&
      !inDesignSystem &&
      !specifiers.some((specifier) => specifier.type === "ImportDefaultSpecifier") &&
      (importedNames.some((name) => entry.adapted.includes(name)) ||
        specifiers.some((specifier) => specifier.type === "ImportNamespaceSpecifier")) &&
      (isClientFile || ctx.isClientModule(target));

    if (swap) {
      s.overwrite(sourceNode.start, sourceNode.end, JSON.stringify(entry.adapter));
    }
    const adapted = swap ? entry.adapted : [];

    for (const specifier of specifiers) {
      const local = (specifier.local as { name: string }).name;
      if (specifier.type === "ImportSpecifier") {
        const component = importedName(specifier);
        bindings.set(local, {
          component,
          module: targetRel,
          adapted: adapted.includes(component),
        });
      } else if (specifier.type === "ImportDefaultSpecifier") {
        bindings.set(local, { component: local, module: targetRel, adapted: false });
      } else if (specifier.type === "ImportNamespaceSpecifier") {
        namespaces.set(local, { module: targetRel, adapted });
      }
    }
  }

  if (bindings.size === 0 && namespaces.size === 0) {
    return s.hasChanged() ? finish(s, file, []) : unchanged;
  }

  type Found = { element: Node; binding: Binding; enclosing: string };
  const found: Found[] = [];
  walk(program, [], (node, ancestors) => {
    if (node.type !== "JSXOpeningElement") return;
    const binding = bindingFor(node.name as Node, bindings, namespaces);
    if (!binding) return;
    found.push({ element: node, binding, enclosing: enclosingName(ancestors) });
  });
  found.sort((a, b) => a.element.start - b.element.start);

  const numbers = assignOrdinals(
    found.map(({ element, binding, enclosing }) => ({
      enclosing,
      component: binding.component,
      start: element.start,
    })),
  );

  const callSites: CallSite[] = [];
  found.forEach(({ element, binding, enclosing }, index) => {
    const { ordinal, total } = numbers[index] ?? { ordinal: 0, total: 0 };
    const key = { path: rel, enclosing, component: binding.component, ordinal };
    const line = element.loc.start.line;
    const column = element.loc.start.column + 1;
    const id = callSiteId(key);
    const hint = callSiteHint(key, { line, column, total });
    callSites.push({
      id,
      hint,
      path: rel,
      enclosing,
      component: binding.component,
      ordinal,
      total,
      line,
      column,
      module: binding.module,
      adapted: binding.adapted,
    });

    const attributes = element.attributes as Node[];
    const alreadyAnchored = attributes.some(
      (attribute) =>
        attribute.type === "JSXAttribute" &&
        (attribute.name as { name?: unknown }).name === ANCHOR_ATTRIBUTE,
    );
    if (alreadyAnchored) return;
    // After the last attribute, or after the tag name and its type arguments:
    // always a legal spot, whatever the element's formatting.
    const last = attributes.at(-1) ?? (element.typeParameters as Node | undefined) ?? (element.name as Node);
    s.appendLeft(
      last.end,
      ` ${ANCHOR_ATTRIBUTE}={${JSON.stringify(id)}} ${SOURCE_ATTRIBUTE}={${JSON.stringify(hint)}}`,
    );
  });

  return s.hasChanged() ? finish(s, file, callSites) : { ...unchanged, callSites };
}

/**
 * Whether a module's directive prologue holds `'use client'`. Reads only the
 * prologue, so a string elsewhere in the file never counts.
 */
export function hasUseClientDirective(source: string): boolean {
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (source.startsWith("#!", i)) i = source.indexOf("\n", i) + 1 || source.length;
  for (;;) {
    while (i < source.length) {
      if (/\s/.test(source[i] as string)) i++;
      else if (source.startsWith("//", i)) i = source.indexOf("\n", i) + 1 || source.length;
      else if (source.startsWith("/*", i)) {
        const close = source.indexOf("*/", i + 2);
        i = close === -1 ? source.length : close + 2;
      } else break;
    }
    const quote = source[i];
    if (quote !== '"' && quote !== "'") return false;
    const close = source.indexOf(quote, i + 1);
    if (close === -1) return false;
    if (source.slice(i + 1, close) === "use client") return true;
    i = close + 1;
    while (source[i] === " " || source[i] === "\t") i++;
    if (source[i] === ";") i++;
  }
}

function finish(s: MagicString, file: string, callSites: CallSite[]): TransformResult {
  return {
    code: s.toString(),
    map: s.generateMap({ hires: true, source: file, includeContent: true }).toString(),
    callSites,
  };
}

function importedName(specifier: Node): string {
  const imported = specifier.imported as { type: string; name?: string; value?: string };
  return (imported.type === "Identifier" ? imported.name : imported.value) as string;
}

function bindingFor(
  name: Node,
  bindings: Map<string, Binding>,
  namespaces: Map<string, Namespace>,
): Binding | undefined {
  if (name.type === "JSXIdentifier") return bindings.get(name.name as string);
  if (name.type !== "JSXMemberExpression") return undefined;
  const object = name.object as Node;
  if (object.type !== "JSXIdentifier") return undefined;
  const namespace = namespaces.get(object.name as string);
  if (!namespace) return undefined;
  const component = (name.property as { name: string }).name;
  return {
    component,
    module: namespace.module,
    adapted: namespace.adapted.includes(component),
  };
}

/**
 * The nearest named function or function-valued `const` around a node (PER-95):
 * `function X`, `const X = () =>`, `const X = memo(function Y…)` → Y. Anonymous
 * callbacks such as `.map(m => …)` belong to whatever encloses them.
 */
function enclosingName(ancestors: readonly Node[]): string {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i] as Node;
    const id = node.id as { type: string; name: string } | null | undefined;

    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      if (id) return id.name;
      continue;
    }
    if (
      node.type !== "FunctionDeclaration" &&
      node.type !== "FunctionExpression" &&
      node.type !== "ArrowFunctionExpression"
    ) {
      continue;
    }
    if (id) return id.name;

    // Climb through memo()/forwardRef() and type assertions to the binding.
    let child: Node = node;
    let j = i - 1;
    while (j >= 0 && isTransparentWrapper(ancestors[j] as Node, child)) {
      child = ancestors[j] as Node;
      j--;
    }
    const parent = ancestors[j];
    if (parent?.type === "VariableDeclarator" && parent.init === child) {
      const binding = parent.id as { type: string; name: string };
      if (binding.type === "Identifier") return binding.name;
    }
    if (parent?.type === "ExportDefaultDeclaration") return DEFAULT_EXPORT_SCOPE;
  }
  return MODULE_SCOPE;
}

function isTransparentWrapper(node: Node, child: Node): boolean {
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "ParenthesizedExpression"
  ) {
    return node.expression === child;
  }
  if (node.type !== "CallExpression" || !(node.arguments as Node[]).includes(child)) return false;
  const callee = node.callee as Node;
  const name =
    callee.type === "Identifier"
      ? callee.name
      : callee.type === "MemberExpression"
        ? (callee.property as { name?: string }).name
        : undefined;
  return typeof name === "string" && WRAPPERS.has(name);
}

function walk(
  node: Node,
  ancestors: Node[],
  visit: (node: Node, ancestors: readonly Node[]) => void,
): void {
  visit(node, ancestors);
  ancestors.push(node);
  for (const key of Object.keys(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) if (isNode(item)) walk(item, ancestors, visit);
    } else if (isNode(child)) {
      walk(child, ancestors, visit);
    }
  }
  ancestors.pop();
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function toRepoPath(root: string, file: string): string | null {
  const relative = path.relative(root, file);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join("/");
}

function isWithin(file: string, dir: string): boolean {
  const relative = path.relative(dir, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isUnderAny(rel: string, roots: readonly string[]): boolean {
  return roots.some((root) => rel === root || rel.startsWith(`${root}/`));
}
