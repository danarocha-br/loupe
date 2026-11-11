import path from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import type { AdaptList } from "./adapt-list.js";
import { hasUseClientDirective, type TransformContext, transform } from "./transform.js";

const root = "/repo";
const adaptList: AdaptList = {
  formatVersion: 1,
  designSystem: ["ds"],
  app: ["app"],
  modules: {
    "ds/components/ui/button.tsx": { adapter: "@layer/adapters/ds/ui/button", adapted: ["Button"] },
    "ds/components/ui/dialog.tsx": { adapter: "@layer/adapters/ds/ui/dialog", adapted: ["Dialog"] },
    "app/components/row-menu.tsx": { adapter: "@layer/adapters/app/row-menu", adapted: ["RowMenu"] },
  },
};
// dialog.tsx and row-menu.tsx are client modules; button.tsx is not.
const clientModules = new Set(["/repo/ds/components/ui/dialog.tsx", "/repo/app/components/row-menu.tsx"]);

const ctx: TransformContext = {
  root,
  adaptList,
  layerDir: "/repo/layer",
  resolve: (specifier, fromFile) => {
    if (specifier.startsWith("@ds/")) return `/repo/ds/components/ui/${specifier.slice(4)}.tsx`;
    if (specifier.startsWith("@/")) return `/repo/app/${specifier.slice(2)}.tsx`;
    if (specifier.startsWith(".")) return `${path.resolve(path.dirname(fromFile), specifier)}.tsx`;
    if (specifier === "@layer/adapters/ds/ui/button") return "/repo/layer/adapters/ds/ui/button.tsx";
    return null; // react, third-party packages
  },
  isClientModule: (file) => clientModules.has(file),
};

const PAGE = "/repo/app/page.tsx";
const run = (source: string, file = PAGE) => transform(source, file, ctx);
const ids = (source: string, file = PAGE) => run(source, file).callSites.map((site) => site.id);

const page = `import { Button } from "@ds/button";
import { Badge } from "@ds/badge";

export function Page() {
  return (
    <main>
      <Button variant="ghost">One</Button>
      <Badge />
      <Button>Two</Button>
    </main>
  );
}
`;

