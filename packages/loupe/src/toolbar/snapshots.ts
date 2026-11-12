// Snapshots (PER-138, per PER-99 §2–3): a before/after pair of the screen in view,
// kept for the Proposal. Each capture rasterizes the viewport twice in the page
// itself with `modern-screenshot` (no separate browser, no permission prompt), once
// as it is and once in the "before" view: every Override off except State-prop
// ones, so an open dialog stays open. A crop pair per change on screen is cut from
// the two viewport images, so before and after always line up.
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
import { type InstanceIdentity, type OverrideRecord, reaches } from "../runtime/store.js";
import { HOST_ATTRIBUTE } from "./styles.js";

/** Marks the still that covers the page while "before" renders; never captured. */
export const CAPTURE_ATTRIBUTE = "data-loupe-capture";

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

type Store = { list: Snapshot[]; next: number; queue: Promise<unknown> };

const GLOBAL_KEY = "__loupeSnapshots";

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

type Rect = { top: number; left: number; bottom: number; right: number };

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
  const dpr = window.devicePixelRatio || 1;
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
    const box = boxOf(debug, instance.id);
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
    after = await rasterize(width, height, dpr);
    const unfreeze = freeze(after.canvas, width, height);
    try {
      flushSync(() => setView("before"));
      await settle();
      // A change can move its Instance: crop the union of where it is in both views.
      for (const change of changes) {
        for (const entry of change.covered) entry.before = boxOf(debug, entry.id);
      }
      before = await rasterize(width, height, dpr);
    } finally {
      flushSync(() => setView("proposed"));
      await settle();
      unfreeze();
    }
  } finally {
    resume();
  }

  const viewport: ImagePair = {
    before: encode(before.canvas),
    after: encode(after.canvas),
    failedImages: Math.max(before.failed, after.failed),
  };
  const crops = changes.flatMap((change) =>
    cropRects(change.covered, width, height).map((crop) => {
      const pair = { before: cut(before.canvas, crop.rect, dpr), after: cut(after.canvas, crop.rect, dpr) };
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
 * Per live record with a non-State prop, the Instances on screen it reaches and
 * doesn't leave out: the change's crop covers them.
 */
export function changesOnScreen(
  records: readonly OverrideRecord[],
  mounted: readonly Pick<MountedInstance, "id" | "anchor" | "component" | "hint" | "keyPath" | "stateProps">[],
  boxes: ReadonlyMap<string, Rect>,
): ChangeOnScreen[] {
  const changes: ChangeOnScreen[] = [];
  for (const record of records) {
    if (record.suspended) continue;
    const covered: Covered[] = [];
    for (const instance of mounted) {
      const box = boxes.get(instance.id);
      if (!box || record.excluded.includes(instance.id)) continue;
      if (!reaches(record.target, identityOf(instance))) continue;
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
function boxOf(debug: LoupeDebug, id: string): Rect | null {
  const rects = debug
    .nodes(id)
    .map((node) => node.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);
  return rects.length === 0 ? null : union(rects);
}

function debugOf(): LoupeDebug {
  return (window as typeof window & { __loupe?: LoupeDebug }).__loupe ?? createDebug();
}

type Raster = { canvas: HTMLCanvasElement; failed: number };

const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="100%" height="100%" fill="#f1f3f3" stroke="#999" stroke-dasharray="4"/><text x="50%" y="55%" font-family="system-ui,sans-serif" font-size="11" fill="#555" text-anchor="middle">Image not captured</text></svg>',
)}`;

/** The viewport at the current scroll, without the Toolbar, at device pixel ratio. */
async function rasterize(width: number, height: number, dpr: number): Promise<Raster> {
  const { domToCanvas } = await import("modern-screenshot");
  let failed = 0;
  const root = document.documentElement;
  const canvas = await domToCanvas(root, {
    width,
    height,
    scale: dpr,
    backgroundColor: pageBackground(),
    // The window's scroll: the root grows by it and moves up and left by it, so
    // the image starts where the viewport does. Fixed elements stay put.
    style: {
      width: `${width + window.scrollX}px`,
      height: `${height + window.scrollY}px`,
      marginTop: `${-window.scrollY}px`,
      marginLeft: `${-window.scrollX}px`,
      overflow: "hidden",
    },
    filter: (node) =>
      !(node instanceof Element) ||
      !(node.hasAttribute(HOST_ATTRIBUTE) || node.hasAttribute(CAPTURE_ATTRIBUTE) || node.localName === "nextjs-portal"),
    fetch: {
      placeholderImage: () => {
        failed++;
        return PLACEHOLDER;
      },
    },
  });
  return { canvas, failed };
}

/** What shows behind a transparent page: the body's background, else the root's, else white. */
function pageBackground(): string {
  for (const element of [document.body, document.documentElement]) {
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
  }
  return "#fff";
}

/**
 * Covers the page with a still of it, above everything but the Toolbar's panel,
 * while "before" renders underneath. Returns what takes it away.
 */
function freeze(still: HTMLCanvasElement, width: number, height: number): () => void {
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

function cut(source: HTMLCanvasElement, rect: Rect, dpr: number): string {
  const canvas = document.createElement("canvas");
  const x = Math.round(rect.left * dpr);
  const y = Math.round(rect.top * dpr);
  canvas.width = Math.max(1, Math.round((rect.right - rect.left) * dpr));
  canvas.height = Math.max(1, Math.round((rect.bottom - rect.top) * dpr));
  canvas.getContext("2d")?.drawImage(source, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return encode(canvas);
}

/** WebP at 0.9, or PNG where the browser can't encode WebP. */
function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
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
