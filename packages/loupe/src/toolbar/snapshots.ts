// Snapshots (PER-138, per PER-99 §2–3): a before/after pair of the screen in view,
// kept for the Proposal. Each capture rasterizes the viewport twice, once as it is
// and once in the "before" view: every Override off except State-prop ones, so an
// open dialog stays open. A crop pair per change on screen is cut from the two
// viewport images, so before and after always line up.
//
// The Rasterizer (PER-217) measures nodes and draws the viewport: in the page,
// `modern-screenshot` (`snapshots-raster.ts`); in tests, fixed pixels
// (`snapshots.fixture.ts`). Everything else about a capture happens here.
//
// While "before" renders, a still of the page as it was covers it, so capturing
// doesn't visibly disturb the page. Nothing is drawn on the images.
//
// A Snapshot records the Overrides each Instance on screen showed. When one of
// them changes, the Snapshot is Outdated and isn't exported. Snapshots live until
// the page reloads.

import { flushSync } from "react-dom";
import { type ImagePair, type SnapshotInput, setOnKey, toJson } from "../proposal/build.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { currentRoute, emitChange, identityOf, type MountedInstance, registry, setView } from "../runtime/registry.js";
import { type InstanceIdentity, type OverrideRecord, reachOf } from "../runtime/store.js";
import { CAPTURE_ATTRIBUTE, screenshotRasterizer } from "./snapshots-raster.js";

/** Around a crop, in CSS pixels. */
export const CROP_PADDING = 24;
/** Per-Instance crops when a change's union is taller than the viewport. */
export const MAX_INSTANCE_CROPS = 4;

export type Snapshot = SnapshotInput & {
  /** 1-based, in capture order; kept by a Retake. */
  id: number;
  url: string;
  capturedAt: string;
  /** Width and height in CSS pixels. */
  size: [number, number];
  dpr: number;
  /** Taken by an export rather than by *Capture screen*. */
  auto: boolean;
  /** Per Instance on screen at capture, the Overrides it showed, as stable JSON. */
  shown: { identity: InstanceIdentity; overrides: string }[];
  /** The images' size as embedded in a report: the data URLs' length. */
  bytes: number;
};

/** A box in CSS pixels, from the viewport's top left corner. */
export type Rect = { top: number; left: number; bottom: number; right: number };

/** The viewport to draw: its size in CSS pixels, and the device pixel ratio. */
export type Frame = { width: number; height: number; dpr: number };

/** One drawing of the viewport. */
export type Raster = {
  /** Images on the page that didn't load, drawn as a placeholder. */
  failed: number;
  /** The drawing as an element: it covers the page while "before" renders. */
  still: HTMLElement;
  /** The whole drawing, as a data URL. */
  encode(): string;
  /** The part of the drawing inside `rect`, as a data URL. */
  cut(rect: Rect): string;
};

/** What draws the page. A capture reads the page itself only through this. */
export type Rasterizer = {
  /** Where a node is drawn; null when it draws nothing. */
  measure(node: Element): Rect | null;
  /** The viewport at the current scroll, without the Toolbar or what capturing adds to the page. */
  rasterize(frame: Frame): Promise<Raster>;
};

type Store = { list: Snapshot[]; next: number; queue: Promise<unknown> };

const GLOBAL_KEY = "__loupeSnapshots";

let rasterizer: Rasterizer = screenshotRasterizer;

/**
 * Draws the page with `next` from now on, starting over as a page load does: no
 * Snapshots, numbering from 1. Tests draw fixed pixels this way; the page never
 * calls it.
 */
export function setRasterizer(next: Rasterizer): void {
  rasterizer = next;
  const host = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Store };
  host[GLOBAL_KEY] = { list: [], next: 1, queue: Promise.resolve() };
}

/** One list per page, kept on `globalThis` across a Fast Refresh; a reload clears it. */
function store(): Store {
  const host = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Store };
  host[GLOBAL_KEY] ??= { list: [], next: 1, queue: Promise.resolve() };
  return host[GLOBAL_KEY];
}

export function snapshots(): readonly Snapshot[] {
  return store().list;
}

export function removeSnapshot(id: number): void {
  const state = store();
  const kept = state.list.filter((snapshot) => snapshot.id !== id);
  if (kept.length === state.list.length) return;
  state.list = kept;
  emitChange();
}

/** The Overrides that reach an Instance, sorted and as JSON, so two readings compare as strings. */
export function overridesShown(identity: InstanceIdentity): string {
  const { overrides } = registry().store.resolve({ ...identity, current: {} });
  const sorted = Object.fromEntries(Object.keys(overrides).sort().map((key) => [key, toJson(overrides[key])]));
  return JSON.stringify(sorted);
}

/** Whether an Override one of its Instances showed has changed since: then it isn't exported. */
export function isOutdated(snapshot: Pick<Snapshot, "shown">): boolean {
  return snapshot.shown.some((entry) => overridesShown(entry.identity) !== entry.overrides);
}

