// The patterns' sample words against panel-view's own (ADR 0012): the samples spell the
// words out, so the patterns, their tests and their workbench import nothing from
// panel-view. This keeps the copy honest: each bundle equals the constant `panelView()`'s
// views pass, value for value, and each of its functions says the same for the same input.

import { describe, expect, it } from "vitest";
import { WORDS } from "../patterns/samples.js";
import { LAUNCHER_WORDS, OUTLINE_WORDS, SHEET_WORDS } from "./chrome.js";
import { COMMAND_WORDS, COPY_WORDS, FOOTER_WORDS, HEADER_WORDS, INSPECTOR_WORDS, LIST_WORDS } from "./words.js";

const REAL: Record<keyof typeof WORDS, unknown> = {
  inspector: INSPECTOR_WORDS,
  list: LIST_WORDS,
  header: HEADER_WORDS,
  footer: FOOTER_WORDS,
  copy: COPY_WORDS,
  command: COMMAND_WORDS,
  launcher: LAUNCHER_WORDS,
  sheet: SHEET_WORDS,
  outline: OUTLINE_WORDS,
};

/** What each function in the words is called with, by its path: every one needs a probe, or the test fails. */
const PROBES: Record<string, unknown[][]> = {
  "inspector.change": [[1], [12]],
  "list.change": [[1], [12]],
  "inspector.hold.off": [["open"]],
  "inspector.hold.on": [["open"]],
  "footer.offer.reset": [[1], [2]],
  "footer.offer.discard": [[1], [3]],
  "copy.copiedText": [["Quieter menus"]],
  "copy.notCopiedText": [
    ["The page isn’t focused.", true],
    ["The page isn’t focused.", false],
  ],
  "launcher.title": [["⌘."]],
  "outline.size": [["Button", 32, 32]],
};

/**
 * The words as plain data: each function replaced by what it returns for its probes, so two
 * bundles compare by what they say. A function with no probe is named, to fail the test.
 */
function said(value: unknown, at: string): unknown {
  if (typeof value === "function") {
    const probes = PROBES[at];
    if (!probes) return `no probe for ${at}`;
    return probes.map((args) => (value as (...args: unknown[]) => unknown)(...args));
  }
  if (Array.isArray(value)) return value.map((item, index) => said(item, `${at}.${index}`));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, said(item, `${at}.${key}`)]));
  }
  return value;
}

describe("the patterns' sample words", () => {
  it("spell out a bundle for each of panel-view's", () => {
    expect(Object.keys(WORDS).sort()).toEqual(Object.keys(REAL).sort());
  });

  it.each(Object.keys(REAL) as (keyof typeof WORDS)[])("say what panel-view's %s words say", (name) => {
    expect(said(WORDS[name], name)).toEqual(said(REAL[name], name));
  });

  it("would catch a word that drifted", () => {
    const stale = { ...WORDS.footer, offer: { ...WORDS.footer.offer, reset: (count: number) => `Reset ${count}` } };
    expect(said(stale, "footer")).not.toEqual(said(FOOTER_WORDS, "footer"));
  });
});
