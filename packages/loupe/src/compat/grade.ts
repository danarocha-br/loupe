import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  babelConfig,
  bundledReact,
  coversPackages,
  dependencyNames,
  devCommand,
  nextDir,
  type Pkg,
  readJson,
  routers,
  sourceFiles,
  usesReactCompiler,
  type Workspace,
} from "./repo.js";
import type { Item } from "./statement.js";

const NEEDS_PNPM =
  "Loupe needs a pnpm workspace: its Product layer is a workspace package, and a clean lockfile change has only been proven with pnpm.";

type ComponentsJson = { aliases?: { ui?: string } };

/** Workspace packages the app depends on that could be its design system. */
export function designSystemCandidates(app: Pkg, pkgs: Pkg[]): { shadcn: Pkg[]; cva: Pkg[] } {
  const deps = new Set(dependencyNames(app.json));
  const workspaceDeps = pkgs.filter((p) => p !== app && p.json.name && deps.has(p.json.name));
  return {
    shadcn: workspaceDeps.filter((p) => existsSync(join(p.abs, "components.json"))),
    cva: workspaceDeps.filter(
      (p) =>
        dependencyNames(p.json).includes("class-variance-authority") &&
        sourceFiles(p.abs, /\.tsx$/).length > 0,
    ),
  };
}

/** The directory shadcn's `ui` alias points at, inside the design-system package. */
function uiDir(ds: Pkg): string {
  const alias = readJson<ComponentsJson>(join(ds.abs, "components.json"))?.aliases?.ui;
  const name = ds.json.name ?? "";
  if (alias?.startsWith(`${name}/`)) return alias.slice(name.length + 1);
  if (alias?.startsWith("@/")) return alias.slice(2);
  return "components/ui";
}

function gradeDesignSystem(ds: Pkg | undefined, kind: "shadcn" | "cva", app: Pkg): Item {
  if (!ds) {
    return {
      key: "designSystem",
      grade: "unsupported",
      label: "No workspace design system",
      seen: "none",
      detail: `Loupe needs one design system kept as a workspace package with its .tsx source; ${app.dir} depends on none.`,
    };
  }
  const name = ds.json.name ?? ds.dir;
  if (kind === "cva") {
    return {
      key: "designSystem",
      grade: "untested",
      label: `Design system ${name} (cva, no components.json)`,
      seen: `${name} cva`,
      detail: "Without a shadcn components.json, Loupe can only guess where the components live.",
    };
  }
  const ui = uiDir(ds);
  if (sourceFiles(join(ds.abs, ui), /\.tsx$/).length === 0) {
    return {
      key: "designSystem",
      grade: "unsupported",
      label: `Design system ${name} has no .tsx source`,
      seen: `${name} no source`,
      detail: `Loupe reads the components' source; ${ds.dir}/${ui} has no .tsx file.`,
    };
  }
  const deps = dependencyNames(ds.json);
  if (deps.some((d) => d === "@base-ui/react" || d === "@base-ui-components/react")) {
    return { key: "designSystem", grade: "supported", label: `Design system ${name} (shadcn on Base UI)`, seen: name };
  }
  const radix = deps.some((d) => d === "radix-ui" || (d.startsWith("@radix-ui/react-") && d !== "@radix-ui/react-icons"));
  return {
    key: "designSystem",
    grade: "untested",
    label: `Design system ${name} (shadcn on ${radix ? "Radix" : "neither Base UI nor Radix"})`,
    seen: `${name} ${radix ? "radix" : "other"}`,
    detail: radix
      ? "Loupe has only been proven on Base UI; with Radix's `asChild`, some components may stay inspect-only."
      : "Loupe has only been proven on shadcn with Base UI.",
  };
}

function gradeNext(app: Pkg): { item: Item; react?: string } {
  const dir = nextDir(app.abs);
  const version = dir ? readJson<{ version?: string }>(join(dir, "package.json"))?.version : undefined;
  if (!dir || !version) {
    return {
      item: {
        key: "next",
        grade: "unsupported",
        label: `Next.js is not installed in ${app.dir}`,
        seen: "missing",
        detail: "Loupe reads the installed Next.js to grade it.",
        fix: "run `pnpm install`.",
        version: true,
      },
    };
  }
  const [major = 0, minor = 0] = version.split(".").map((n) => Number.parseInt(n, 10));
  const base = { key: "next" as const, label: `Next.js ${version}`, seen: version, version: true };
  const react = bundledReact(dir);
  if (major === 16 && minor === 3) return { item: { ...base, grade: "supported" }, react };
  if (major === 16) {
    return {
      item: {
        ...base,
        grade: "untested",
        detail: "Loupe has only been proven on Next.js 16.3. It will probably work; if components don't show up, move to 16.3.",
      },
      react,
    };
  }
  return {
    item: {
      ...base,
      grade: "unsupported",
      detail:
        major < 16
          ? "Loupe needs Next.js 16.3: before 16.0, Turbopack rules have no `development` condition."
          : "Loupe needs Next.js 16.3: later majors haven't been tested yet.",
      fix: major < 16 ? "upgrade to Next.js 16.3." : undefined,
    },
    react,
  };
}