/** The Snapshots an export carries, oldest first. */
export function exportableSnapshots(): SnapshotInput[] {
  return snapshots()
    .filter((snapshot) => !isOutdated(snapshot))
    .map(({ route, size, dpr, viewport, crops }) => ({ route, size, dpr, viewport, crops }));
}

/** What the kept Snapshots add to a report, in bytes. The export dialog warns past 25 MB (PER-139). */
export function snapshotBytes(): number {
  return snapshots()
    .filter((snapshot) => !isOutdated(snapshot))
    .reduce((sum, snapshot) => sum + snapshot.bytes, 0);
}

export type CaptureOptions = {
  /** Retake: replace this Snapshot, keeping its place and number. */
  replace?: number;
  /** Taken by an export: replaces the last export's Snapshot of the same route. */
  auto?: boolean;
};

/** Takes a Snapshot of the screen in view. Captures run one at a time. */
export function captureScreen(options: CaptureOptions = {}): Promise<Snapshot> {
  const state = store();
  const run = state.queue.then(() => capture(options));
  state.queue = run.catch(() => {});
  return run;
}

type Covered = { id: string; keyPath: string; after: Rect; before: Rect | null };

/** A change on screen: one record, and the Instances it reaches that are in view. */
type ChangeOnScreen = { key: string; covered: Covered[] };

async function capture(options: CaptureOptions): Promise<Snapshot> {
  if (typeof window === "undefined") throw new Error("[loupe] Capture screen runs in the browser.");
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width <= 0 || height <= 0) {
    throw new Error("[loupe] The page has no viewport to capture: is its tab hidden?");
  }
  const reg = registry();
  const debug = debugOf();
  const draw = rasterizer;
  const dpr = window.devicePixelRatio || 1;
  const frame: Frame = { width, height, dpr };
  const route = currentRoute();
  const url = location.href;
  const state = store();
  const replaced = options.replace === undefined ? undefined : state.list.find((s) => s.id === options.replace);
  if (replaced && replaced.route !== route) {
    throw new Error(`[loupe] Snapshot ${replaced.id} was taken on ${replaced.route}: open that page to retake it.`);
  }

  const mounted = [...reg.instances.values()];
  const boxes = new Map<string, Rect>();
  for (const instance of mounted) {
    const box = boxOf(draw, debug, instance.id);
    if (box && onScreen(box, width, height)) boxes.set(instance.id, box);
  }
  const changes = changesOnScreen(reg.store.records(), mounted, boxes);
  const shown = mounted
    .filter((instance) => boxes.has(instance.id))
    .map((instance) => {
      const identity = identityOf(instance);
      return { identity, overrides: overridesShown(identity) };
    });

  // A CSS transition would otherwise be caught halfway through the switch.
  const resume = stopTransitions();
  let after: Raster;
  let before: Raster;
  try {
    after = await draw.rasterize(frame);
    const unfreeze = freeze(after.still, width, height);
    try {
      flushSync(() => setView("before"));
      await settle();
      // A change can move its Instance: crop the union of where it is in both views.
      for (const change of changes) {
        for (const entry of change.covered) entry.before = boxOf(draw, debug, entry.id);
      }
      before = await draw.rasterize(frame);
    } finally {
      flushSync(() => setView("proposed"));
      await settle();
      unfreeze();
    }
  } finally {
    resume();
  }

  const viewport: ImagePair = {
    before: before.encode(),
    after: after.encode(),
    failedImages: Math.max(before.failed, after.failed),
  };
  const crops = changes.flatMap((change) =>
    cropRects(change.covered, width, height).map((crop) => {
      const pair = { before: before.cut(crop.rect), after: after.cut(crop.rect) };
      // Which crop holds a failed image isn't known: the viewport pair says it.
      return { change: change.key, keyPath: crop.keyPath, more: crop.more, ...pair, failedImages: 0 };
    }),
  );

  const previousAuto = options.auto
    ? state.list.find((snapshot) => snapshot.auto && snapshot.route === route)
    : undefined;
  const id = replaced?.id ?? previousAuto?.id ?? state.next++;
  const snapshot: Snapshot = {
    id,
    route,
    url,
    capturedAt: new Date().toISOString(),
    size: [width, height],
    dpr,
    auto: options.auto === true,
    viewport,
    crops,
    shown,
    bytes: [viewport, ...crops].reduce((sum, pair) => sum + pair.before.length + pair.after.length, 0),
  };
  state.list = state.list.some((entry) => entry.id === id)
    ? state.list.map((entry) => (entry.id === id ? snapshot : entry))
    : [...state.list, snapshot];
  emitChange();
  return snapshot;
}

/**
 * Per record with a non-State prop, the Instances on screen in its Reach: the
 * change's crop covers them.
 */
export function changesOnScreen(
  records: readonly OverrideRecord[],
  mounted: readonly Pick<MountedInstance, "id" | "anchor" | "component" | "hint" | "keyPath" | "stateProps">[],
  boxes: ReadonlyMap<string, Rect>,
): ChangeOnScreen[] {
  const changes: ChangeOnScreen[] = [];
  for (const record of records) {
    const covered: Covered[] = [];
    for (const instance of mounted) {
      const box = boxes.get(instance.id);
      if (!box || reachOf(record, identityOf(instance)) !== "applies") continue;
      const states = record.target.scope === "instance" ? instance.stateProps : [];
      if (!Object.keys(record.values).some((prop) => !states.includes(prop))) continue;
      covered.push({ id: instance.id, keyPath: instance.keyPath, after: box, before: null });
    }
    if (covered.length > 0) changes.push({ key: setOnKey(record.target), covered });
  }
  return changes;
}

