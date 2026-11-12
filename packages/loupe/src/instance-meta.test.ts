import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stampJson } from "./generate/header.js";
import { layerPathOf } from "./generate/plan.js";
import { createMetaLookup } from "./instance-meta.js";
import { stableJson } from "./meta/write.js";

// The fixture is a real repo: its Product layer is what `generate` wrote for it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const lookup = createMetaLookup({ root: ROOT, adaptList: path.join(ROOT, "fixture/app/loupe/adapt-list.json") });

describe("createMetaLookup", () => {
  it("finds a server-rendered call site's component through its import (PER-180)", () => {
    const [badge] = lookup([{ path: "fixture/app/app/page.tsx", component: "Badge" }]);
    expect(Object.keys(badge ?? {})).toContain("variant");
    expect(badge?.variant).toMatchObject({ editable: true, kind: "options" });
  });

  it("finds one drawn inside the design system, whose import is never swapped", () => {
    const [button] = lookup([{ path: "fixture/design-system/components/ui/alert-dialog.tsx", component: "Button" }]);
    expect(button?.children).toMatchObject({ editable: true, kind: "text" });
    expect(button?.className).toMatchObject({ editable: false, reason: "OPEN TEXT" });
  });

  it("finds a product component through the app's `@/` path", () => {
    const [menu] = lookup([{ path: "fixture/app/app/page.tsx", component: "MemberRowMenu" }]);
    expect(menu).not.toBeNull();
  });

  it("answers each request in order, null where nothing is known", () => {
    const results = lookup([
      { path: "fixture/app/app/page.tsx", component: "Nope" },
      { path: "fixture/app/app/page.tsx", component: "Button" },
      { path: "fixture/app/app/missing.tsx", component: "Button" },
      { path: "../outside.tsx", component: "Button" },
      { path: "/etc/passwd", component: "Button" },
    ]);
    expect(results.map((result) => result !== null)).toEqual([false, true, false, false, false]);
  });
});

describe("createMetaLookup on a repo of its own", () => {
  function repo(formatVersion = 1) {
    // The repo sits one level down, so a call site can be written just outside it.
    const root = path.join(realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-meta-"))), "repo");
    const write = (relative: string, text: string) => {
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      writeFileSync(path.join(root, relative), text);
    };
    write("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@ds/*": ["ds/*"] } } }));
    write("ds/components/ui/card.tsx", `export function Card(props: { tone?: "a" | "b" }) { return null; }\n`);
    write("ds/components/ui/fresh.tsx", `export function Fresh() { return null; }\n`);
    write(
      "apps/app/page.tsx",
      [
        `import { Card as Tile } from "@ds/components/ui/card";`,
        `import { Fresh } from "@ds/components/ui/fresh";`,
        "",
      ].join("\n"),
    );
    write("apps/app/ns.tsx", `import * as UI from "../../ds/components/ui/card";\n`);
    write("../outside.tsx", `import { Card } from "./repo/ds/components/ui/card";\n`);
    // A second module that also exports a Card, with its own metadata.
    write("ds/components/ui/other.tsx", `export function Card() { return null; }\n`);
    write("apps/app/default.tsx", `import Card from "./local-card";\nimport * as UI from "../../ds/components/ui/card";\n`);
    write("apps/app/two-ns.tsx", `import * as A from "../../ds/components/ui/card";\nimport * as B from "../../ds/components/ui/other";\n`);
    write("apps/app/both.tsx", `import { Card } from "../../ds/components/ui/other";\nimport * as UI from "../../ds/components/ui/card";\n`);
    const layer = "packages/loupe";
    write(
      `${layer}/meta/${layerPathOf("ds/components/ui/card.tsx", "ds", "apps/app")}.json`,
      stampJson(
        stableJson({
          client: false,
          engine: "ts-morph",
          exports: { Card: { kind: "component", props: { tone: { editable: true, from: "repo", kind: "options", options: ["a", "b"], status: "type-only" } }, shape: "function" } },
          files: {},
          formatVersion,
          source: "ds/components/ui/card.tsx",
        }),
      ),
    );
    write(
      `${layer}/meta/${layerPathOf("ds/components/ui/other.tsx", "ds", "apps/app")}.json`,
      stampJson(
        stableJson({
          client: false,
          engine: "ts-morph",
          exports: { Card: { kind: "component", props: {}, shape: "function" } },
          files: {},
          formatVersion,
          source: "ds/components/ui/other.tsx",
        }),
      ),
    );
    write(
      `${layer}/adapt-list.json`,
      stampJson(stableJson({ app: ["apps/app"], designSystem: ["ds"], formatVersion: 1, modules: {} })),
    );
    return createMetaLookup({ root, adaptList: path.join(root, layer, "adapt-list.json") });
  }

  it("names an aliased import by what it imports, and a namespace member by its property", () => {
    const [aliased, member] = repo()([
      { path: "apps/app/page.tsx", component: "Card" },
      { path: "apps/app/ns.tsx", component: "Card" },
    ]);
    expect(aliased?.tone).toMatchObject({ options: ["a", "b"] });
    expect(member).toEqual(aliased);
  });

  it("shows nothing when the anchor's name could have come through more than one module", () => {
    expect(
      repo()([
        // A default import is anchored under its local name, never the module's export.
        { path: "apps/app/default.tsx", component: "Card" },
        { path: "apps/app/two-ns.tsx", component: "Card" },
        { path: "apps/app/both.tsx", component: "Card" },
      ]),
    ).toEqual([null, null, null]);
  });

  it("reads no call site outside the repo", () => {
    expect(repo()([{ path: "../outside.tsx", component: "Card" }])).toEqual([null]);
  });

  it("keeps a component `generate` has not read yet at null", () => {
    expect(repo()([{ path: "apps/app/page.tsx", component: "Fresh" }])).toEqual([null]);
  });

  it("trusts no metadata in another format", () => {
    expect(repo(2)([{ path: "apps/app/page.tsx", component: "Card" }])).toEqual([null]);
  });
});
