// Records one tree: starts its servers, drives every scene in headless Chromium and writes,
// per scene, the structural snapshot and a screenshot of each Loupe root (`files.ts`).
//
// Deterministic by construction rather than by waiting:
// - a fixed viewport, device scale 1, locale, time zone and a fake clock at a fixed date;
// - at each capture the clock stops and runs 3s ahead (`settle`), so each timer due by then
//   has fired: the landing ring's `data-quiet` (LINGER, 2s), the sheet's close fallback, the
//   theme switch, an announcement. Then the snapshot is retaken until two in a row are equal;
// - transitions, animations and the caret are off in every root (`freeze`);
// - the mouse rests in a corner of the page unless the scene is a hover.

import { mkdirSync, writeFileSync } from "node:fs";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium, type ElementHandle, type Locator, type Page } from "playwright";
import { manifestFile, sceneFile, shotFile } from "./files.ts";
import { hasUiWorkbench, type Server, startFixture, startUi } from "./servers.ts";
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

  /** Whether the scene is wanted: `only` is a prefix of scene names. */
  wanted(scene: string): boolean {
    return !this.only || scene.startsWith(this.only);
  }

  /** Whether any scene under `prefix` may be wanted. */
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
    if (!this.wanted(scene)) return;
    const shot = await settle(page);
    for (const [name, root] of Object.entries(shot.roots)) {
      const locator: Locator = root.index === undefined ? page.locator("[data-loupe-toolbar]") : page.locator("[data-loupe-surface]").nth(root.index);
      shot.aria[name] = await locator.ariaSnapshot().catch((error: Error) => `(no ARIA snapshot: ${error.message.split("\n")[0]})`);
      const path = shotFile(this.out, scene, name);
      if (root.index === undefined) await page.screenshot({ path, animations: "disabled", caret: "hide" });
      else await locator.screenshot({ path, animations: "disabled", caret: "hide" });
    }
    writeFileSync(sceneFile(this.out, scene), JSON.stringify(shot));
    this.scenes.push(scene);
    process.stdout.write(`  ${scene}: ${Object.values(shot.roots).reduce((n, r) => n + Object.keys(r.entries).length, 0)} elements\n`);
  }

  /**
   * Drives a flow: each step's action, then its capture. It stops after the last wanted
   * scene, so a focused run (`--only toolbar/light/01-pill`) never fails on a later control.
   */
  async flow(page: Page, prefix: string, steps: [string, () => Promise<unknown>][]): Promise<void> {
    const last = steps.findLastIndex(([name]) => this.wanted(`${prefix}/${name}`));
    for (const [name, act] of steps.slice(0, last + 1)) {
      await act();
      await this.capture(page, `${prefix}/${name}`);
    }
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

const press = async (page: Page, label: string) => click(await button(page, label));

const inToolbar = (page: Page, selector: string) => page.locator(`[data-loupe-toolbar] ${selector}`).first();

/** The hand harness's ten states, in one theme, plus the hovered pill. */
async function toolbarStates(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const prefix = `toolbar/${theme}`;
  if (!r.wants(prefix)) return;
  const context = await r.context({ colorScheme: theme });
  const page = await context.newPage();
  const launcher = inToolbar(page, "[data-launcher]");
  const group = () => button(page, "Button ×7");
  await r.flow(page, prefix, [
    [
      "01-pill",
      async () => {
        await page.goto(url);
        await launcher.waitFor();
        await rest(page);
      },
    ],
    ["01-pill-hover", () => launcher.hover()],
    [
      "02-list",
      async () => {
        await rest(page);
        await click(launcher);
        await inToolbar(page, "[data-sheet]").waitFor();
      },
    ],
    ["03-row-hover", async () => (await group()).hover()],
    [
      "04-row-open",
      async () => {
        await rest(page);
        await click(await group());
      },
    ],
    [
      "05-armed",
      async () => {
        await click(await group());
        await press(page, "Select one");
      },
    ],
    [
      "06-inspector",
      async () => {
        await press(page, "Select one");
        await press(page, "Inspect Button 1 of 7");
        await page.waitForFunction(() => {
          const root = document.querySelector("[data-loupe-toolbar]")?.shadowRoot;
          return ![...(root?.querySelectorAll("button") ?? [])].some((b) => (b.getAttribute("aria-label") ?? "").startsWith("Inspect Button 2 of 7"));
        });
      },
    ],
    ["07-inspector-multiple", () => press(page, "Select multiple")],
    [
      // A change: the first unchecked chip of a prop row.
      "08-changed",
      async () => {
        await press(page, "Select one");
        await click(page.locator('[data-loupe-toolbar] [data-prop] [role="radio"][aria-checked="false"]').first());
      },
    ],
    [
      // Copy Proposal's details popover.
      "09-details",
      async () => {
        await press(page, "Copy with details");
        await inToolbar(page, '[role="dialog"]').waitFor();
      },
    ],
    [
      "10-marks-hidden",
      async () => {
        await page.keyboard.press("Escape");
        await page.clock.runFor(1000);
        await press(page, "Hide marks");
      },
    ],
  ]);
  await context.close();
}

/** At 700 × 860 the sheet overlays the page instead of taking a column. */
async function overlay(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const prefix = `overlay/${theme}`;
  if (!r.wants(prefix)) return;
  const context = await r.context({ colorScheme: theme, viewport: { width: 700, height: 860 } });
  const page = await context.newPage();
  await r.flow(page, prefix, [
    [
      "list",
      async () => {
        await page.goto(url);
        await rest(page);
        await click(inToolbar(page, "[data-launcher]"));
        await inToolbar(page, "[data-sheet]").waitFor();
      },
    ],
    ["inspector", () => press(page, "Inspect Button 1 of 7")],
  ]);
  await context.close();
}

const PATTERN_VARIANTS = [
  ["patterns", {}],
  ["patterns@forced", { forcedColors: "active" }],
] as const;

/** The fixture's `/workbench`: every pattern with sample data, in each of its frames. */
async function patterns(r: Recorder, url: string): Promise<void> {
  for (const [scene, options] of PATTERN_VARIANTS) {
    if (!r.wanted(scene)) continue;
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
    // The nav is drawn by React after the page loads: wait for it, or no page would be found.
    const links = index.locator('nav[aria-label="Primitives"] a');
    await links.first().waitFor();
    const ids = await links.evaluateAll((all) => all.map((a) => (a.getAttribute("href") ?? "").slice(1)).filter((id) => id && id !== "all"));
    if (ids.length === 0) throw new Error(`the ui workbench at ${url} lists no primitive`);
    await index.close();
    for (const id of ids) {
      const scene = `ui/${id}${variant}`;
      if (!r.wanted(scene)) continue;
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
export async function record(root: string, out: string, only?: string): Promise<void> {
  mkdirSync(out, { recursive: true });
  const servers: Server[] = [];
  const browser = await chromium.launch();
  try {
    const recorder = new Recorder(browser, out, only);
    if (hasUiWorkbench(root) && recorder.wants("ui/")) {
      const ui = await startUi(root);
      servers.push(ui);
      await primitives(recorder, ui.url);
    }
    if (["toolbar/", "overlay/", "patterns"].some((prefix) => recorder.wants(prefix))) {
      const fixture = await startFixture(root, PATTERN_VARIANTS.some(([scene]) => recorder.wanted(scene)));
      servers.push(fixture);
      await toolbarStates(recorder, fixture.url, "light");
      await toolbarStates(recorder, fixture.url, "dark");
      await overlay(recorder, fixture.url, "light");
      await overlay(recorder, fixture.url, "dark");
      await patterns(recorder, fixture.url);
    }
    writeFileSync(manifestFile(out), JSON.stringify(recorder.scenes, null, 2));
  } finally {
    await browser.close();
    for (const server of servers) await server.stop();
  }
}
