// Records one tree: starts its servers, drives every scene in headless Chromium and writes,
// per scene, the structural snapshot (`<scene>.json`) and a screenshot of each Loupe root
// (`<scene>~<root>.png`) into `out`.
//
// Deterministic by construction rather than by waiting:
// - a fixed viewport, device scale 1, locale, time zone and a fake clock at a fixed date;
// - at each capture the clock stops and runs 3s ahead (`settle`), so each timer due by then
//   has fired: the landing ring's `data-quiet` (LINGER, 2s), the sheet's close fallback, the
//   theme switch, an announcement. Then the snapshot is retaken until two in a row are equal;
// - transitions, animations and the caret are off in every root (`freeze`);
// - the mouse rests in a corner of the page unless the scene is a hover.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium, type ElementHandle, type Locator, type Page } from "playwright";
import { hasUiWorkbench, PORTS, type Server, startFixture, startUi } from "./servers.ts";
import { freeze, type Snapshot, snapshot } from "./snapshot.ts";

export type Recording = Snapshot & { aria: Record<string, string> };

const CONTEXT: BrowserContextOptions = {
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  colorScheme: "light",
  reducedMotion: "no-preference",
  forcedColors: "none",
};
const CLOCK_TIME = new Date("2026-01-15T12:00:00Z");

/** The pages whose clock has stopped: from their first capture on. */
const paused = new WeakSet<Page>();

export const slug =(name: string) => name.replace(/[^\w@.-]+/g, "-").replace(/^-|-$/g, "");

/**
 * Stops the page's clock, if it still runs, and moves it 3s on, firing every timer due by
 * then; then waits until two snapshots in a row match. The clock stays stopped from the first
 * capture on: the steps between captures happen at one instant of the page's time, and only
 * `runFor` moves it, so no timer (an announcement clearing, a ring going quiet) can fire
 * between the snapshot, the ARIA tree and the screenshots, or land on either side of them.
 */
async function settle(page: Page): Promise<Recording> {
  if (!paused.has(page)) {
    // Ahead of now, since the clock still runs while this is asked: `runFor` follows anyway.
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1000);
    paused.add(page);
  }
  await page.clock.runFor(3000);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let last = "";
  for (let i = 0; i < 40; i++) {
    await page.evaluate(freeze);
    await page.waitForTimeout(i === 0 ? 50 : 150);
    const shot = await page.evaluate(snapshot);
    const text = JSON.stringify(shot);
    if (text === last) return { ...shot, aria: {} };
    last = text;
  }
  throw new Error(`${page.url()} never settled: its snapshot kept changing for 6s`);
}

class Recorder {
  browser: Browser;
  out: string;
  only: string | undefined;
  scenes: string[] = [];
  constructor(browser: Browser, out: string, only: string | undefined) {
    this.browser = browser;
    this.out = out;
    this.only = only;
  }

  /** Whether any scene under `prefix` is wanted: `only` is a prefix of scene names. */
  wants(prefix: string): boolean {
    return !this.only || prefix.startsWith(this.only) || this.only.startsWith(prefix);
  }

  async context(options: BrowserContextOptions = {}, storage: Record<string, string> = {}): Promise<BrowserContext> {
    const context = await this.browser.newContext({ ...CONTEXT, ...options });
    await context.clock.install({ time: CLOCK_TIME });
    if (Object.keys(storage).length) {
      await context.addInitScript((entries) => {
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      }, storage);
    }
    return context;
  }

  /** Settles the page, then writes its snapshot, its ARIA tree and a screenshot of each root. */
  async capture(page: Page, scene: string): Promise<void> {
    if (this.only && !scene.startsWith(this.only)) return;
    const shot = await settle(page);
    for (const [name, root] of Object.entries(shot.roots)) {
      const locator: Locator = root.index === undefined ? page.locator("[data-loupe-toolbar]") : page.locator("[data-loupe-surface]").nth(root.index);
      shot.aria[name] = await locator.ariaSnapshot().catch((error: Error) => `(no ARIA snapshot: ${error.message.split("\n")[0]})`);
      const png = join(this.out, `${slug(scene)}~${slug(name)}.png`);
      if (root.index === undefined) await page.screenshot({ path: png, animations: "disabled", caret: "hide" });
      else await locator.screenshot({ path: png, animations: "disabled", caret: "hide" });
    }
    writeFileSync(join(this.out, `${slug(scene)}.json`), JSON.stringify(shot));
    this.scenes.push(scene);
    process.stdout.write(`  ${scene}: ${Object.values(shot.roots).reduce((n, r) => n + Object.keys(r.entries).length, 0)} elements\n`);
  }
}

