// @vitest-environment jsdom
// The workbench (ADR 0011) covers every primitive: each folder in `src/` with a `.md` has an
// entry, its `.md` is that file, and its states draw in a real surface, light and dark, under
// the workbench's stylesheet, with nothing axe objects to.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stylesheet } from "../src/surface/index.js";
import { axeViolations, cleanup, renderInSurface } from "../src/surface/render.fixture.js";
import { PRIMITIVES } from "./primitives.js";
import { WORKBENCH_CSS, WORKBENCH_STYLESHEET } from "./stylesheet.js";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Every primitive's folder: one with a `.md` of its states, ARIA and keys. */
const FOLDERS = readdirSync(src, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && readdirSync(path.join(src, entry.name)).includes(`${entry.name}.md`))
  .map((entry) => entry.name)
  .sort();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the workbench", () => {
  it("has an entry for every primitive, by its folder", () => {
    expect(FOLDERS.length).toBeGreaterThan(10);
    expect(PRIMITIVES.map((primitive) => primitive.id).sort()).toEqual(FOLDERS);
  });

  it("shows each primitive's own .md", () => {
    for (const primitive of PRIMITIVES) expect(primitive.doc, primitive.id).toBe(readFileSync(path.join(src, primitive.id, `${primitive.id}.md`), "utf8"));
  });

  it("puts its frame layout in the top layer, where a consumer's patterns go", () => {
    expect(WORKBENCH_STYLESHEET).toBe(stylesheet(WORKBENCH_CSS));
    expect(WORKBENCH_STYLESHEET.endsWith(`@layer patterns {\n${WORKBENCH_CSS}\n}`)).toBe(true);
  });

  for (const { id, States } of PRIMITIVES) {
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
