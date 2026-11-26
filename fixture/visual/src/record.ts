// Records one tree: starts its servers, drives every scene in headless Chromium and writes,
// per scene, the structural snapshot and a screenshot of each Loupe root (`files.ts`).
//
// Deterministic by construction rather than by waiting:
// - a fixed viewport, device scale 1, locale, time zone and a fake clock at a fixed date;
// - at each capture the clock stops and runs 3s ahead (`settle`), so each timer due by then
//   has fired: the landing ring's `data-quiet` (LINGER, 2s), the sheet's close fallback, the
//   theme switch, an announcement. Then the snapshot is retaken until two in a row are equal;
// - transitions, animations and the caret are off in every root (`freeze`);
// - the mouse rests in a corner of the page unless the scene is a hover;
// - Chromium rasters a whole tile whenever it rasters one (`BROWSER_ARGS`).
//
// Each Toolbar scene is also audited: axe-core in the page, colour contrast included, on the
// Loupe roots, after the screenshots (`audit.ts`).
//
// The base is recorded leniently: a flow whose step it can't drive (a control the base predates)
// is written to `skipped.json` from that step on, and the diff counts its scenes as new. A
// capture that fails is no missing control, and stops the run on either side. The head is
// strict: a scene it can't drive stops the check (exit 2).

import { mkdirSync, writeFileSync } from "node:fs";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium, type ElementHandle, type Locator, type Page } from "playwright";
import { type Audit, audit } from "./audit.ts";
import { manifestFile, mayselect, sceneFile, selects, shotFile, skippedFile } from "./files.ts";
import { hasWorkbench, type Server, startFixture, startWorkbench, type Workbench } from "./servers.ts";
import { freeze, type Snapshot, snapshot } from "./snapshot.ts";

export type Recording = Snapshot & { aria: Record<string, string>; axe?: Audit };

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

/**
 * Partial raster off. With it on, Chromium repaints only the rectangle of a tile that changed,
 * clipped to it, and a blur or a path's antialiased edge across the clip comes out a few levels
 * apart from a whole tile's raster. Where the clip falls hangs on which frames were drawn on the
 * way, which varies from run to run: PropRow's Delta triangles (10 pixels, up to 6/255, a
 * capture taken partly below the window, whose tiles are rastered then) and the Toolbar's
 * header in 06-inspector on Linux (6 pixels in a band across the Sheet's edge and the
 * wordmark). Off, a tile's pixels depend on what it draws, not on how it got there.
 */
const BROWSER_ARGS = ["--disable-partial-raster"];

/** The pages whose clock has stopped: from their first capture on. */
const paused = new WeakSet<Page>();

/**
 * Stops the page's clock, if it still runs, and moves it 3s on, firing every timer due by
 * then. The clock stays stopped from the first capture on: the steps between captures happen
 * at one instant of the page's time, and only `runFor` moves it, so no timer (an announcement
 * clearing, a ring going quiet) can fire between the snapshot, the ARIA tree and the
 * screenshots, or land on either side of them. A scene left out by `--only` still advances
 * it, so the scenes after it are drawn at the page time a whole run draws them at.
 */
async function advance(page: Page): Promise<void> {
  await pause(page);
  await page.clock.runFor(3000);
}

/**
 * Stops the page's clock, if it still runs. The flows after the hand harness's call it as soon
 * as the page has loaded, so their steps before the first capture happen at one instant too:
 * Reset all announces twice, 2s apart, and a clock left running would let the second land
 * before or after the capture by how fast the steps went.
 */
async function pause(page: Page): Promise<void> {
  if (paused.has(page)) return;
  // Ahead of now, since the clock still runs while this is asked.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
  paused.add(page);
}

/**
 * Loads the fixture, waits for the pill, stops the clock, turns transitions and animations off,
 * runs the clock past the panel's preload and rests the mouse. Off before anything opens: CSS animations run on the browser's own clock,
 * not the page's, and the sheet's opening scale, cut short at a moment that varies, leaves the
 * header's composited layer rastered at the scale it had then (858 pixels of the wordmark and
 * icons a little soft, in states/light/undo). The hand harness's flows capture the pill first,
 * which turns them off before the sheet opens.
 */
