import type * as tsm from "ts-morph";
import { stateSiblingName } from "../state-prop.js";
import { componentFunction, destructureDefaults, hasUseClient, shapeOf } from "./ast.js";
import {
  combineDefaults,
  finishProp,
  inspectOnly,
  isListed,
  isStructural,
  judgeOptions,
  originOf,
  repoConfigFiles,
  variantDefaults,
  variantLookup,
} from "./policy.js";
import type { SourceSet } from "./sources.js";
import type { ComponentExport, ModuleMeta, OptionValue, OtherExport, PropMeta } from "./types.js";
import { META_FORMAT_VERSION } from "./types.js";
import { configsForComponent, type VariantConfig } from "./variant-config.js";

type Ns = typeof tsm;

/** Builds a program from the product's tsconfig and reads every module in `sources`. */
export function extractWithTsMorph(ns: Ns, sources: SourceSet): ModuleMeta[] {
  const project = new ns.Project({
    // The tsconfig's own files stay in: ambient `.d.ts` files change types.
    tsConfigFilePath: sources.tsconfig,
    // The program resolves imports itself; ts-morph wrapping them is slow.
    skipFileDependencyResolution: true,
  });
  for (const file of sources.files) if (!project.getSourceFile(file)) project.addSourceFileAtPath(file);
  const reader = new ModuleReader(ns, project, sources);
  return sources.files.flatMap((file) => {
    const meta = reader.module(project.getSourceFileOrThrow(file));
    return meta ? [meta] : [];
  });
}

class ModuleReader {
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
      const decls = exported.get(name) ?? [];
      const isType = (d: tsm.Node) => Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d);
      // A name that is both a type and a value (`const X` plus `type X`) is a value:
      // an Adapter re-exports it with `export { X }`, which carries both meanings.
      const decl = decls.find((d) => !isType(d)) ?? decls[0];
      if (!decl) continue;
      if (isType(decl)) {
        exports[name] = { kind: "type" };
        continue;
      }
      const entry = this.exportEntry(name, decl, sf, readFiles);
      if (entry.kind === "component" && decls.some(isType)) entry.alsoType = true;
      exports[name] = entry;
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
    for (const file of repoConfigFiles(configs)) readFiles.add(file);

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
    const lookup = variantLookup(configs);
    const defaults = variantDefaults(configs);
    const props: Record<string, PropMeta> = {};

    for (const [name, { symbol, texts, count }] of [...byName].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const from = origin(symbol);
      if (!isListed(name, from)) continue;
      const linked = members.length > 1 && (count < members.length || texts.size > 1);
      // Props a cva/tv config generated are declared on the config object itself.
      const configDerived = symbol.getDeclarations().some((d) => this.ns.Node.isPropertyAssignment(d));
      const prop = linked
        ? inspectOnly("LINKED PROPS", from)
        : this.classify(name, from, symbol.getTypeAtLocation(decl), generic, lookup(name, configDerived));
      props[name] = finishProp(prop, combineDefaults(destructured[name], defaults[name], from), byName.has(stateSiblingName(name)));
    }
    return props;
  }

  private classify(
    name: string,
    from: string,
    type: tsm.Type,
    generic: boolean,
    variantKeys: ReturnType<ReturnType<typeof variantLookup>>,
  ): PropMeta {
    const inspect = (reason: Parameters<typeof inspectOnly>[0], detail?: string) => inspectOnly(reason, from, detail);

    if (isStructural(name)) return inspect("STRUCTURAL");
    const t = type.getNonNullableType();
    if (generic && involvesTypeParameter(t, 0)) return inspect("UNVERIFIED", "depends on a type parameter");
    if (t.isAny() || t.isUnknown()) return inspect("UNVERIFIED", t.isAny() ? "typed any" : "typed unknown");

    const closed = closedOptions(t);
    if (closed) return judgeOptions(closed, variantKeys, from);

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
  return originOf(symbol.getDeclarations().map((d) => d.getSourceFile().getFilePath()));
}
