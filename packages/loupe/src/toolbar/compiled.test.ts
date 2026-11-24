// React Compiler compiles the components the Toolbar's render counts depend on (ADR 0009).
// It skips a function it can't prove safe (a ref read while rendering, `||=`, a ref written
// before its declaration), silently: the build passes and the panel re-renders whole again.
// So each file is compiled here with the build's own options, and its components named.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REACT_COMPILER_OPTIONS } from "../../vite.config.js";

const require = createRequire(import.meta.url);
/** The one call this needs from Babel, which ships no types of its own. */
const babel = require("@babel/core") as { transformSync(code: string, options: Record<string, unknown>): unknown };
const here = path.dirname(fileURLToPath(import.meta.url));

type CompilerEvent = { kind: string; fnName?: string | null; detail?: { options?: { reason?: string } } };

/** The functions React Compiler compiled in a toolbar file, and why it skipped the rest. */
function compile(file: string): { compiled: string[]; skipped: string[] } {
  const events: CompilerEvent[] = [];
  babel.transformSync(readFileSync(path.join(here, file), "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [[require.resolve("babel-plugin-react-compiler"), { ...REACT_COMPILER_OPTIONS, logger: { logEvent: (_file: string, event: CompilerEvent) => events.push(event) } }]],
  });
  return {
    compiled: events.filter((event) => event.kind === "CompileSuccess").map((event) => event.fnName ?? ""),
    skipped: events.filter((event) => event.kind === "CompileError").map((event) => event.detail?.options?.reason ?? event.kind),
  };
}

describe("React Compiler", () => {
  it.each([
    // The shell: selection, marks and close state used to be threaded from here.
    ["index.tsx", ["ToolbarBody"]],
    // Its memoised <Panel> keeps a row's hover from re-rendering the panel.
    ["open.tsx", ["ToolbarOpen"]],
    // Its memoised parts keep a peek, Hide marks or a close from re-rendering the list,
    // and each row reads its own light.
    ["panel.tsx", ["Panel", "ComponentList", "LitGroupRow", "LitPageMap", "Inspector", "Gone", "Footer"]],
    ["highlight.tsx", ["Highlight"]],
    ["page-map.tsx", ["PageMapView"]],
  ])("compiles %s's components", (file, components) => {
    const { compiled, skipped } = compile(file);
    for (const name of components) expect(compiled, `${name} was skipped: ${skipped.join("; ")}`).toContain(name);
  });
});