describe("transform: call-site ids", () => {
  it("anchors design-system call sites with an id and a hint", () => {
    const { callSites, code } = run(page);
    expect(callSites.map(({ id, hint }) => ({ id, hint }))).toEqual([
      { id: "app/page.tsx › Page › Button[1]", hint: "app/page.tsx:7:7 1/2" },
      { id: "app/page.tsx › Page › Badge[1]", hint: "app/page.tsx:8:7 1/1" },
      { id: "app/page.tsx › Page › Button[2]", hint: "app/page.tsx:9:7 2/2" },
    ]);
    expect(code).toContain(
      '<Button variant="ghost" data-ds-anchor={"app/page.tsx › Page › Button[1]"} data-ds-source={"app/page.tsx:7:7 1/2"}>',
    );
    expect(code).toContain(
      '<Badge data-ds-anchor={"app/page.tsx › Page › Badge[1]"} data-ds-source={"app/page.tsx:8:7 1/1"} />',
    );
  });

  it("keeps the id when a line is inserted above the call site", () => {
    const shifted = page.replace("export function Page() {", "// a comment\n\nexport function Page() {");
    expect(ids(shifted)).toEqual(ids(page));
    expect(run(shifted).callSites[0]?.hint).toBe("app/page.tsx:9:7 1/2");
  });

  it("keeps the id when the call site's props are edited", () => {
    const edited = page.replace('<Button variant="ghost">', '<Button\n        variant="outline"\n        size="sm"\n      >');
    expect(ids(edited)).toEqual(ids(page));
  });

  it("keeps the id when the call site is wrapped in a new element", () => {
    const wrapped = page.replace("<Badge />", "<span><Badge /></span>");
    expect(ids(wrapped)).toEqual(ids(page));
  });

  it("changes the total when a same-component call is added before it in the same function", () => {
    const before = run(page).callSites.find((site) => site.id.endsWith("Button[2]"));
    const added = page.replace("<main>", "<main>\n      <Button>Zero</Button>");
    const after = run(added).callSites.filter((site) => site.component === "Button");
    expect(before?.total).toBe(2);
    expect(after.map((site) => `${site.ordinal}/${site.total}`)).toEqual(["1/3", "2/3", "3/3"]);
    expect(after[2]?.hint.endsWith(" 3/3")).toBe(true);
  });

  it("does not change the total for a same-component call in another function", () => {
    const other = `${page}\nfunction Footer() {\n  return <Button>Elsewhere</Button>;\n}\n`;
    const sites = run(other).callSites.filter((site) => site.component === "Button");
    expect(sites.map((site) => `${site.enclosing} ${site.ordinal}/${site.total}`)).toEqual([
      "Page 1/2",
      "Page 2/2",
      "Footer 1/1",
    ]);
  });

  it("counts by the imported name, not the local alias", () => {
    expect(ids('import { Button as B } from "@ds/button";\nexport const X = () => <B />;\n')).toEqual([
      "app/page.tsx › X › Button[1]",
    ]);
  });

  it("names the enclosing component through memo, forwardRef, callbacks and plain bindings", () => {
    const source = `import { memo, forwardRef } from "react";
import { Button } from "@ds/button";

export const Memoised = memo(function RowMenu() {
  return <Button />;
});
export const Arrow = memo(() => <Button />);
export const WithRef = forwardRef<HTMLDivElement>((props, ref) => <Button />);
export function List({ items }: { items: string[] }) {
  const header = <Button />;
  const renderItem = (item: string) => <Button key={item} />;
  return <>{header}{items.map((item) => <Button key={item} />)}{items.map(renderItem)}</>;
}
class Legacy {
  render() {
    return <Button />;
  }
}
export default function () {
  return <Button />;
}
const loose = <Button />;
`;
    expect(ids(source)).toEqual([
      "app/page.tsx › RowMenu › Button[1]",
      "app/page.tsx › Arrow › Button[1]",
      "app/page.tsx › WithRef › Button[1]",
      "app/page.tsx › List › Button[1]",
      "app/page.tsx › renderItem › Button[1]",
      "app/page.tsx › List › Button[2]",
      "app/page.tsx › Legacy › Button[1]",
      "app/page.tsx › <default> › Button[1]",
      "app/page.tsx › <module> › Button[1]",
    ]);
  });

  it("names components wrapped in any other HOC by their binding, not <module>", () => {
    const source = `import { observer } from "mobx-react";
import { Button } from "@ds/button";
export const Toolbar = observer(() => <Button />);
export const Panel = withTheme({ dark: true })(() => <Button />);
export default observer(() => <Button />);
export function List({ items }: { items: string[] }) {
  const rows = items.map((item) => <Button key={item} />);
  return <>{rows}</>;
}
`;
    expect(ids(source)).toEqual([
      "app/page.tsx › Toolbar › Button[1]",
      "app/page.tsx › Panel › Button[1]",
      "app/page.tsx › <default> › Button[1]",
      "app/page.tsx › List › Button[1]",
    ]);
  });

  it("counts both branches of a ternary and a render-prop element as call sites", () => {
    const source = `import { Button } from "@ds/button";
import { Trigger } from "@ds/menu";
export function Menu({ ok }: { ok: boolean }) {
  return (
    <>
      <Trigger render={<Button variant="ghost" />}>⋯</Trigger>
      {ok ? <Button>Yes</Button> : <Button>No</Button>}
    </>
  );
}
`;
    expect(ids(source)).toEqual([
      "app/page.tsx › Menu › Trigger[1]",
      "app/page.tsx › Menu › Button[1]",
      "app/page.tsx › Menu › Button[2]",
      "app/page.tsx › Menu › Button[3]",
    ]);
  });

  it("anchors namespace members", () => {
    expect(ids('import * as UI from "@ds/button";\nexport const X = () => <UI.Button />;\n')).toEqual([
      "app/page.tsx › X › Button[1]",
    ]);
  });

  it("anchors app components imported through @/ and relative paths", () => {
    const source = `import { RowMenu } from "@/components/row-menu";
import { Cell } from "./components/cell";
export const Row = () => <div><RowMenu /><Cell /></div>;
`;
    const { callSites } = run(source);
    expect(callSites.map((site) => [site.id, site.module])).toEqual([
      ["app/page.tsx › Row › RowMenu[1]", "app/components/row-menu.tsx"],
      ["app/page.tsx › Row › Cell[1]", "app/components/cell.tsx"],
    ]);
  });

  it("anchors design-system call sites inside the design system", () => {
    const source = `"use client";
import { Button } from "./button";
export function DialogAction() {
  return <Button variant="outline" />;
}
`;
    const { callSites, code } = run(source, "/repo/ds/components/ui/dialog.tsx");
    expect(callSites.map((site) => site.id)).toEqual([
      "ds/components/ui/dialog.tsx › DialogAction › Button[1]",
    ]);
    expect(code).toContain('import { Button } from "./button";');
    expect(callSites[0]?.adapted).toBe(false);
  });

  it("leaves third-party, intrinsic and type-only imports alone", () => {
    const source = `import { Icon } from "lucide-react";
import type { ButtonProps } from "@ds/button";
export const X = (props: ButtonProps) => <div><Icon /></div>;
`;
    const result = run(source);
    expect(result.callSites).toEqual([]);
    expect(result.code).toBe(source);
    expect(result.map).toBeNull();
  });

  it("keeps an explicit anchor written by hand", () => {
    const source = 'import { Button } from "@ds/button";\nexport const X = () => <Button data-ds-anchor="mine" />;\n';
    const { code, callSites } = run(source);
    expect(code).toBe(source);
    expect(callSites).toHaveLength(1);
  });

  it("never transforms the Product layer's own files", () => {
    const source = '"use client";\nimport { Button as Original } from "@ds/button";\nexport const Button = () => <Original />;\n';
    expect(run(source, "/repo/layer/adapters/ds/ui/button.tsx")).toEqual({
      code: source,
      map: null,
      callSites: [],
    });
  });

  it("emits code that still parses, with a source map", () => {
    const source = `import { Button } from "@ds/button";
export const X = () => (
  <Button<string>
    {...{ size: "sm" }}
    onClick={() => {}}
  />
);
`;
    const { code, map } = run(source);
    expect(() => parse(code, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(JSON.parse(map as string)).toMatchObject({ version: 3, sources: [PAGE] });
  });
});

describe("transform: Adapter swap", () => {
  const importOf = (code: string, name: string) =>
    code.split("\n").find((line) => line.startsWith(`import { ${name}`));

  it("swaps in a client file", () => {
    const source = '"use client";\nimport { Button, buttonVariants } from "@ds/button";\nexport const X = () => <Button />;\n';
    const { code, callSites } = run(source);
    expect(importOf(code, "Button")).toBe(
      'import { Button, buttonVariants } from "@layer/adapters/ds/ui/button";',
    );
    expect(callSites[0]?.adapted).toBe(true);
  });

  it("does not swap a server file importing a server module", () => {
    const source = 'import { Button } from "@ds/button";\nexport const X = () => <Button />;\n';
    const { code, callSites } = run(source);
    expect(importOf(code, "Button")).toBe('import { Button } from "@ds/button";');
    expect(callSites[0]?.adapted).toBe(false);
  });

  it("swaps in a server file when the target module is already client", () => {
    const source = `import { Dialog } from "@ds/dialog";
import { RowMenu } from "@/components/row-menu";
export const X = () => <Dialog><RowMenu /></Dialog>;
`;
    const { code, callSites } = run(source);
    expect(importOf(code, "Dialog")).toBe('import { Dialog } from "@layer/adapters/ds/ui/dialog";');
    expect(importOf(code, "RowMenu")).toBe('import { RowMenu } from "@layer/adapters/app/row-menu";');
    expect(callSites.every((site) => site.adapted)).toBe(true);
  });

  it("does not swap when no adapted name is imported", () => {
    const source = '"use client";\nimport { buttonVariants } from "@ds/button";\nexport const c = buttonVariants();\n';
    expect(run(source).code).toBe(source);
  });

  it("does not swap a default import, which an Adapter does not provide", () => {
    const source = '"use client";\nimport Thing, { Button } from "@ds/button";\nexport const X = () => <Button />;\n';
    expect(importOf(run(source).code, "Button")).toBeUndefined();
    expect(run(source).code).toContain('from "@ds/button"');
  });

  it("swaps a namespace import in a client file", () => {
    const source = '"use client";\nimport * as UI from "@ds/button";\nexport const X = () => <UI.Button />;\n';
    const { code, callSites } = run(source);
    expect(code).toContain('import * as UI from "@layer/adapters/ds/ui/button";');
    expect(callSites[0]?.adapted).toBe(true);
  });

  it("never swaps inside the design system", () => {
    const source = '"use client";\nimport { Button } from "./button";\nexport const X = () => <Button />;\n';
    const { code } = run(source, "/repo/ds/components/ui/dialog.tsx");
    expect(code).toContain('from "./button"');
  });
});

describe("hasUseClientDirective", () => {
  it.each([
    ['"use client";\nexport {}', true],
    ["'use client'\nexport {}", true],
    ['// header\n/* block */\n"use client";', true],
    ['"use strict";\n"use client";', true],
    ['﻿"use client"', true],
    ['import "x";\n"use client";', false],
    ['const s = "use client";', false],
    ["export {}", false],
  ])("%j → %s", (source, expected) => {
    expect(hasUseClientDirective(source)).toBe(expected);
  });
});