function gradeRouter(app: Pkg): Item {
  const r = routers(app.abs);
  if (r.app && !r.pages) return { key: "router", grade: "supported", label: "App Router", seen: "app" };
  if (r.app) {
    return {
      key: "router",
      grade: "untested",
      label: "App Router and Pages Router",
      seen: "app+pages",
      detail: "Loupe only covers App Router pages; Pages Router routes haven't been tested.",
    };
  }
  return {
    key: "router",
    grade: "unsupported",
    label: "Pages Router only",
    seen: "pages",
    detail: "Loupe needs the App Router.",
  };
}

function gradeBundler(app: Pkg): Item {
  const dev = devCommand(app.json.scripts);
  if (dev?.webpack) {
    return {
      key: "bundler",
      grade: "unsupported",
      label: "Dev server uses webpack (`next dev --webpack`)",
      seen: "webpack",
      detail: "Loupe needs Turbopack in development: webpack ignores `turbopack.rules`, so no component would be connected.",
      fix: `remove \`--webpack\` from the ${dev.script} script in ${app.dir}/package.json.`,
    };
  }
  const babel = babelConfig(app.abs);
  const compiler = usesReactCompiler(app.abs);
  if (babel || compiler) {
    const parts = [babel ? `Babel config (${app.dir}/${babel})` : "", compiler ? "React Compiler" : ""];
    return {
      key: "bundler",
      grade: "untested",
      label: parts.filter(Boolean).join(" and "),
      seen: [babel, compiler ? "reactCompiler" : ""].filter(Boolean).join("+"),
      detail: "Loupe's dev loader hasn't been tested alongside it. It will probably work; if components don't show up, try without it.",
    };
  }
  if (!dev) {
    return {
      key: "bundler",
      grade: "untested",
      label: "No `next dev` in the dev script",
      seen: "no next dev",
      detail: `Loupe couldn't find \`next dev\` in ${app.dir}'s dev script, so it can't tell which bundler runs; it needs Turbopack.`,
    };
  }
  return { key: "bundler", grade: "supported", label: "Turbopack dev", seen: "turbopack" };
}

function gradeRuntime(app: Pkg, nodeVersion: string): Item {
  if (devCommand(app.json.scripts)?.runtime === "bun") {
    return { key: "runtime", grade: "supported", label: "Dev server runs on Bun", seen: "Bun", version: true };
  }
  const base = { key: "runtime" as const, label: `Dev server runs on Node ${nodeVersion}`, seen: `Node ${nodeVersion}`, version: true };
  if (nodeVersion.split(".")[0] === "22") return { ...base, grade: "supported" };
  return {
    ...base,
    grade: "untested",
    detail: "Loupe has only been proven with Node 22 and Bun. It will probably work; if components don't show up, run the dev server with Node 22.",
  };
}

function gradeWorkspace(workspace: Workspace): Item {
  if (workspace.kind === "pnpm") {
    if (coversPackages(workspace)) return { key: "workspace", grade: "supported", label: "pnpm workspace", seen: "pnpm" };
    return {
      key: "workspace",
      grade: "unsupported",
      label: "pnpm workspace without packages/*",
      seen: "pnpm",
      detail: "Loupe adds its Product layer as a workspace package under packages/.",
      fix: "add `packages/*` to pnpm-workspace.yaml.",
    };
  }
  return {
    key: "workspace",
    grade: "unsupported",
    label: workspace.kind === "none" ? "No workspace" : `${workspace.kind} workspace`,
    seen: workspace.kind,
    detail: NEEDS_PNPM,
  };
}

function gradeTypeScript(app: Pkg): Item {
  if (existsSync(join(app.abs, "tsconfig.json"))) {
    return { key: "typescript", grade: "supported", label: "TypeScript", seen: "tsconfig.json" };
  }
  return {
    key: "typescript",
    grade: "unsupported",
    label: `No tsconfig.json in ${app.dir}`,
    seen: "none",
    detail: "Loupe needs TypeScript: it reads prop types from the checker.",
  };
}

export type Grading = { items: Item[]; react?: string };

export type GradeInput = {
  app: Pkg;
  workspace: Workspace;
  designSystem?: { pkg: Pkg | undefined; kind: "shadcn" | "cva" };
  nodeVersion: string;
  mode: "full" | "versions";
};

/** Items in the order they print. `versions` grades only what `generate` rechecks. */
export function grade(input: GradeInput): Grading {
  const next = gradeNext(input.app);
  const runtime = gradeRuntime(input.app, input.nodeVersion);
  if (input.mode === "versions") return { items: [next.item, runtime], react: next.react };
  const ds = input.designSystem ?? { pkg: undefined, kind: "shadcn" as const };
  return {
    items: [
      next.item,
      gradeRouter(input.app),
      gradeBundler(input.app),
      gradeWorkspace(input.workspace),
      gradeDesignSystem(ds.pkg, ds.kind, input.app),
      gradeTypeScript(input.app),
      runtime,
    ],
    react: next.react,
  };
}
