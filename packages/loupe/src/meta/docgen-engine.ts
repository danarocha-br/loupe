import type * as Docgen from "react-docgen-typescript";
import type * as tsm from "ts-morph";
import type * as TypeScript from "typescript";
import { isPrimitiveLibrary, isStructural, judgeOptions, LISTED_DOM_PROPS, NEVER_LISTED, stateSiblingName } from "./policy.js";
import { packageOf, type SourceSet } from "./sources.js";
import { componentFunction, hasUseClient, shapeOf } from "./ts-morph-engine.js";
import type { ComponentExport, InspectOnlyProp, ModuleMeta, OptionValue, PropMeta } from "./types.js";
import { META_FORMAT_VERSION } from "./types.js";
import { configsForComponent, type VariantConfig } from "./variant-config.js";

/**
 * The fallback for when ts-morph cannot build a program (PER-80). It runs
 * react-docgen-typescript on TypeScript 6 (the `typescript` dependency is the
 * `@typescript/typescript6` alias). Variant configs are still read statically
 * through ts-morph's parser when it loads; otherwise every closed set is
 * `type-only`.
 */
export function extractWithDocgen(
  docgen: typeof Docgen,
  ts: typeof TypeScript,
  ns: typeof tsm | undefined,
  sources: SourceSet,
): ModuleMeta[] {
  const parser = docgen.withCompilerOptions(compilerOptions(ts, sources.tsconfig), {
    shouldExtractValuesFromUnion: true,
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    skipChildrenPropWithoutDoc: false,
    propFilter: () => true,
  });
  const docs = parser.parse(sources.files);
  const ast = ns ? parseOnly(ns, sources) : undefined;

  const byFile = new Map<string, Docgen.ComponentDoc[]>();
  for (const doc of docs) byFile.set(doc.filePath, [...(byFile.get(doc.filePath) ?? []), doc]);

  return sources.files.flatMap((file) => {
    const fileDocs = byFile.get(file) ?? [];
    if (fileDocs.length === 0) return [];
    const sf = ast?.getSourceFile(file);
    const readFiles = new Set<string>([file]);
    const exports: ModuleMeta["exports"] = {};
    for (const doc of [...fileDocs].sort((a, b) => (a.displayName < b.displayName ? -1 : 1))) {
      const decl = sf?.getExportedDeclarations().get(doc.displayName)?.[0];
      const configs = ns && decl ? configsForComponent(ns, componentFunction(ns, decl)) : [];
      for (const config of configs) if (!config.filePath.includes("/node_modules/")) readFiles.add(config.filePath);
      const entry: ComponentExport = {
        kind: "component",
        shape: ns && decl && sf ? shapeOf(ns, doc.displayName, decl, sf) : "unknown",
        props: props(doc, configs),
      };
      exports[doc.displayName] = entry;
    }
    const meta: ModuleMeta = {
      formatVersion: META_FORMAT_VERSION,
      engine: "react-docgen-typescript",
      source: sources.relative(file),
      client: ns && sf ? hasUseClient(ns, sf) : false,
      files: sources.hashes(readFiles),
      exports,
    };
    return [meta];
  });
}

function compilerOptions(ts: typeof TypeScript, tsconfig: string): TypeScript.CompilerOptions {
  const fallback: TypeScript.CompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    skipLibCheck: true,
  };
  const read = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (read.error) return fallback;
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, tsconfig.replace(/[\\/][^\\/]+$/, ""));
  return { ...fallback, ...parsed.options };
}

function parseOnly(ns: typeof tsm, sources: SourceSet): tsm.Project | undefined {
  try {
    const project = new ns.Project({ compilerOptions: { jsx: ns.ts.JsxEmit.ReactJSX, allowJs: false } });
    for (const file of sources.files) project.addSourceFileAtPath(file);
    return project;
  } catch {
    return undefined;
  }
}

