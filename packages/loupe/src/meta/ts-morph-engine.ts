import type * as tsm from "ts-morph";
import { isPrimitiveLibrary, isStructural, judgeOptions, LISTED_DOM_PROPS, NEVER_LISTED, stateSiblingName, type VariantKeys } from "./policy.js";
import { packageOf, type SourceSet } from "./sources.js";
import type {
  ComponentExport,
  ComponentShape,
  DefaultValue,
  InspectOnlyProp,
  ModuleMeta,
  OptionValue,
  OtherExport,
  PropMeta,
} from "./types.js";
import { META_FORMAT_VERSION } from "./types.js";
import { configsForComponent, type VariantConfig } from "./variant-config.js";

type Ns = typeof tsm;

/** Builds a program from the product's tsconfig and reads every module in `sources`. */
export function extractWithTsMorph(ns: Ns, sources: SourceSet): ModuleMeta[] {
  const project = new ns.Project({
    // The tsconfig's own files stay in: ambient `.d.ts` files change types.
    tsConfigFilePath: sources.tsconfig,
    // The TypeScript program resolves imports itself; wrapping every
    // dependency in ts-morph nodes up front doubled the run time.
    skipFileDependencyResolution: true,
  });
  for (const file of sources.files) if (!project.getSourceFile(file)) project.addSourceFileAtPath(file);
  const engine = new Engine(ns, project, sources);
  return sources.files.flatMap((file) => {
    const meta = engine.module(project.getSourceFileOrThrow(file));
    return meta ? [meta] : [];
  });
}

class Engine {
  private readonly tsChecker: tsm.ts.TypeChecker;

  constructor(
    private readonly ns: Ns,
    project: tsm.Project,
    private readonly sources: SourceSet,
  ) {
    this.tsChecker = project.getTypeChecker().compilerObject;
  }

  module(sf: tsm.SourceFile): ModuleMeta | undefined {
    const { Node } = this.ns;
    const readFiles = new Set<string>([sf.getFilePath()]);
    const exports: ModuleMeta["exports"] = {};
    const exported = sf.getExportedDeclarations();

    for (const name of [...exported.keys()].sort()) {
      const decl = exported.get(name)?.[0];
      if (!decl) continue;
      if (Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl)) {
        exports[name] = { kind: "type" };
        continue;
      }
      exports[name] = this.exportEntry(name, decl, sf, readFiles);
    }

