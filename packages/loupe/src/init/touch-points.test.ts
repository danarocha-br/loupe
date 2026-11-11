import { describe, expect, it } from "vitest";
import { insertImport, parse, sha256 } from "./syntax.js";
import { biomeConfig, type Edit, type TouchPoint, touchPoints } from "./touch-points.js";

const point = (id: TouchPoint["id"]) => {
  const found = touchPoints({ root: "/nowhere", app: "apps/app", version: "0.0.1", workspaceProtocol: "workspace:*" })
    .find((t) => t.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

function applied(edit: Edit): string {
  if ("unexpected" in edit) throw new Error(edit.unexpected);
  return edit.text;
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
    const out = applied(tp.edit(orbixNextConfig));
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
    const out = applied(tp.edit(orbixNextConfig));
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
    expect(tp.edit(fn)).toEqual({ unexpected: "apps/app/next.config.ts exports a function, not a config object." });
    expect("unexpected" in tp.edit("const a = {};\nexport { a as default };\n")).toBe(true);
    expect("unexpected" in tp.edit('import { withLoupe } from "x";\nexport default {};\n')).toBe(true);
    expect("unexpected" in tp.edit(undefined)).toBe(true);
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

describe("app/layout.tsx", () => {
  const tp = point("root-layout");

  it("adds a separate dev-gated mount as the last child of <body>, after Agentation", () => {
    const out = applied(tp.edit(orbixLayout));
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
    const inline = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`;
    const out = applied(tp.edit(inline));
    expect(out).toContain(
      '<body className="antialiased">{children}\n        {process.env.NODE_ENV === "development" && <LoupeMount />}\n      </body>',
    );
    expect(out.startsWith('import { LoupeMount } from "@repo/loupe/mount";\n')).toBe(true);
    expect(tp.find(out)?.exact).toBe(true);
  });

  it("is no longer exact once something follows the mount", () => {
    const out = applied(tp.edit(orbixLayout)).replace("    </body>", "      <Late />\n    </body>");
    expect(tp.find(out)?.exact).toBe(false);
  });

  it("refuses a layout without exactly one <body>", () => {
    const two = "export default function L() { return <html><body /><body></body></html>; }\n";
    expect("unexpected" in tp.edit(two)).toBe(true);
    expect("unexpected" in tp.edit("export default function L() { return null; }\n")).toBe(true);
  });
});

describe("package.json", () => {
  const tp = point("package-json");
  const pkg = `{
  "name": "app",
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "26.1.2",
    "agentation": "^3.0.2"
  }
}
`;

  it("adds both devDependencies in alphabetical order and touches nothing else", () => {
    const out = applied(tp.edit(pkg));
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
    expect(applied(tp.edit(half))).toBe(applied(tp.edit(pkg)));
    const none = applied(tp.edit('{\n  "name": "app"\n}\n'));
    expect(JSON.parse(none).devDependencies).toEqual({ "@danarocha/loupe": "0.0.1", "@repo/loupe": "workspace:*" });
  });

  it("refuses a name already present with another value", () => {
    const other = pkg.replace('"agentation"', '"@danarocha/loupe": "^0.0.1",\n    "agentation"');
    expect(tp.edit(other)).toEqual({ unexpected: '@danarocha/loupe is already "^0.0.1".' });
  });
});

describe("biome.jsonc", () => {
  const config = `{
  "files": {
    "includes": [
      "**/*",
      // Agent worktrees.
      "!.claude/worktrees"
    ]
  }
}
`;
  const biome = () => biomeConfig("biome.jsonc");

  it("is only listed when a Biome config exists", () => {
    expect(touchPoints({ root: "/nowhere", app: "a", version: "0", workspaceProtocol: "" }).map((t) => t.id)).toEqual([
      "package-json",
      "next-config",
      "root-layout",
    ]);
  });

  it("appends the exclusion with its comments intact", () => {
    const out = applied(biome().edit(config));
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
    const trailing = config.replace('"!.claude/worktrees"', '"!.claude/worktrees",');
    expect(applied(biome().edit(trailing))).toContain('"!.claude/worktrees",\n      // Loupe\'s Product layer: generated by loupe init and loupe generate.\n      "!packages/loupe",\n    ]');
    expect("unexpected" in biome().edit('{ "files": {} }')).toBe(true);
    expect("unexpected" in biome().edit('{ "files": { "includes": [] } }')).toBe(true);
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