function props(doc: Docgen.ComponentDoc, configs: VariantConfig[]): Record<string, PropMeta> {
  const variantKeys = new Map(configs.flatMap((c) => Object.entries(c.variants)));
  const variantDefaults = Object.assign({}, ...configs.map((c) => c.defaults)) as Record<string, OptionValue | null>;
  const result: Record<string, PropMeta> = {};

  for (const name of Object.keys(doc.props).sort()) {
    const item = doc.props[name] as Docgen.PropItem;
    if (NEVER_LISTED.has(name)) continue;
    const from = origin(item);
    if (from !== "repo" && !isPrimitiveLibrary(from) && !LISTED_DOM_PROPS.has(name)) continue;

    let prop = classify(name, from, item, variantKeys.get(name));
    // docgen merges destructuring defaults with JSDoc `@default`, so a
    // library prop's default stays unknown, as in the ts-morph engine.
    const destructured = from === "repo" ? (item.defaultValue?.value as unknown) : undefined;
    const fromVariants = variantDefaults[name];
    if (destructured !== undefined) {
      prop = { ...prop, default: { source: "destructure", ...defaultOf(destructured) } };
    } else if (fromVariants !== undefined) {
      prop = { ...prop, default: { source: "defaultVariants", value: fromVariants } };
    } else if (isPrimitiveLibrary(from)) {
      prop = { ...prop, default: { source: "unknown" } };
    }
    if (doc.props[stateSiblingName(name)]) prop = { ...prop, state: true };
    result[name] = prop;
  }
  return result;
}

function origin(item: Docgen.PropItem): string {
  const files = (item.declarations ?? (item.parent ? [item.parent] : [])).map((d) => d.fileName);
  if (files.length === 0 || files.some((f) => packageOf(f) === undefined)) return "repo";
  const packages = files.map((f) => packageOf(f) as string);
  return packages.find(isPrimitiveLibrary) ?? packages[0] ?? "repo";
}

function defaultOf(value: unknown): { value: OptionValue | null; expression?: string } {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return { value };
  }
  return { value: null, expression: String(value) };
}

function literal(text: string): { value: OptionValue | null; expression?: string } {
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      return { value };
    }
  } catch {
    // Not a JSON literal: keep the source text.
  }
  return { value: null, expression: text };
}

function classify(
  name: string,
  from: string,
  item: Docgen.PropItem,
  config: Parameters<typeof judgeOptions>[1],
): PropMeta {
  const inspect = (reason: InspectOnlyProp["reason"], detail?: string): InspectOnlyProp =>
    detail ? { editable: false, reason, from, detail } : { editable: false, reason, from };
  if (isStructural(name, from)) return inspect("STRUCTURAL");

  const typeName = item.type.name;
  let closed: OptionValue[] | undefined;
  if (typeName === "boolean") closed = [false, true];
  else if (typeName === "enum" && Array.isArray(item.type.value)) {
    const values = (item.type.value as { value: string }[]).map((v) => literal(v.value));
    const kept = values.filter((v) => !(v.expression === undefined && v.value === null));
    if (kept.every((v) => v.expression === undefined)) closed = kept.map((v) => v.value as OptionValue);
  }
  if (closed && closed.length > 0) {
    const judged = judgeOptions(closed, config);
    return "reason" in judged ? inspect(judged.reason, judged.detail) : { editable: true, kind: "options", from, ...judged };
  }

  const members = Array.isArray(item.type.value) ? (item.type.value as { value: string }[]).map((v) => v.value) : [];
  const text = [typeName, item.type.raw ?? "", ...members].join(" ");
  if (name === "children") {
    return /\b(ReactNode|string)\b/.test(text) ? { editable: true, kind: "text", from } : inspect("CONTENT");
  }
  const union = members.length > 1 || /\|/.test(item.type.raw ?? typeName);
  if (/=>/.test(text) && !union) return inspect("FUNCTION");
  if (/\b(ReactNode|ReactElement|JSX\.Element)\b/.test(text)) return inspect("CONTENT");
  if (/^(string|number)$/.test(typeName) || (union && members.some((m) => /^(string|number)$/.test(m)))) {
    return inspect("OPEN TEXT");
  }
  if (/^\{|\[\]$|Properties$/.test(typeName) || members.some((m) => /Properties$/.test(m))) return inspect("OBJECT");
  return inspect("UNVERIFIED", `docgen type "${typeName}"`);
}