/** Puts the mouse where it hovers nothing: the page's top-left corner. */
const rest = (page: Page) => page.mouse.move(1, 1);

/**
 * A Toolbar button by the start of its accessible label or its text, the first in the shadow
 * root's order, as the hand harness found them. A handle, not a locator: a piercing locator's
 * `nth()` doesn't follow that order (the page map's "Button ×7" would come before the row's).
 */
async function button(page: Page, label: string): Promise<ElementHandle<Element>> {
  const handle = await page.evaluateHandle((label) => {
    const buttons = [...(document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelectorAll("button") ?? [])];
    return buttons.find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(label)) ?? null;
  }, label);
  const element = handle.asElement();
  if (!element) throw new Error(`the Toolbar has no button "${label}"`);
  return element;
}

/**
 * Clicks in the page, as the hand harness did (`el.click()`): the sheet's sticky page map can
 * cover a row a real pointer would have to scroll to, and the pointer stays at rest, so no
 * state is measured under a hover it didn't ask for. The hover scenes move the real mouse.
 */
const click = async (target: ElementHandle<Element> | Locator): Promise<void> => {
  const handle: ElementHandle<Element> | null = "elementHandle" in target ? await target.elementHandle() : target;
  if (!handle) throw new Error(`nothing to click: ${String(target)}`);
  await handle.evaluate((el) => (el as HTMLElement).click());
};

async function press(page: Page, label: string): Promise<void> {
  await click(await button(page, label));
}

const inToolbar = (page: Page, selector: string) => page.locator(`[data-loupe-toolbar] ${selector}`).first();

/** The hand harness's ten states, in one theme, plus the hovered pill. */
async function toolbarStates(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const prefix = `toolbar/${theme}`;
  if (!r.wants(prefix)) return;
  const context = await r.context({ colorScheme: theme });
  const page = await context.newPage();
  await page.goto(url);
  await inToolbar(page, "[data-launcher]").waitFor();
  await rest(page);
  await r.capture(page, `${prefix}/01-pill`);
  await inToolbar(page, "[data-launcher]").hover();
  await r.capture(page, `${prefix}/01-pill-hover`);
  await rest(page);
  await click(inToolbar(page, "[data-launcher]"));
  await inToolbar(page, "[data-sheet]").waitFor();
  await r.capture(page, `${prefix}/02-list`);
  const group = await button(page, "Button ×7");
  await group.hover();
  await r.capture(page, `${prefix}/03-row-hover`);
  await rest(page);
  await click(group);
  await r.capture(page, `${prefix}/04-row-open`);
  await click(group);
  await press(page, "Select one");
  await r.capture(page, `${prefix}/05-armed`);
  await press(page, "Select one");
  await press(page, "Inspect Button 1 of 7");
  await page.waitForFunction(() => {
    const root = document.querySelector("[data-loupe-toolbar]")?.shadowRoot;
    return ![...(root?.querySelectorAll("button") ?? [])].some((b) => (b.getAttribute("aria-label") ?? "").startsWith("Inspect Button 2 of 7"));
  });
  await r.capture(page, `${prefix}/06-inspector`);
  await press(page, "Select multiple");
  await r.capture(page, `${prefix}/07-inspector-multiple`);
  await press(page, "Select one");
  // A change: the first unchecked chip of a prop row, then Copy Proposal's details popover.
  await click(page.locator('[data-loupe-toolbar] [data-prop] [role="radio"][aria-checked="false"]').first());
  await r.capture(page, `${prefix}/08-changed`);
  await press(page, "Copy with details");
  await inToolbar(page, '[role="dialog"]').waitFor();
  await r.capture(page, `${prefix}/09-details`);
  await page.keyboard.press("Escape");
  await page.clock.runFor(1000);
  await press(page, "Hide marks");
  await r.capture(page, `${prefix}/10-marks-hidden`);
  await context.close();
}

