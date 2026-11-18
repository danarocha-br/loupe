import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeRepo } from "../compat/repo.fixture.js";
import { judgeTouchPoint } from "./ledger.js";
import { insertImport, parse, sha256 } from "./syntax.js";
import type { Applied, TouchPoint, TouchPointId } from "./touch-points.js";
import { touchPoints } from "./touch-points/list.js";

/** A repo with a root Biome config and nothing else, so every touch point is listed. */
const withBiome = () => makeRepo({ "biome.jsonc": "{}\n" }, {});

/** The touch points of an app at apps/app. */
function list(root: string): TouchPoint[] {
  return touchPoints({ root, app: "apps/app", version: "0.0.1", workspaceProtocol: "workspace:*" });
}

const points = list(withBiome());
const point = (id: TouchPointId) => {
  const found = points.find((t) => t.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

function applied(result: Applied): string {
  if ("unexpected" in result) throw new Error(result.unexpected);
  return result.text;
}

const orbixNextConfig = `import { withToolbar } from "@repo/feature-flags/lib/toolbar";
import { config, withAnalyzer } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = withToolbar(withLogging(config));

if (env.VERCEL) {
  nextConfig = withSentry(nextConfig);
}

export default nextConfig;
`;

describe("next.config.ts", () => {
  const tp = point("next-config");

  it("imports withLoupe in sorted position and wraps the default export, outermost", () => {
    const out = applied(tp.apply(orbixNextConfig));
    expect(out).toBe(
      orbixNextConfig
        .replace(
          'import { config, withAnalyzer } from "@repo/next-config";',
          'import { withLoupe } from "@repo/loupe/next";\nimport { config, withAnalyzer } from "@repo/next-config";',
        )
        .replace("export default nextConfig;", "export default withLoupe(nextConfig);"),
    );
    expect(tp.find(out)?.exact).toBe(true);
    expect(tp.find(orbixNextConfig)).toBeUndefined();
  });

  it("hashes formatting away and keeps semantic changes", () => {
    const out = applied(tp.apply(orbixNextConfig));
    const hash = (text: string) => sha256(tp.find(text)?.canonical ?? "");
    const reformatted = out
      .replace('import { withLoupe } from "@repo/loupe/next";', "import {withLoupe} from '@repo/loupe/next' // ours")
      .replace("withLoupe(nextConfig)", "withLoupe(\n  nextConfig,\n)");
    expect(hash(reformatted)).toBe(hash(out));
    // The argument is the app's config, not Loupe's: editing it is not a change to the wrapper.
    expect(hash(out.replace("withLoupe(nextConfig)", "withLoupe(withSentry(nextConfig))"))).toBe(hash(out));
    const inner = out.replace("export default withLoupe(nextConfig);", "export default withSentry(withLoupe(nextConfig));");
    expect(hash(inner)).not.toBe(hash(out));
    expect(tp.find(inner)?.exact).toBe(false);
  });

  it("refuses shapes it can't edit safely", () => {
    const fn = "export default (phase: string) => ({});\n";
    expect(tp.apply(fn)).toEqual({ unexpected: "apps/app/next.config.ts exports a function, not a config object." });
    expect("unexpected" in tp.apply("const a = {};\nexport { a as default };\n")).toBe(true);
    expect("unexpected" in tp.apply('import { withLoupe } from "x";\nexport default {};\n')).toBe(true);
    expect("unexpected" in tp.apply(undefined)).toBe(true);
  });

  it("reads a hand-applied wrapper as Loupe's but not as its own exact edit", () => {
    const manual = `import { withLoupe } from "@repo/loupe/next";\nexport default withLoupe((phase: string) => ({}));\n`;
    expect(tp.find(manual)).toMatchObject({ exact: true });
    const nested = `import { withLoupe } from "@repo/loupe/next";\nexport default other(withLoupe({}));\n`;
    expect(tp.find(nested)).toMatchObject({ exact: false });
  });
});

const orbixLayout = `import "./styles.css";
import { DesignSystemProvider } from "@repo/design-system";
import { Toolbar } from "@repo/feature-flags/components/toolbar";
import { Agentation } from "agentation";
import type { ReactNode } from "react";

interface RootLayoutProperties {
  readonly children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html lang="pt-BR" suppressHydrationWarning>
    <body suppressHydrationWarning>
      <DesignSystemProvider>{children}</DesignSystemProvider>
      <Toolbar />
      {/* Agentation. */}
      {process.env.NODE_ENV === "development" && (
        <Agentation endpoint="http://localhost:4747" />
      )}
    </body>
  </html>
);

export default RootLayout;
`;

const inlineLayout = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`;

describe("app/layout.tsx", () => {
  const tp = point("root-layout");

  it("adds a separate dev-gated mount as the last child of <body>, after Agentation", () => {
    const out = applied(tp.apply(orbixLayout));
    expect(out).toBe(
      orbixLayout
        .replace(
          'import { Agentation } from "agentation";',
          'import { LoupeMount } from "@repo/loupe/mount";\nimport { Agentation } from "agentation";',
        )
        .replace(
          "      )}\n    </body>",
          '      )}\n      {process.env.NODE_ENV === "development" && <LoupeMount />}\n    </body>',
        ),
    );
    expect(tp.find(out)?.exact).toBe(true);
  });

  it("gives an inline </body> a line of its own", () => {
    const out = applied(tp.apply(inlineLayout));
    expect(out).toContain(
      '<body className="antialiased">{children}\n        {process.env.NODE_ENV === "development" && <LoupeMount />}\n      </body>',
    );
    expect(out.startsWith('import { LoupeMount } from "@repo/loupe/mount";\n')).toBe(true);
    expect(tp.find(out)?.exact).toBe(true);
  });

  it("is no longer exact once something follows the mount", () => {
    const out = applied(tp.apply(orbixLayout)).replace("    </body>", "      <Late />\n    </body>");
    expect(tp.find(out)?.exact).toBe(false);
  });

  it("refuses a layout without exactly one <body>", () => {
    const two = "export default function L() { return <html><body /><body></body></html>; }\n";
    expect("unexpected" in tp.apply(two)).toBe(true);
    expect("unexpected" in tp.apply("export default function L() { return null; }\n")).toBe(true);
  });
});

const pkg = `{
  "name": "app",
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "26.1.2",
    "agentation": "^3.0.2"
  }
}
`;

describe("package.json", () => {
  const tp = point("package-json");

  it("adds both devDependencies in alphabetical order and touches nothing else", () => {
    const out = applied(tp.apply(pkg));
    expect(out).toBe(`{
  "name": "app",
  "devDependencies": {
    "@danarocha/loupe": "0.0.1",
    "@repo/loupe": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "26.1.2",
    "agentation": "^3.0.2"
  }
}
`);
    expect(tp.find(out)?.exact).toBe(true);
  });

  it("adds only what is missing, and creates devDependencies", () => {
    const half = pkg.replace('"@repo/typescript', '"@danarocha/loupe": "0.0.1",\n    "@repo/typescript');
    expect(applied(tp.apply(half))).toBe(applied(tp.apply(pkg)));
    const none = applied(tp.apply('{\n  "name": "app"\n}\n'));
    expect(JSON.parse(none).devDependencies).toEqual({ "@danarocha/loupe": "0.0.1", "@repo/loupe": "workspace:*" });
  });

  it("refuses a name already present with another value", () => {
    const other = pkg.replace('"agentation"', '"@danarocha/loupe": "^0.0.1",\n    "agentation"');
    expect(tp.apply(other)).toEqual({ unexpected: '@danarocha/loupe is already "^0.0.1".' });
  });
});

const biomeJsonc = `{
  "files": {
    "includes": [
      "**/*",
      // Agent worktrees.
      "!.claude/worktrees"
    ]
  }
}
`;

describe("biome.jsonc", () => {
  const biome = () => point("biome-config");

  it("is only listed when a Biome config exists", () => {
    expect(touchPoints({ root: "/nowhere", app: "a", version: "0", workspaceProtocol: "" }).map((t) => t.id)).toEqual([
      "package-json",
      "next-config",
      "root-layout",
    ]);
  });

  it("is the only one listed before the app is known, as it sits at the root", () => {
    expect(touchPoints({ root: withBiome(), version: "0", workspaceProtocol: "" }).map((t) => t.file)).toEqual(["biome.jsonc"]);
    expect(touchPoints({ root: "/nowhere", version: "0", workspaceProtocol: "" })).toEqual([]);
  });

  it("appends the exclusion with its comments intact", () => {
    const out = applied(biome().apply(biomeJsonc));
    expect(out).toBe(`{
  "files": {
    "includes": [
      "**/*",
      // Agent worktrees.
      "!.claude/worktrees",
      // Loupe's Product layer: generated by loupe init and loupe generate.
      "!packages/loupe"
    ]
  }
}
`);
    expect(biome().find(out)?.exact).toBe(true);
  });

  it("keeps a trailing comma, and refuses an includes that isn't a non-empty array", () => {
    const trailing = biomeJsonc.replace('"!.claude/worktrees"', '"!.claude/worktrees",');
    expect(applied(biome().apply(trailing))).toContain('"!.claude/worktrees",\n      // Loupe\'s Product layer: generated by loupe init and loupe generate.\n      "!packages/loupe",\n    ]');
    expect("unexpected" in biome().apply('{ "files": {} }')).toBe(true);
    expect("unexpected" in biome().apply('{ "files": { "includes": [] } }')).toBe(true);
  });
});

describe("insertImport", () => {
  const add = (text: string) => insertImport(text, parse("a.ts", text), 'import { b } from "b";', "b");

  it("goes after a directive when the file has no imports", () => {
    expect(add('"use client";\n\nexport const a = 1;\n')).toBe('"use client";\nimport { b } from "b";\n\nexport const a = 1;\n');
  });

  it("keeps an import's own comment attached to it, but not the file header", () => {
    expect(add('import { a } from "a";\n// biome-ignore lint: x\nimport { c } from "c";\n')).toBe(
      'import { a } from "a";\nimport { b } from "b";\n// biome-ignore lint: x\nimport { c } from "c";\n',
    );
    expect(add('// header\nimport { c } from "c";\n')).toBe('// header\nimport { b } from "b";\nimport { c } from "c";\n');
  });
});

// ── Apply, then revert ───────────────────────────────────────────────────────

/** Each touch point's file as a person may have it before `init`, in shapes `apply` accepts. */
const originals: Record<TouchPointId, Record<string, string>> = {
  "biome-config": {
    "a comment above the last entry": biomeJsonc,
    "a trailing comma": '{\n  "files": {\n    "includes": [\n      "**/*",\n      "!dist",\n    ],\n  },\n}\n',
    "one line": '{ "files": { "includes": ["**/*"] } }\n',
  },
  "next-config": {
    "a reassigned config": orbixNextConfig,
    "no imports": "export default {};\n",
    "a call and comments": 'import type { NextConfig } from "next";\nimport { withX } from "x";\n\n// config\nexport default withX({ /* a */ });\n',
  },
  "package-json": {
    "devDependencies around Loupe's": pkg,
    "no devDependencies": '{\n  "name": "web",\n  "dependencies": {\n    "next": "16.3.6"\n  }\n}\n',
    "tabs and later devDependencies": '{\n\t"name": "web",\n\t"devDependencies": {\n\t\t"@types/node": "22",\n\t\t"zod": "4"\n\t}\n}\n',
  },
  "root-layout": {
    "a multi-line <body>":
      'import type { ReactNode } from "react";\nimport { Agentation } from "agentation";\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        {process.env.NODE_ENV === "development" && (\n          <Agentation endpoint="http://localhost:4747" />\n        )}\n      </body>\n    </html>\n  );\n}\n',
    "an arrow function with a dev-gated block last": orbixLayout,
    "an inline </body>": inlineLayout,
    "an empty <body>": "export default function L() {\n  return (\n    <html>\n      <body></body>\n    </html>\n  );\n}\n",
    "a directive and no imports": '"use client";\nexport default function L({ children }) {\n  return <html><body>{children}</body></html>;\n}\n',
  },
};

describe("apply, then revert, gives back the original bytes", () => {
  const root = withBiome();
  /** What the ledger concludes about `text` in the touch point's file, with nothing recorded. */
  const judged = (tp: TouchPoint, text: string) => {
    mkdirSync(path.dirname(path.join(root, tp.file)), { recursive: true });
    writeFileSync(path.join(root, tp.file), text);
    return judgeTouchPoint(root, {}, undefined, tp);
  };

  // remove's touch points: built with the Loupe that runs remove, which may be newer than init's, and no
  // workspace protocol. A revert must not depend on what this Loupe would write.
  const removing = touchPoints({ root, app: "apps/app", version: "9.9.9", workspaceProtocol: "" });

  it("has originals for every touch point", () => {
    for (const tp of list(root)) expect(Object.keys(originals[tp.id]).length, tp.id).toBeGreaterThan(0);
  });

  for (const tp of list(root)) {
    for (const [shape, original] of Object.entries(originals[tp.id])) {
      it(`${tp.id}: ${shape}`, () => {
        expect(judged(tp, original).kind).toBe("not-loupes");
        const text = applied(tp.apply(original));
        // What init records as intact: Loupe's edit, exactly as apply writes it.
        expect(judged(tp, text)).toMatchObject({ kind: "unclaimed", claim: { found: { exact: true } } });
        const reverted = removing.find((t) => t.id === tp.id)?.revert(text);
        expect(reverted).toEqual({ text: original, summary: expect.any(String) });
        expect(judged(tp, original).kind).toBe("not-loupes");
      });
    }
  }
});
