import type * as tsm from "ts-morph";
import type { VariantKeys } from "./policy.js";
import type { OptionValue } from "./types.js";

const FACTORY_MODULES: Readonly<Record<string, "cva" | "tv">> = {
  "class-variance-authority": "cva",
  cva: "cva",
  "tailwind-variants": "tv",
};

export type VariantConfig = {
  factory: "cva" | "tv";
  /** Absolute path of the file holding the `cva(...)` / `tv(...)` call. */
  filePath: string;
  variants: Record<string, VariantKeys>;
  defaults: Record<string, OptionValue | null>;
  /** Set when the whole `variants` object could not be read statically. */
  dynamic?: string;
};

type Ns = typeof tsm;

/** `cva` or `tv`, judged by the module the callee is imported from. */
function factoryOf(ns: Ns, call: tsm.CallExpression): "cva" | "tv" | undefined {
  const callee = call.getExpression();
  if (!ns.Node.isIdentifier(callee)) return undefined;
  for (const decl of callee.getSymbol()?.getDeclarations() ?? []) {
    const imp = decl.getFirstAncestorByKind(ns.SyntaxKind.ImportDeclaration);
    const factory = imp && FACTORY_MODULES[imp.getModuleSpecifierValue()];
    if (factory) return factory;
  }
  return undefined;
}

function keyName(ns: Ns, prop: tsm.ObjectLiteralElementLike): string | undefined {
  if (!ns.Node.isPropertyAssignment(prop)) return undefined;
  const name = prop.getNameNode();
  if (ns.Node.isStringLiteral(name) || ns.Node.isNumericLiteral(name)) return String(name.getLiteralValue());
  if (ns.Node.isIdentifier(name)) return name.getText();
  return undefined;
}

function literalValue(ns: Ns, node: tsm.Node | undefined): OptionValue | null | undefined {
  if (!node) return undefined;
  if (ns.Node.isStringLiteral(node) || ns.Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue();
  if (ns.Node.isNumericLiteral(node)) return node.getLiteralValue();
  if (ns.Node.isTrueLiteral(node)) return true;
  if (ns.Node.isFalseLiteral(node)) return false;
  if (ns.Node.isNullLiteral(node)) return null;
  return undefined;
}

/** Reads a `cva(base, config)` / `tv(config)` call without executing it. */
function readVariantConfig(ns: Ns, call: tsm.CallExpression): VariantConfig | undefined {
  const factory = factoryOf(ns, call);
  if (!factory) return undefined;
  const filePath = call.getSourceFile().getFilePath();
  const arg = factory === "cva" ? call.getArguments()[1] : call.getArguments()[0];
  const result: VariantConfig = { factory, filePath, variants: {}, defaults: {} };

  if (arg === undefined) return result; // cva(base) alone has no variants.
  if (!ns.Node.isObjectLiteralExpression(arg)) {
    result.dynamic = "variant config is not an object literal";
    return result;
  }
  if (arg.getProperty("extend")) {
    result.dynamic = "tv() extends another config";
    return result;
  }

  const variants = arg.getProperty("variants");
  if (variants !== undefined) {
    const init = ns.Node.isPropertyAssignment(variants) ? variants.getInitializer() : undefined;
    if (!init || !ns.Node.isObjectLiteralExpression(init)) {
      result.dynamic = "variants is not an object literal";
    } else {
      for (const prop of init.getProperties()) {
        const name = keyName(ns, prop);
        if (name === undefined) {
          result.dynamic = "variants uses a spread or computed key";
          continue;
        }
        const values = ns.Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
        if (!values || !ns.Node.isObjectLiteralExpression(values)) {
          result.variants[name] = { dynamic: `variant "${name}" is not an object literal` };
          continue;
        }
        const keys: string[] = [];
        let dynamic: string | undefined;
        for (const option of values.getProperties()) {
          const key = keyName(ns, option);
          if (key === undefined) dynamic = `variant "${name}" uses a spread or computed key`;
          else keys.push(key);
        }
        result.variants[name] = dynamic ? { dynamic } : { keys };
      }
    }
  }

  const defaults = arg.getProperty("defaultVariants");
  const defaultsInit = defaults && ns.Node.isPropertyAssignment(defaults) ? defaults.getInitializer() : undefined;
  if (defaultsInit && ns.Node.isObjectLiteralExpression(defaultsInit)) {
    for (const prop of defaultsInit.getProperties()) {
      const name = keyName(ns, prop);
      const value = ns.Node.isPropertyAssignment(prop) ? literalValue(ns, prop.getInitializer()) : undefined;
      if (name !== undefined && value !== undefined) result.defaults[name] = value;
    }
  }
  return result;
}

/** The variant config a variable declaration holds, if it is `const x = cva(...)`. */
function configOfDeclaration(ns: Ns, decl: tsm.Node): VariantConfig | undefined {
  if (!ns.Node.isVariableDeclaration(decl)) return undefined;
  const init = decl.getInitializer();
  return init && ns.Node.isCallExpression(init) ? readVariantConfig(ns, init) : undefined;
}

/**
 * Configs that feed a component: `VariantProps<typeof x>` in its parameter
 * type, and `x(...)` calls in its body. Resolved through symbols, so a config
 * imported from another file is found too.
 */
export function configsForComponent(ns: Ns, fn: tsm.Node | undefined): VariantConfig[] {
  if (!fn) return [];
  const found = new Map<tsm.Node, VariantConfig>();
  const visit = (identifier: tsm.Node) => {
    const symbol = identifier.getSymbol();
    const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
    for (const decl of target?.getDeclarations() ?? []) {
      if (found.has(decl)) continue;
      const config = configOfDeclaration(ns, decl);
      if (config) found.set(decl, config);
    }
  };
  for (const query of fn.getDescendantsOfKind(ns.SyntaxKind.TypeQuery)) visit(query.getExprName());
  for (const call of fn.getDescendantsOfKind(ns.SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (ns.Node.isIdentifier(callee)) visit(callee);
  }
  return [...found.values()];
}
