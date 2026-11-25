// @vitest-environment jsdom
// The workbench (ADR 0012) covers every pattern: each folder in `src/` with a `.md` has an
// entry, its `.md` is that file, and its states draw in a real surface, light and dark, under
// the workbench's stylesheet, with nothing axe objects to. As `@loupe/ui`'s `primitives.test.tsx`.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { axeViolations, cleanup, renderInSurface } from "@loupe/ui/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PATTERNS_CSS } from "../src/styles.js";
import { STYLESHEET } from "../src/stylesheet.js";
import FRAME_CSS from "./frame.css?inline";
import { PATTERNS } from "./patterns.js";
import { WORKBENCH_STYLESHEET } from "./stylesheet.js";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Every pattern's folder: one with a `.md` of its states, ARIA and keys. */
const FOLDERS = readdirSync(src, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && readdirSync(path.join(src, entry.name)).includes(`${entry.name}.md`))
  .map((entry) => entry.name)
  .sort();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the workbench", () => {
  it("has an entry for every pattern, by its folder", () => {
    expect(FOLDERS.length).toBeGreaterThan(20);
    expect(PATTERNS.map((pattern) => pattern.id).sort()).toEqual(FOLDERS);
  });

  it("shows each pattern's own .md", () => {
    for (const pattern of PATTERNS) expect(pattern.doc, pattern.id).toBe(readFileSync(path.join(src, pattern.id, `${pattern.id}.md`), "utf8"));
  });

  it("draws in the Toolbar's stylesheet, its frame layout after the patterns' CSS, in their layer", () => {
    expect(WORKBENCH_STYLESHEET.endsWith(`@layer patterns {\n${PATTERNS_CSS}\n${FRAME_CSS}\n}`)).toBe(true);
    // Everything before the frames is the Toolbar's own sheet.
    expect(WORKBENCH_STYLESHEET.replace(`\n${FRAME_CSS}\n}`, "\n}")).toBe(STYLESHEET);
  });

  for (const { id, States } of PATTERNS) {
    it(`draws ${id}'s states in a surface, light and dark, with nothing axe objects to`, async () => {
      const failed = vi.spyOn(console, "error");
      for (const theme of ["light", "dark"] as const) {
        const screen = renderInSurface(<States />, { theme, stylesheet: WORKBENCH_STYLESHEET });
        expect(screen.shadow.querySelector(".wb-states"), `${id}, ${theme}`).not.toBeNull();
        expect(await axeViolations(screen.host), `${id}, ${theme}`).toEqual([]);
        screen.unmount();
      }
      // The surface's boundary says in the console when a throw took it down.
      expect(failed.mock.calls.filter(([message]) => String(message).startsWith("Loupe hit an error"))).toEqual([]);
    });
  }
});