type Crop = { rect: Rect; keyPath: string | null; more: number };

/**
 * One crop around every covered Instance, padded and kept to the viewport; when
 * that is taller than the viewport, one per Instance, top first, up to
 * MAX_INSTANCE_CROPS, the last saying how many more there were.
 */
export function cropRects(covered: readonly Covered[], width: number, height: number): Crop[] {
  const boxes = covered.map((entry) => ({ entry, box: entry.before ? union([entry.after, entry.before]) : entry.after }));
  const whole = union(boxes.map(({ box }) => box));
  if (whole.bottom - whole.top <= height) {
    const rect = clamp(pad(whole), width, height);
    return rect ? [{ rect, keyPath: null, more: 0 }] : [];
  }
  const sorted = [...boxes].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  const kept = sorted.slice(0, MAX_INSTANCE_CROPS);
  const more = sorted.length - kept.length;
  return kept.flatMap(({ entry, box }, index) => {
    const rect = clamp(pad(box), width, height);
    return rect ? [{ rect, keyPath: entry.keyPath || entry.id, more: index === kept.length - 1 ? more : 0 }] : [];
  });
}

function union(rects: readonly Rect[]): Rect {
  return {
    top: Math.min(...rects.map((rect) => rect.top)),
    left: Math.min(...rects.map((rect) => rect.left)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    right: Math.max(...rects.map((rect) => rect.right)),
  };
}

function pad(rect: Rect): Rect {
  return {
    top: rect.top - CROP_PADDING,
    left: rect.left - CROP_PADDING,
    bottom: rect.bottom + CROP_PADDING,
    right: rect.right + CROP_PADDING,
  };
}

/** Kept to the viewport; null when nothing is left. */
function clamp(rect: Rect, width: number, height: number): Rect | null {
  const kept = {
    top: Math.max(0, Math.floor(rect.top)),
    left: Math.max(0, Math.floor(rect.left)),
    bottom: Math.min(height, Math.ceil(rect.bottom)),
    right: Math.min(width, Math.ceil(rect.right)),
  };
  return kept.bottom > kept.top && kept.right > kept.left ? kept : null;
}

function onScreen(rect: Rect, width: number, height: number): boolean {
  return rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
}

/** The box around every node an Instance renders; null when it draws nothing. */
function boxOf(draw: Rasterizer, debug: LoupeDebug, id: string): Rect | null {
  const rects = debug.nodes(id).flatMap((node) => draw.measure(node) ?? []);
  return rects.length === 0 ? null : union(rects);
}

function debugOf(): LoupeDebug {
  return (window as typeof window & { __loupe?: LoupeDebug }).__loupe ?? createDebug();
}

/**
 * Covers the page with a still of it, above everything but the Toolbar's panel,
 * while "before" renders underneath. Returns what takes it away.
 */
function freeze(still: HTMLElement, width: number, height: number): () => void {
  const cover = document.createElement("div");
  cover.setAttribute(CAPTURE_ATTRIBUTE, "");
  cover.setAttribute("aria-hidden", "true");
  cover.style.cssText = `all: initial; position: fixed; inset: 0; z-index: 2147483645; width: ${width}px; height: ${height}px; cursor: progress;`;
  still.style.cssText = `display: block; width: ${width}px; height: ${height}px;`;
  cover.append(still);
  document.body.append(cover);
  return () => {
    cover.remove();
    still.removeAttribute("style");
  };
}

/**
 * Makes every change of style instant while capturing: a `transition-all` button
 * switched to "before" would still be fading when it is rasterized. Ending a
 * running transition early is the only effect on the page.
 */
function stopTransitions(): () => void {
  const style = document.createElement("style");
  style.setAttribute(CAPTURE_ATTRIBUTE, "");
  style.textContent = "*, *::before, *::after { transition: none !important; }";
  document.head.append(style);
  return () => style.remove();
}

/** After React's commit, the browser's layout and any frame-driven positioning (menus, popovers). */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    // A hidden tab runs no frames.
    setTimeout(finish, 150);
  });
}

/** Adds `capture`, `snapshots` and `removeSnapshot` to `window.__loupe`, the acceptance surface. */
export function exposeSnapshots(): void {
  if (typeof window === "undefined") return;
  const debug = debugOf() as LoupeDebug & {
    capture?: (options?: CaptureOptions) => Promise<Snapshot>;
    snapshots?: () => (Snapshot & { outdated: boolean })[];
    removeSnapshot?: (id: number) => void;
  };
  debug.capture ??= captureScreen;
  debug.snapshots ??= () => snapshots().map((snapshot) => ({ ...snapshot, outdated: isOutdated(snapshot) }));
  debug.removeSnapshot ??= removeSnapshot;
}