    if (!Object.values(exports).some((e) => e.kind === "component")) return undefined;
    return {
      formatVersion: META_FORMAT_VERSION,
      engine: "ts-morph",
      source: this.sources.relative(sf.getFilePath()),
      client: hasUseClient(this.ns, sf),
      files: this.sources.hashes(readFiles),
      exports,
    };
  }

  private exportEntry(
    name: string,
    decl: tsm.ExportedDeclarations,
    sf: tsm.SourceFile,
    readFiles: Set<string>,
  ): ComponentExport | OtherExport {
    const capitalised = name === "default" || /^[A-Z]/.test(name);
    // A class's own type is its instance; the constructor type holds the props.
    const type = this.ns.Node.isClassDeclaration(decl)
      ? (decl.getSymbol()?.getTypeAtLocation(decl) ?? decl.getType())
      : decl.getType();
    const signature = type.getCallSignatures()[0] ?? type.getConstructSignatures()[0];
    if (!capitalised || !signature) return { kind: "other" };

    const shape = shapeOf(this.ns, name, decl, sf);
    const fn = componentFunction(this.ns, decl);
    const configs = configsForComponent(this.ns, fn);
    for (const config of configs) if (!config.filePath.includes("/node_modules/")) readFiles.add(config.filePath);

    const generic = signature.getTypeParameters().length > 0;
    const entry: ComponentExport = { kind: "component", shape, props: this.props(signature, decl, fn, configs, generic) };
    if (generic) entry.generic = true;
    return entry;
  }

  private props(
    signature: tsm.Signature,
    decl: tsm.Node,
    fn: tsm.Node | undefined,
    configs: VariantConfig[],
    generic: boolean,
  ): Record<string, PropMeta> {
    const param = signature.getParameters()[0];
    if (!param) return {};
    const propsType = param.getTypeAtLocation(decl).getNonNullableType();

    // A union of props types is a discriminated union: props that differ
    // between members depend on each other (PER-84 `LINKED PROPS`).
    const members = propsType.isUnion() ? propsType.getUnionTypes() : [propsType];
    const byName = new Map<string, { symbol: tsm.Symbol; texts: Set<string>; count: number }>();
    for (const member of members) {
      for (const symbol of member.getProperties()) {
        const name = symbol.getName();
        const seen = byName.get(name) ?? { symbol, texts: new Set<string>(), count: 0 };
        seen.count += 1;
        if (members.length > 1) seen.texts.add(symbol.getTypeAtLocation(decl).getText());
        byName.set(name, seen);
      }
    }

    const destructured = destructureDefaults(this.ns, fn);
    const variantKeys = mergeVariantKeys(configs);
    const variantDefaults = Object.assign({}, ...configs.map((c) => c.defaults)) as Record<string, OptionValue | null>;
    const props: Record<string, PropMeta> = {};

    for (const name of [...byName.keys()].sort()) {
      const { symbol, texts, count } = byName.get(name) as { symbol: tsm.Symbol; texts: Set<string>; count: number };
      if (NEVER_LISTED.has(name)) continue;
      const from = origin(symbol);
      if (from !== "repo" && !isPrimitiveLibrary(from) && !LISTED_DOM_PROPS.has(name)) continue;

      const linked = members.length > 1 && (count < members.length || texts.size > 1);
      let prop: PropMeta = linked
        ? { editable: false, reason: "LINKED PROPS", from }
        : this.classify(name, from, symbol.getTypeAtLocation(decl), generic, variantKeys);

      const def = combineDefaults(destructured[name], variantDefaults[name], from);
      if (def) prop = { ...prop, default: def };
      if (byName.has(stateSiblingName(name))) prop = { ...prop, state: true };
      props[name] = prop;
    }
    return props;
  }

  private classify(
    name: string,
    from: string,
    type: tsm.Type,
    generic: boolean,
    variantKeys: VariantKeysLookup,
  ): PropMeta {
    const inspect = (reason: InspectOnlyProp["reason"], detail?: string): InspectOnlyProp =>
      detail ? { editable: false, reason, from, detail } : { editable: false, reason, from };

    if (isStructural(name, from)) return inspect("STRUCTURAL");
    const t = type.getNonNullableType();
    if (generic && involvesTypeParameter(t, 0)) return inspect("UNVERIFIED", "depends on a type parameter");
    if (t.isAny() || t.isUnknown()) return inspect("UNVERIFIED", t.isAny() ? "typed any" : "typed unknown");

    const closed = closedOptions(t);
    if (closed) {
      const judged = judgeOptions(closed, variantKeys(name, from));
      return "reason" in judged
        ? inspect(judged.reason, judged.detail)
        : { editable: true, kind: "options", from, ...judged };
    }

    if (name === "children") {
      return this.tsChecker.isTypeAssignableTo(this.tsChecker.getStringType(), t.compilerType)
        ? { editable: true, kind: "text", from }
        : inspect("CONTENT");
    }

    const parts = t.isUnion() ? t.getUnionTypes() : [t];
    if (isReactContent(type, parts)) return inspect("CONTENT");
    if (parts.every((p) => p.getCallSignatures().length > 0)) return inspect("FUNCTION");
    if (parts.some(isOpenPrimitive)) return inspect("OPEN TEXT");
    if (parts.every((p) => p.isObject())) return inspect("OBJECT");
    return inspect("UNVERIFIED", "type is neither closed nor a known open kind");
  }
}

