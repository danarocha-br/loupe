import path from "node:path";
import { stateSiblingName } from "../state-prop.js";
import type * as Docgen from "react-docgen-typescript";
import type * as tsm from "ts-morph";
import type * as TypeScript from "typescript";
import { componentFunction, destructureDefaults, hasUseClient, shapeOf } from "./ast.js";
import {
  combineDefaults,
  type Destructured,
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
import { compare, type SourceSet } from "./sources.js";
import type { ComponentExport, ModuleMeta, OptionValue, PropMeta } from "./types.js";
import { META_FORMAT_VERSION } from "./types.js";
import { configsForComponent } from "./variant-config.js";

/**
 * The fallback when ts-morph cannot build a program (PER-80): react-docgen-typescript
 * on the `typescript` dependency, which is the TypeScript 6 alias. Configs and
 * defaults still come from ts-morph's parser when it loads.
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
    for (const doc of [...fileDocs].sort((a, b) => compare(a.displayName, b.displayName))) {
      const decl = sf?.getExportedDeclarations().get(doc.displayName)?.[0];
      const fn = ns && decl ? componentFunction(ns, decl) : undefined;
      const configs = ns && fn ? configsForComponent(ns, fn) : [];
      for (const config of repoConfigFiles(configs)) readFiles.add(config);
      const entry: ComponentExport = {
        kind: "component",
        shape: ns && decl && sf ? shapeOf(ns, doc.displayName, decl, sf) : "unknown",
        props: props(doc, configs, ns && fn ? destructureDefaults(ns, fn) : undefined),
      };
      exports[doc.displayName] = entry;
    }
    return [
      {
        formatVersion: META_FORMAT_VERSION,
        engine: "react-docgen-typescript",
        source: sources.relative(file),
        client: ns && sf ? hasUseClient(ns, sf) : false,
        files: sources.hashes(readFiles),
        exports,
      },
    ];
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
  return { ...fallback, ...ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(tsconfig)).options };
}

function parseOnly(ns: typeof tsm, sources: SourceSet): tsm.Project | undefined {
  try {
    const project = new ns.Project({ compilerOptions: { jsx: ns.ts.JsxEmit.ReactJSX } });
    for (const file of sources.files) project.addSourceFileAtPath(file);
    return project;
  } catch {
    return undefined;
  }
}

function props(
  doc: Docgen.ComponentDoc,
  configs: ReturnType<typeof configsForComponent>,
  destructured: Record<string, Destructured> | undefined,
): Record<string, PropMeta> {
  const lookup = variantLookup(configs);
  const defaults = variantDefaults(configs);
  const result: Record<string, PropMeta> = {};

  for (const name of Object.keys(doc.props).sort(compare)) {
    const item = doc.props[name] as Docgen.PropItem;
    const files = (item.declarations ?? (item.parent ? [item.parent] : [])).map((d) => d.fileName);
    const from = originOf(files);
    if (!isListed(name, from)) continue;
    // docgen cannot tell a config-generated prop from a hand-typed one, so every repo prop counts.
    const prop = classify(name, from, item, lookup(name, from === "repo"));
    // docgen's own default mixes in JSDoc `@default`; it is used only when the parser did not load.
    const own = destructured ? destructured[name] : from === "repo" ? docgenDefault(item) : undefined;
    result[name] = finishProp(prop, combineDefaults(own, defaults[name], from), doc.props[stateSiblingName(name)] !== undefined);
  }
  return result;
}

function docgenDefault(item: Docgen.PropItem): Destructured | undefined {
  const value = item.defaultValue?.value as unknown;
  if (value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return { value };
  }
  return { value: null, expression: String(value) };
}

function literal(text: string): Destructured {
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
  config: ReturnType<ReturnType<typeof variantLookup>>,
): PropMeta {
  const inspect = (reason: Parameters<typeof inspectOnly>[0], detail?: string) => inspectOnly(reason, from, detail);
  if (isStructural(name)) return inspect("STRUCTURAL");

  const typeName = item.type.name;
  let closed: OptionValue[] | undefined;
  if (typeName === "boolean") closed = [false, true];
  else if (typeName === "enum" && Array.isArray(item.type.value)) {
    const values = (item.type.value as { value: string }[]).map((v) => literal(v.value));
    const kept = values.filter((v) => !(v.expression === undefined && v.value === null));
    if (kept.every((v) => v.expression === undefined)) closed = kept.map((v) => v.value as OptionValue);
  }
  if (closed && closed.length > 0) return judgeOptions(closed, config, from);

  const members = Array.isArray(item.type.value) ? (item.type.value as { value: string }[]).map((v) => v.value) : [];
  const text = [typeName, item.type.raw ?? "", ...members].join(" ");
  const union = members.length > 1 || /\|/.test(item.type.raw ?? typeName);
  if (/=>/.test(text) && !union) return inspect("FUNCTION");
  if (name === "children") {
    return /\b(ReactNode|string)\b/.test(text) ? { editable: true, kind: "text", from } : inspect("CONTENT");
  }
  if (/\b(ReactNode|ReactElement|JSX\.Element)\b/.test(text)) return inspect("CONTENT");
  if (/^(string|number)$/.test(typeName) || (union && members.some((m) => /^(string|number)$/.test(m)))) {
    return inspect("OPEN TEXT");
  }
  if (/^\{|\[\]$|Properties$/.test(typeName) || members.some((m) => /Properties$/.test(m))) return inspect("OBJECT");
  return inspect("UNVERIFIED", `docgen type "${typeName}"`);
}