async function load(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.locator("[data-loupe-toolbar] [data-launcher]").first().waitFor();
  await pause(page);
  await page.evaluate(freeze);
  // Past the panel's preload (start.ts: when idle, within 4s), as the pill's capture takes the hand harness's flows.
  await page.clock.runFor(5000);
  await page.waitForLoadState("networkidle");
  await rest(page);
}

/** `advance`, then waits until two snapshots in a row match. */
async function settle(page: Page): Promise<Recording> {
  await advance(page);
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

/**
 * Moves the stopped clock on 50ms at a time until `done` holds in the page, for a step that
 * waits on a timer of the app's and on something outside the page (a server's answer):
 * Copy Proposal's. Stopped, the clock would never get there; running, it would land anywhere.
 * Where it lands within those 50ms doesn't show: the capture after it runs 3s on, past what
 * the step waited for and short of what follows it (the toast's 4s).
 */
async function until(page: Page, done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await page.evaluate(done)) return;
    await page.clock.runFor(50);
    await page.waitForTimeout(25);
  }
  const said = await page.evaluate(() => document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelector("footer, [data-footer]")?.textContent ?? "");
  throw new Error(`${what} never happened in 10s of the page's time; the footer: ${said}`);
}

/** A flow's step: its scene's name, what brings it about, and whether axe audits it (by default). */
type Step = [name: string, act: () => Promise<unknown>, audited?: boolean];

class Recorder {
  browser: Browser;
  out: string;
  only: string | undefined;
  lenient: boolean;
  scenes: string[] = [];
  /** The scenes a lenient recording couldn't drive, and why. */
  skipped: Record<string, string> = {};
  constructor(browser: Browser, out: string, only: string | undefined, lenient: boolean) {
    this.browser = browser;
    this.out = out;
    this.only = only;
    this.lenient = lenient;
  }

  /** Whether the scene is wanted: `only` lists prefixes of scene names. */
  wanted(scene: string): boolean {
    return selects(this.only, scene);
  }

