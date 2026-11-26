// axe-core in a real browser, on the Toolbar's scenes. The repo's own axe runs in jsdom, which
// has no layout and so no colour: `color-contrast` is off there. Here it runs in Chromium on
// the page the recorder already has open, once per scene, after the screenshots, with its
// rules as axe ships them (WCAG A and AA, and best practice), colour contrast included.
//
// Only the Loupe roots are audited (the Toolbar's host and each `<Surface>`): the fixture's own
// page is the host app's business.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright";

/**
 * A scene's audit, per rule: `failed`, a line per node that fails it, with its impact; and
 * `unsure`, how many nodes axe couldn't judge (its "incomplete": a colour behind text it
 * can't tell, say).
 */
export type Audit = { failed: Record<string, string[]>; unsure: Record<string, number> };

const SOURCE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/**
 * axe, loaded with timers of its own. The page's clock is fake and stopped from the first
 * capture (`record.ts`, `settle`), and axe waits on `setTimeout(…, 0)` between its rules, so
 * on the page's timers it would never finish, and moving the clock for it would fire the
 * page's own timers between two captures. Its own timers run a 0 or 1ms callback from a
 * MessageChannel and never one that is longer: those are its timeouts for frames and for
 * preloading the CSSOM, and both are off (`audit`). The page's timers are untouched.
 */
const LOAD = `void (window.axe || (() => {
  const channel = new MessageChannel();
  const due = new Map();
  let next = 1;
  channel.port1.onmessage = (event) => {
    const run = due.get(event.data);
    due.delete(event.data);
    if (run) run();
  };
  const setTimeout = (callback, delay, ...args) => {
    const id = next++;
    if (!(delay > 1)) {
      due.set(id, () => callback(...args));
      channel.port2.postMessage(id);
    }
    return id;
  };
  const clearTimeout = (id) => void due.delete(id);
  (function (setTimeout, clearTimeout) {
${SOURCE}
  }).call(window, setTimeout, clearTimeout);
})())`;

/** Runs axe on every Loupe root in the page; scroll positions are put back as they were. */
export async function audit(page: Page): Promise<Audit> {
  await page.evaluate(LOAD);
  return page.evaluate(async () => {
    type Found = { id: string; impact?: string | null; nodes: { target: unknown[]; failureSummary?: string }[] }[];
    type Result = { violations: Found; incomplete: Found };
    const axe = (window as unknown as { axe: { run(context: unknown, options: unknown): Promise<Result> } }).axe;
    const hosts = [...document.querySelectorAll("[data-loupe-toolbar], [data-loupe-surface]")];
    if (hosts.length === 0) return { failed: {}, unsure: {} };
    // axe scrolls an element into view to read the colour behind it: put every scroll back.
    const scrolled: [Element, number, number][] = [];
    const visit = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll("*")) {
        if (el.scrollTop || el.scrollLeft) scrolled.push([el, el.scrollTop, el.scrollLeft]);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(document);
    const [x, y] = [scrollX, scrollY];
    try {
      const result = await axe.run({ include: hosts }, { resultTypes: ["violations", "incomplete"], iframes: false, preload: false });
      const failed: Record<string, string[]> = {};
      for (const v of result.violations) {
        failed[v.id] = v.nodes.map((n) => {
          const target = n.target.flat(3).join(" >>> ");
          const why = (n.failureSummary ?? "").split("\n").slice(1).join(" ").trim();
          return `(${v.impact ?? "no impact"}) ${target}${why ? `: ${why}` : ""}`;
        });
      }
      return { failed, unsure: Object.fromEntries(result.incomplete.map((v) => [v.id, v.nodes.length])) };
    } finally {
      for (const [el, top, left] of scrolled) {
        el.scrollTop = top;
        el.scrollLeft = left;
      }
      scrollTo(x, y);
    }
  });
}

/**
 * What the head's audit finds that the base's doesn't: per rule that fails in the head, its
 * nodes, when the head has more that fail it or that axe couldn't judge than the base has.
 * Counted, not matched node by node, since axe names a node by a selector that can carry a
 * generated id. Failed and couldn't-judge are counted together, since axe can put the same
 * node in either from one run to the next (seen once, on the Inspector's file line in dark): a
 * node it newly fails is new, one moving between the two isn't. A scene the base lacks has no audit there.
 */
export function newViolations(base: Audit | undefined, head: Audit | undefined): string[] {
  const out: string[] = [];
  const flagged = (audit: Audit | undefined, rule: string) => (audit?.failed[rule]?.length ?? 0) + (audit?.unsure[rule] ?? 0);
  for (const [rule, nodes] of Object.entries(head?.failed ?? {})) {
    if (flagged(head, rule) <= flagged(base, rule)) continue;
    const before = base?.failed[rule]?.length ?? 0;
    out.push(`${rule}: ${nodes.length} node(s) fail it, ${before} in the base`, ...nodes.map((node) => `  ${node}`));
  }
  return out;
}