/** At 700 × 860 the sheet overlays the page instead of taking a column. */
async function overlay(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const prefix = `overlay/${theme}`;
  if (!r.wants(prefix)) return;
  const context = await r.context({ colorScheme: theme, viewport: { width: 700, height: 860 } });
  const page = await context.newPage();
  await page.goto(url);
  await rest(page);
  await click(inToolbar(page, "[data-launcher]"));
  await inToolbar(page, "[data-sheet]").waitFor();
  await r.capture(page, `${prefix}/list`);
  await press(page, "Inspect Button 1 of 7");
  await r.capture(page, `${prefix}/inspector`);
  await context.close();
}

/** The fixture's `/workbench`: every pattern with sample data, in each of its frames. */
async function patterns(r: Recorder, url: string): Promise<void> {
  for (const [variant, options] of [["", {}], ["@forced", { forcedColors: "active" }]] as const) {
    const scene = `patterns${variant}`;
    if (!r.wants(scene)) continue;
    const context = await r.context(options);
    const page = await context.newPage();
    await page.goto(`${url}workbench`);
    await page.locator("[data-loupe-surface]").first().waitFor();
    await rest(page);
    await r.capture(page, scene);
    await context.close();
  }
}

/** Each `@loupe/ui` primitive's page, `#<folder>`: at 16px, at 20px and under forced colours. */
async function primitives(r: Recorder, url: string): Promise<void> {
  const variants = [
    ["", {}, "16"],
    ["@20px", {}, "20"],
    ["@forced", { forcedColors: "active" }, "16"],
  ] as const;
  for (const [variant, options, size] of variants) {
    // The .md is off: the check is about the surfaces, and the page's layout then doesn't hang on the docs.
    const context = await r.context(options, { "loupe-ui-workbench:doc": "false", "loupe-ui-workbench:text-size": size });
    const index = await context.newPage();
    await index.goto(url);
    const ids = await index.locator('nav[aria-label="Primitives"] a').evaluateAll((links) =>
      links.map((a) => (a.getAttribute("href") ?? "").slice(1)).filter((id) => id && id !== "all"),
    );
    await index.close();
    for (const id of ids) {
      const scene = `ui/${id}${variant}`;
      if (!r.wants(scene)) continue;
      const page = await context.newPage();
      await page.goto(`${url}#${id}`);
      await page.locator("[data-loupe-surface]").first().waitFor();
      await rest(page);
      await r.capture(page, scene);
      await page.close();
    }
    await context.close();
  }
}

/** Records the tree at `root` into `out`; `only` keeps the scenes whose name starts with it. */
export async function record(root: string, out: string, only?: string): Promise<string[]> {
  mkdirSync(out, { recursive: true });
  const servers: Server[] = [];
  const browser = await chromium.launch();
  try {
    const recorder = new Recorder(browser, out, only);
    if (hasUiWorkbench(root) && recorder.wants("ui/")) {
      const ui = await startUi(root, PORTS.ui);
      servers.push(ui);
      await primitives(recorder, ui.url);
    }
    if (["toolbar/", "overlay/", "patterns"].some((prefix) => recorder.wants(prefix))) {
      const fixture = await startFixture(root, PORTS.fixture);
      servers.push(fixture);
      await toolbarStates(recorder, fixture.url, "light");
      await toolbarStates(recorder, fixture.url, "dark");
      await overlay(recorder, fixture.url, "light");
      await overlay(recorder, fixture.url, "dark");
      await patterns(recorder, fixture.url);
    }
    writeFileSync(join(out, "scenes.json"), JSON.stringify(recorder.scenes, null, 2));
    return recorder.scenes;
  } finally {
    await browser.close();
    for (const server of servers) await server.stop();
  }
}