  /** Whether any scene under `prefix` may be wanted. */
  wants(prefix: string): boolean {
    return mayselect(this.only, prefix);
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

  /**
   * Settles the page, then writes its snapshot, its ARIA tree and a screenshot of each root;
   * with `audited`, then axe's violations, last, so nothing it does is in the pictures.
   */
  async capture(page: Page, scene: string, audited = false): Promise<void> {
    if (!this.wanted(scene)) return advance(page);
    const shot: Recording = await settle(page);
    for (const [name, root] of Object.entries(shot.roots)) {
      const locator: Locator = root.index === undefined ? page.locator("[data-loupe-toolbar]") : page.locator("[data-loupe-surface]").nth(root.index);
      shot.aria[name] = await locator.ariaSnapshot().catch((error: Error) => `(no ARIA snapshot: ${error.message.split("\n")[0]})`);
      const path = shotFile(this.out, scene, name);
      if (root.index === undefined) await page.screenshot({ path, animations: "disabled", caret: "hide" });
      else await locator.screenshot({ path, animations: "disabled", caret: "hide" });
    }
    if (audited) shot.axe = await audit(page);
    writeFileSync(sceneFile(this.out, scene), JSON.stringify(shot));
    this.scenes.push(scene);
    const violations = shot.axe ? `, ${Object.values(shot.axe.failed).reduce((n, nodes) => n + nodes.length, 0)} axe violation(s)` : "";
    process.stdout.write(`  ${scene}: ${Object.values(shot.roots).reduce((n, r) => n + Object.keys(r.entries).length, 0)} elements${violations}\n`);
  }

  /**
   * Drives a flow: each step's action, then its capture. It stops after the last wanted
   * scene, so a focused run (`--only toolbar/light/01-pill`) never fails on a later control.
   * Leniently, a step whose action throws skips the rest of the flow's wanted scenes, with the
   * error: the base has no such control yet. A capture that throws (a screenshot, the audit)
   * is no missing control, and stops the run on either side.
   * Every scene is audited unless its step says `false` (the peek, see-through by design).
   */
  async flow(page: Page, prefix: string, steps: Step[]): Promise<void> {
    const wanted = steps.map(([name]) => `${prefix}/${name}`).filter((scene) => this.wanted(scene));
    const last = steps.findLastIndex(([name]) => this.wanted(`${prefix}/${name}`));
    for (const [name, act, audited = true] of steps.slice(0, last + 1)) {
      try {
        await act();
      } catch (error) {
        if (!this.lenient) throw error;
        const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0]!;
        for (const scene of wanted.filter((s) => !this.scenes.includes(s))) this.skipped[scene] = reason;
        process.stdout.write(`  ${prefix}/${name}: couldn't be driven here, so it and the flow's later scenes are new to the diff (${reason})\n`);
        return;
      }
      await this.capture(page, `${prefix}/${name}`, audited);
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

/** The Toolbar's shadow root's focused element matches `selector`, and `:focus-visible`: a keyboard put it there. */
async function focused(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (selector) => {
      const active = document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.activeElement;
      return Boolean(active?.matches(selector) && active.matches(":focus-visible"));
    },
    selector,
    { polling: 100 },
  );
}

/** Waits for the Toolbar to draw a button whose label or text starts with `label`, moving the clock on for it. */
async function hasButton(page: Page, label: string): Promise<void> {
  const drawn = (label: string) =>
    [...(document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelectorAll("button") ?? [])].some((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(label));
  for (let i = 0; i < 200; i++) {
    if (await page.evaluate(drawn, label)) return;
    await page.clock.runFor(50);
    await page.waitForTimeout(25);
  }
  throw new Error(`the Toolbar never drew a button "${label}"`);
}

/** Opens the sheet from the pill, as 02-list does; the stopped clock moves on until it shows, should its code still be loading. */
async function openSheet(page: Page): Promise<void> {
  await rest(page);
  await click(inToolbar(page, "[data-launcher]"));
  await until(page, () => document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelector("[data-sheet]") != null, "the sheet open");
}

/** The Inspector on the first Button, as 06-inspector has it. */
async function inspectFirst(page: Page): Promise<void> {
  await press(page, "Inspect Button 1 of 7");
  await inspector(page);
}

/** Waits for the Inspector's props, moving the stopped clock on for them. */
const inspector = (page: Page) => until(page, () => document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelector("[data-prop]") != null, "the Inspector");

/**
 * The states the hand harness had no step for: Undo after a reset, the Alt peek, the copy
 * toast, and Gone (the selected Instance unmounted under the Inspector).
 */
async function moreStates(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const prefix = `states/${theme}`;
  if (!r.wants(prefix)) return;
  const context = await r.context({ colorScheme: theme });
  // Copy Proposal writes to the clipboard, and its toast says it did.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
  const page = await context.newPage();
  await r.flow(page, prefix, [
    [
      // A change, then Reset all: the footer offers to put it back.
      "undo",
      async () => {
        await load(page, url);
        await openSheet(page);
        await inspectFirst(page);
        await click(page.locator('[data-loupe-toolbar] [data-prop] [role="radio"][aria-checked="false"]').first());
        await hasButton(page, "Reset this Instance");
        await press(page, "Reset all");
        await hasButton(page, "Undo");
      },
    ],
    [
      // A lone Alt, held past PEEK_DELAY (200ms): `settle` runs the clock 3s on with it down.
      // Not audited: the panel is see-through on purpose, for the page under it.
      "peek",
      () => page.keyboard.down("Alt"),
      false,
    ],
    [
      // Undo taken, then Copy Proposal: its toast, 3s into its 4s.
      "copy-toast",
      async () => {
        await page.keyboard.up("Alt");
        await press(page, "Undo");
        // Copy Proposal stays disabled until the footer has counted Undo's change, which it does on a timer.
        await until(page, () => document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelector("[data-copy]:not([disabled])") != null, "Copy Proposal enabled");
        await press(page, "Copy Proposal");
        await until(page, () => Boolean(document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.querySelector("[data-copy-toast]")), "the copy toast");
      },
    ],
    [
      // A menu's item selected while the menu is open, then the menu closed with Esc: "Not on the page now".
      "gone",
      async () => {
        // Back to the list, whose page map has a block for each Instance on the page. The menu
        // opens and closes on the library's timers: the stopped clock is moved on for them.
        await press(page, "All components");
        await hasButton(page, "Inspect DropdownMenu 1 of 6");
        await page.locator('main button[aria-label="Actions for Ana Souza"]').click();
        await until(page, () => document.querySelector('[role="menu"]') !== null, "Ana's menu open");
        await rest(page);
        await hasButton(page, "Inspect DropdownMenuItem 1 of 2");
        await press(page, "Inspect DropdownMenuItem 1 of 2");
        await inspector(page);
        await page.keyboard.press("Escape");
        await until(page, () => document.querySelector('[role="menu"]') === null, "Ana's menu closed");
        await page.waitForFunction(() => document.querySelector("[data-loupe-toolbar]")?.shadowRoot?.textContent?.includes("Not on the page now"), undefined, { polling: 100 });
      },
    ],
  ]);
  await context.close();
}

/**
 * The reader's settings: a 20px default text size (Chromium's own setting, through CDP, as
 * the browser's preference would set it), forced colours, and a 320px window (WCAG 1.4.10),
 * each with the pill, the list and the Inspector.
 */
async function settings(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const variants: [string, BrowserContextOptions, boolean][] = [
    ["20px", {}, true],
    ["forced", { forcedColors: "active" }, false],
    ["320", { viewport: { width: 320, height: 720 } }, false],
  ];
  for (const [name, options, large] of variants) {
    const prefix = `settings/${theme}/${name}`;
    if (!r.wants(prefix)) continue;
    const context = await r.context({ colorScheme: theme, ...options });
    const page = await context.newPage();
    await r.flow(page, prefix, [
      [
        "pill",
        async () => {
          if (large) await (await context.newCDPSession(page)).send("Page.setFontSizes", { fontSizes: { standard: 20 } });
          await load(page, url);
        },
      ],
      ["list", () => openSheet(page)],
      ["inspector", () => inspectFirst(page)],
    ]);
    await context.close();
  }
}

/** The pill docked at each side of the window, halfway along it (`loupe:launcher`, launcher-place.ts). */
async function pillEdges(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  for (const edge of ["top", "right", "bottom", "left"]) {
    const prefix = `pill/${theme}`;
    if (!r.wanted(`${prefix}/${edge}`)) continue;
    const context = await r.context({ colorScheme: theme }, { "loupe:launcher": JSON.stringify({ edge, at: 0.5 }) });
    const page = await context.newPage();
    await r.flow(page, prefix, [
      [
        edge,
        () => load(page, url),
      ],
    ]);
    await context.close();
  }
}

/**
 * Keyboard focus, from real key presses, so `:focus-visible` matches: Alt+Shift+L to the pill,
 * then, with the sheet open, to the list's heading, and Tab from there to the first row.
 */
async function keyboardFocus(r: Recorder, url: string, theme: "light" | "dark"): Promise<void> {
  const prefix = `focus/${theme}`;
  if (!r.wants(prefix)) return;
  const context = await r.context({ colorScheme: theme });
  const page = await context.newPage();
  await r.flow(page, prefix, [
    [
      "pill",
      async () => {
        await load(page, url);
        await page.keyboard.press("Alt+Shift+KeyL");
        await focused(page, "[data-launcher], [data-launcher] *");
      },
    ],
    [
      "heading",
      async () => {
        // Esc gives focus back to the page; the sheet opens; the keys bring focus to its heading.
        await page.keyboard.press("Escape");
        await openSheet(page);
        await page.keyboard.press("Alt+Shift+KeyL");
        await focused(page, "h1, h2, h3, [data-view-heading]");
      },
    ],
    [
      "row",
      async () => {
        const row = await button(page, "Button ×7");
        for (let i = 0; i < 60 && !(await row.evaluate((el) => el.matches(":focus"))); i++) await page.keyboard.press("Tab");
        if (!(await row.evaluate((el) => el.matches(":focus-visible")))) throw new Error('Tab never brought keyboard focus to the "Button ×7" row');
      },
    ],
  ]);
  await context.close();
}

/** What tells one package's workbench from another's: its nav's name, and the key the page keeps the reader's settings under. */
const WORKBENCHES: Record<Workbench, { nav: string; storage: string; what: string }> = {
  ui: { nav: "Primitives", storage: "loupe-ui-workbench", what: "primitive" },
  patterns: { nav: "Patterns", storage: "loupe-patterns-workbench", what: "pattern" },
};

/**
 * Each page of a package's workbench (`ui/<primitive>`, `patterns/<pattern>`), by its folder
 * (`#<folder>`): at 16px, at 20px and under forced colours. Both are drawn by `@loupe/ui`'s
 * workbench shell, so one recorder reads either.
 */
async function workbench(r: Recorder, url: string, name: Workbench): Promise<void> {
  const { nav, storage, what } = WORKBENCHES[name];
  const variants = [
    ["", {}, "16"],
    ["@20px", {}, "20"],
    ["@forced", { forcedColors: "active" }, "16"],
  ] as const;
  for (const [variant, options, size] of variants) {
    // The .md is off: the check is about the surfaces, and the page's layout then doesn't hang on the docs.
    const context = await r.context(options, { [`${storage}:doc`]: "false", [`${storage}:text-size`]: size });
    const index = await context.newPage();
    await index.goto(url);
    // The nav is drawn by React after the page loads: wait for it, or no page would be found.
    const links = index.locator(`nav[aria-label="${nav}"] a`);
    await links.first().waitFor();
    const ids = await links.evaluateAll((all) => all.map((a) => (a.getAttribute("href") ?? "").slice(1)).filter((id) => id && id !== "all"));
    if (ids.length === 0) throw new Error(`the ${name} workbench at ${url} lists no ${what}`);
    await index.close();
    for (const id of ids) {
      const scene = `${name}/${id}${variant}`;
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

/** The prefixes of the scenes recorded on the fixture: the Toolbar's. */
const FIXTURE_SCENES = ["toolbar/", "overlay/", "states/", "settings/", "pill/", "focus/"];

/**
 * Records the tree at `root` into `out`; `only` keeps the scenes whose name starts with one of
 * its prefixes. `lenient` (the base) skips a flow it can't drive instead of failing, and returns
 * the scenes it skipped: see the head of this file.
 */
export async function record(root: string, out: string, only?: string, lenient = false): Promise<Record<string, string>> {
  mkdirSync(out, { recursive: true });
  const servers: Server[] = [];
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  try {
    const recorder = new Recorder(browser, out, only, lenient);
    for (const name of ["ui", "patterns"] as const) {
      if (!hasWorkbench(root, name) || !recorder.wants(`${name}/`)) continue;
      const server = await startWorkbench(root, name);
      servers.push(server);
      await workbench(recorder, server.url, name);
    }
    if (FIXTURE_SCENES.some((prefix) => recorder.wants(prefix))) {
      const fixture = await startFixture(root);
      servers.push(fixture);
      for (const scenes of [toolbarStates, overlay, moreStates, settings, pillEdges, keyboardFocus]) {
        for (const theme of ["light", "dark"] as const) await scenes(recorder, fixture.url, theme);
      }
    }
    writeFileSync(manifestFile(out), JSON.stringify(recorder.scenes, null, 2));
    writeFileSync(skippedFile(out), JSON.stringify(recorder.skipped, null, 2));
    return recorder.skipped;
  } finally {
    await browser.close();
    for (const server of servers) await server.stop();
  }
}
