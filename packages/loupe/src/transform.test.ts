import path from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import type { AdaptList } from "./adapt-list.js";
import { hasUseClientDirective, type TransformContext, transform } from "./transform.js";
import { parseCallSiteWrites, WRITES_ATTRIBUTE } from "./writes.js";

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
      '<Button variant="ghost" data-ds-anchor={"app/page.tsx › Page › Button[1]"} data-ds-source={"app/page.tsx:7:7 1/2"}' +
        ' data-ds-writes={"{\\"attributes\\":[{\\"name\\":\\"variant\\",\\"writtenAs\\":\\"literal\\"}],\\"spreads\\":false,\\"children\\":\\"text\\"}"}>',
    );
    expect(code).toContain(
      '<Badge data-ds-anchor={"app/page.tsx › Page › Badge[1]"} data-ds-source={"app/page.tsx:8:7 1/1"}' +
        ' data-ds-writes={"{\\"attributes\\":[],\\"spreads\\":false,\\"children\\":\\"none\\"}"} />',
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

describe("transform: what each call site writes", () => {
  // The first Button in a page whose only call site is `jsx`.
  const writesOf = (jsx: string) => {
    const source = `import { Button } from "@ds/button";\nimport { Icon } from "@ds/icon";\nexport function Page({ ok, label }: { ok: boolean; label: string }) {\n  return (\n    ${jsx}\n  );\n}\n`;
    const site = run(source).callSites.find((callSite) => callSite.component === "Button");
    if (!site) throw new Error("no Button call site");
    return site.writes;
  };
  const childrenOf = (jsx: string) => writesOf(jsx).children;

  it.each([
    ["JSXText", "<Button>Cancelar</Button>"],
    ["multi-line JSXText", "<Button>\n      Remover do espaço\n      agora\n    </Button>"],
    ["a string-literal expression", '<Button>{"Cancelar"}</Button>'],
    ["a template literal with no ${}", "<Button>{`Cancelar`}</Button>"],
    ["text with HTML entities", "<Button>Salvar &amp; sair&nbsp;agora</Button>"],
    ["text split by a literal space", '<Button>Remover{" "}membro</Button>'],
    ["a lone space", "<Button> </Button>"],
    ["a string-literal children attribute", '<Button children="Cancelar" />'],
    ["a string literal with a type assertion", '<Button>{"Cancelar" as const}</Button>'],
    ["text beside a comment", "<Button>{/* copy */}Cancelar</Button>"],
    ["a non-breaking space on its own line", "<Button>\n      &nbsp;\n    </Button>"],
    ["a children attribute with a comment-only body", '<Button children="Cancelar">{/* later */}</Button>'],
  ])("classifies %s as text", (_, jsx) => {
    expect(childrenOf(jsx)).toBe("text");
  });

  it.each([
    ["a variable", "<Button>{label}</Button>"],
    ["a catalogue string", "<Button>{copy.members.remove}</Button>"],
    ["a ternary of two literals", '<Button>{ok ? "Removendo…" : "Remover"}</Button>'],
    ["a logical conditional", '<Button>{ok && "Remover"}</Button>'],
    ["a template literal with ${}", "<Button>{`Remover ${label}`}</Button>"],
    ["a concatenation", '<Button>{"Remover " + label}</Button>'],
    ["a call", "<Button>{t(\"remove\")}</Button>"],
    ["a number", "<Button>{3}</Button>"],
    ["an expression children attribute", "<Button children={label} />"],
    ["a spread child", "<Button>{...parts}</Button>"],
  ])("classifies %s as from-code", (_, jsx) => {
    expect(childrenOf(jsx)).toBe("from-code");
  });

  it.each([
    ["text plus an expression", "<Button>Remover {label} do espaço?</Button>"],
    ["an element plus text", "<Button><Icon />Enviando…</Button>"],
    ["text plus an element on its own line", "<Button>\n      Enviando…\n      <Icon />\n    </Button>"],
    ["an element plus an expression", "<Button><Icon />{label}</Button>"],
    ["a conditional element plus text", "<Button>{ok && <Icon />}Enviando…</Button>"],
    ["a non-breaking space plus an element", "<Button>&nbsp;<Icon /></Button>"],
  ])("classifies %s as mixed", (_, jsx) => {
    expect(childrenOf(jsx)).toBe("mixed");
  });

  it.each([
    ["one element", "<Button><Icon /></Button>"],
    ["an element on its own line", "<Button>\n      <Icon />\n    </Button>"],
    ["two elements separated by a space", "<Button><Icon /> <Icon /></Button>"],
    ["a fragment", "<Button><><Icon /></></Button>"],
    ["an element children attribute", "<Button children={<Icon />} />"],
    // The text sits inside another element, so it is not the call site's own literal.
    ["a fragment holding text", "<Button><>Cancelar</></Button>"],
  ])("classifies %s as elements", (_, jsx) => {
    expect(childrenOf(jsx)).toBe("elements");
  });

  it.each([
    ["a self-closing element", "<Button />"],
    ["an empty element", "<Button></Button>"],
    ["only whitespace across lines", "<Button>\n    </Button>"],
    ["only a comment", "<Button>{/* later */}</Button>"],
  ])("classifies %s as none", (_, jsx) => {
    expect(childrenOf(jsx)).toBe("none");
  });

  it("lets JSX children win over a children attribute, as React does", () => {
    const writes = writesOf("<Button children={label} variant=\"ghost\">Cancelar</Button>");
    expect(writes.children).toBe("text");
    // React discards the attribute, so it is not a prop the call site passes.
    expect(writes.attributes.map((attribute) => attribute.name)).toEqual(["variant"]);
  });

  it("records the attribute names the call site writes, in source order", () => {
    const writes = writesOf(
      '<Button className="w-full" size="sm" type="button" variant={ok ? "ghost" : "outline"} disabled />',
    );
    expect(writes.attributes.map((attribute) => attribute.name)).toEqual([
      "className",
      "size",
      "type",
      "variant",
      "disabled",
    ]);
    expect(writes.spreads).toBe(false);
  });

  it("records whether each attribute is written as a literal or an expression", () => {
    const writes = writesOf(
      '<Button variant="ghost" size={"sm"} tabIndex={-1} aria-hidden={true} asChild title={`Sair`} open={open} render={<Icon />} onClick={() => setOpen(false)} />',
    );
    expect(writes.attributes).toEqual([
      { name: "variant", writtenAs: "literal" },
      { name: "size", writtenAs: "literal" },
      { name: "tabIndex", writtenAs: "literal" },
      { name: "aria-hidden", writtenAs: "literal" },
      { name: "asChild", writtenAs: "literal" },
      { name: "title", writtenAs: "literal" },
      { name: "open", writtenAs: "expression", expression: "open" },
      { name: "render", writtenAs: "expression", expression: "<Icon />" },
      { name: "onClick", writtenAs: "expression", expression: "() => setOpen(false)" },
    ]);
  });

  it("counts a literal behind a type assertion as a literal", () => {
    const writes = writesOf('<Button variant={"ghost" as const} size={-1 satisfies number} />');
    expect(writes.attributes).toEqual([
      { name: "variant", writtenAs: "literal" },
      { name: "size", writtenAs: "literal" },
    ]);
  });

  it("keeps an expression's text short and on one line", () => {
    const writes = writesOf(
      "<Button onClick={() => {\n        startTransition(async () => {\n          await removeMemberFromOrganization(member.id, organization.id);\n        });\n      }} />",
    );
    const expression = writes.attributes[0]?.expression ?? "";
    expect(expression).not.toContain("\n");
    expect(expression.length).toBeLessThanOrEqual(80);
    expect(expression.startsWith("() => { startTransition(async () => {")).toBe(true);
    expect(expression.endsWith("…")).toBe(true);
  });

  it("never cuts a character in half when truncating", () => {
    const writes = writesOf(`<Button onClick={() => "${"x".repeat(71)}😀😀😀tail"} />`);
    const expression = writes.attributes[0]?.expression ?? "";
    expect(expression.endsWith("😀…")).toBe(true);
    expect(expression).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no lone high surrogate
  });

  it("emits code that parses whatever the expression text holds", () => {
    const source = `import { Button } from "@ds/button";\nexport const X = () => <Button title={'a "q" \\\\ \u2028 </script>' + x} />;\n`;
    const { code, callSites } = run(source);
    expect(() => parse(code, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(callSites[0]?.writes.attributes[0]?.expression).toContain("</script>");
  });

  it("leaves out key and Loupe's own attributes, and keeps the last of a repeated name", () => {
    const writes = writesOf(
      '<Button key={member.id} data-ds-anchor="mine" variant="ghost" variant={variant} />',
    );
    expect(writes.attributes).toEqual([{ name: "variant", writtenAs: "expression", expression: "variant" }]);
  });

  it("flags a spreading call site", () => {
    const writes = writesOf('<Button {...props} variant="ghost" />');
    expect(writes.spreads).toBe(true);
    expect(writes.attributes.map((attribute) => attribute.name)).toEqual(["variant"]);
  });

  it("records namespaced attribute names whole", () => {
    expect(writesOf('<Button xlink:href="#a" />').attributes[0]?.name).toBe("xlink:href");
  });

  it("hands the record to the runtime on the element, readable by parseCallSiteWrites", () => {
    const source = 'import { Button } from "@ds/button";\nexport const X = ({ label }: { label: string }) => <Button variant="ghost" {...rest}>{label}</Button>;\n';
    const { code, callSites } = run(source);
    const element = (parse(code, { sourceType: "module", plugins: ["typescript", "jsx"] }).program
      .body[1] as unknown as {
      declaration: { declarations: { init: { body: { openingElement: { attributes: unknown[] } } } }[] };
    }).declaration.declarations[0]?.init.body.openingElement;
    const attribute = element?.attributes.find(
      (node) => (node as { name?: { name?: string } }).name?.name === WRITES_ATTRIBUTE,
    ) as { value: { expression: { value: string } } } | undefined;
    const value = attribute?.value.expression.value;
    expect(parseCallSiteWrites(value)).toEqual(callSites[0]?.writes);
    expect(callSites[0]?.writes).toEqual({
      attributes: [{ name: "variant", writtenAs: "literal" }],
      spreads: true,
      children: "from-code",
    });
  });

  it("does not record its own anchor attributes as written when transforming twice", () => {
    const once = run('import { Button } from "@ds/button";\nexport const X = () => <Button size="sm" />;\n');
    const twice = run(once.code);
    expect(twice.callSites[0]?.writes.attributes.map((attribute) => attribute.name)).toEqual(["size"]);
  });
});

describe("parseCallSiteWrites", () => {
  it.each([
    ["not a string", 3],
    ["not JSON", "{"],
    ["the wrong shape", JSON.stringify({ attributes: "variant", spreads: false, children: "text" })],
    ["an unknown children kind", JSON.stringify({ attributes: [], spreads: false, children: "words" })],
    ["an unknown writtenAs", JSON.stringify({ attributes: [{ name: "a", writtenAs: "maybe" }], spreads: false, children: "none" })],
    ["an empty name", JSON.stringify({ attributes: [{ name: "", writtenAs: "literal" }], spreads: false, children: "none" })],
    ["an expression with no text", JSON.stringify({ attributes: [{ name: "a", writtenAs: "expression" }], spreads: false, children: "none" })],
    ["a literal with expression text", JSON.stringify({ attributes: [{ name: "a", writtenAs: "literal", expression: "x" }], spreads: false, children: "none" })],
  ])("returns null for %s", (_, value) => {
    expect(parseCallSiteWrites(value)).toBeNull();
  });

  it("keeps only the fields a record has", () => {
    const value = JSON.stringify({ attributes: [{ name: "a", writtenAs: "literal", extra: 1 }], spreads: false, children: "none", extra: 1 });
    expect(parseCallSiteWrites(value)).toEqual({ attributes: [{ name: "a", writtenAs: "literal" }], spreads: false, children: "none" });
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