type VariantKeysLookup = (name: string, from: string) => VariantKeys | undefined;

function mergeVariantKeys(configs: VariantConfig[]): VariantKeysLookup {
  const keys = new Map<string, VariantKeys>();
  for (const config of configs) {
    for (const [name, value] of Object.entries(config.variants)) if (!keys.has(name)) keys.set(name, value);
  }
  const wholeDynamic = configs.find((c) => c.dynamic)?.dynamic;
  return (name, from) => keys.get(name) ?? (wholeDynamic && from === "repo" ? { dynamic: wholeDynamic } : undefined);
}

function closedOptions(t: tsm.Type): OptionValue[] | undefined {
  if (t.isBoolean()) return [false, true];
  const parts = t.isUnion() ? t.getUnionTypes() : [t];
  const values: OptionValue[] = [];
  for (const part of parts) {
    if (part.isBooleanLiteral()) values.push(part.getText() === "true");
    else if (part.isStringLiteral() || part.isNumberLiteral() || part.isEnumLiteral()) {
      const value = part.getLiteralValue();
      if (typeof value !== "string" && typeof value !== "number") return undefined;
      values.push(value);
    } else return undefined;
  }
  return values.length > 0 ? values : undefined;
}

const REACT_CONTENT = new Set(["ReactNode", "ReactElement", "ReactPortal", "Element", "JSXElementConstructor"]);

function isReactContent(original: tsm.Type, parts: tsm.Type[]): boolean {
  const alias = original.getAliasSymbol()?.getName();
  if (alias && REACT_CONTENT.has(alias)) return true;
  return parts.some((p) => {
    const symbol = p.getSymbol() ?? p.getAliasSymbol();
    return symbol !== undefined && REACT_CONTENT.has(symbol.getName());
  });
}

function isOpenPrimitive(p: tsm.Type): boolean {
  if (p.isString() || p.isNumber() || p.isTemplateLiteral()) return true;
  // `string & {}`, the usual trick to keep autocomplete on an open union.
  return p.isIntersection() && p.getIntersectionTypes().some((i) => i.isString() || i.isNumber());
}

function involvesTypeParameter(t: tsm.Type, depth: number): boolean {
  if (t.isTypeParameter()) return true;
  if (depth > 3) return false;
  const nested = [
    ...(t.isUnion() ? t.getUnionTypes() : []),
    ...(t.isIntersection() ? t.getIntersectionTypes() : []),
    ...t.getTypeArguments(),
  ];
  return nested.some((n) => involvesTypeParameter(n, depth + 1));
}

function origin(symbol: tsm.Symbol): string {
  const files = symbol.getDeclarations().map((d) => d.getSourceFile().getFilePath());
  if (files.some((f) => packageOf(f) === undefined)) return "repo";
  const packages = files.map((f) => packageOf(f) as string);
  return packages.find(isPrimitiveLibrary) ?? packages[0] ?? "repo";
}

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

type Destructured = { value: OptionValue | null; expression?: string };

function destructureDefaults(ns: Ns, fn: tsm.Node | undefined): Record<string, Destructured> {
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

function combineDefaults(
  destructured: Destructured | undefined,
  fromVariants: OptionValue | null | undefined,
  from: string,
): DefaultValue | undefined {
  if (destructured && fromVariants !== undefined && destructured.expression === undefined && destructured.value !== fromVariants) {
    return { source: "conflict", value: destructured.value, defaultVariants: fromVariants };
  }
  if (destructured) {
    return destructured.expression === undefined
      ? { source: "destructure", value: destructured.value }
      : { source: "destructure", value: null, expression: destructured.expression };
  }
  if (fromVariants !== undefined) return { source: "defaultVariants", value: fromVariants };
  return isPrimitiveLibrary(from) ? { source: "unknown" } : undefined;
}
