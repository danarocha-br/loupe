// The page signal: the one place the Toolbar watches the host page, and when it reads
// it. Views never listen to the page themselves. They read the version through
// `usePageVersion` (`useSyncExternalStore`, as `picker.ts` reads the hover), and
// boxes through `boxes(id)` when `onLayout` says a box may have moved.
//
// - The version moves when the registry changes (an Instance mounts, unmounts or
//   commits, an Override changes) or the page's elements do, at most once a frame.
//   A walk of the page's fibers is good until it moves (`runtime/debug.ts`), so a
//   version costs at most one walk, however many views ask.
// - Layout ticks come on a version, any other change to the page's DOM (a text, an
//   attribute: neither changes which Instances there are, either can move a box), a
//   resize, a watched node changing size, a scroll once it has settled, and every
//   frame while the page plays an animation or a transition, which moves boxes
//   without resizing anything. A still page is never measured.
// - While a scroll runs, scroll ticks come instead, at most once a frame, with the
//   scrollers that moved: a view that follows the scroll (`highlight.tsx`) moves what
//   it drew by their offsets, and measures again on the layout tick that ends it. A
//   view that only settles (`page-map.tsx`) hears the one tick, and the page's
//   animations are looked for as the scroll starts and once it settles, not on every
//   frame of it: a script can start one as a scroll begins, with no event to say so.
// - It is dormant until a view wakes it (the open panel) and again once none holds
//   it: no observer, no listener, nothing read. Collapsed, the Toolbar costs the
//   page only what the runtime must do on each commit (`runtime/registry.ts`).

import { createContext, useEffect, useSyncExternalStore } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import { onRegistryChange, pageChanged, registry, watchPage } from "../runtime/registry.js";

export type Box = { top: number; left: number; width: number; height: number };
export type NodeBox = Box & { node: Element };

/**
 * When a scroll has settled: `endMs` after its `scrollend` with no scroll since (a
 * scroll by script, one step a frame, ends at every step), or `quietMs` after its last
 * scroll event where `scrollend` never comes. Tests shorten them.
 */
export const SCROLL_SETTLE = { endMs: 50, quietMs: 150 };

export type PageSignal = {
  /** The page's version as last published: it moves at most once a frame, only while awake. */
  version(): number;
  /** Called after the version moves. */
  subscribe(listener: () => void): () => void;
  /** Called when a box on the page may have moved, at most once a frame, only while awake; a scroll calls it once, as it settles. */
  onLayout(listener: () => void): () => void;
  /**
   * Called while the page scrolls, at most once a frame, only while awake, with the
   * scrollers that moved since: an element, or the document's `scrollingElement`.
   * `onLayout` follows once the scroll settles.
   */
  onScroll(listener: (scrollers: ReadonlySet<Element>) => void): () => void;
  /** Whether a scroll runs: from its first event until the layout tick that settles it. */
  readonly scrolling: boolean;
  /**
   * The boxes worth outlining among an Instance's nodes, largest first, measured
   * once per task however many views ask. While awake, its nodes are watched for
   * size changes from then until the version moves.
   */
  boxes(id: string): readonly NodeBox[];
  /** Starts watching the page, until the returned call. It watches while anyone holds it awake. */
  wake(): () => void;
  readonly awake: boolean;
};

export type PageSignalOptions = {
  doc: Document;
  debug: () => LoupeDebug;
  /** The Toolbar's host: what changes inside it isn't the page. */
  host?: () => Element | null;
};

/** A box with less area than this draws nothing worth outlining: a focus guard, an empty span, a zero-height div. */
const TINY_AREA = 16;
/** A box covering this much of the viewport is a backdrop or a portal's root, not the Instance. */
const BACKDROP = 0.9;

export function createPageSignal({ doc, debug, host = () => null }: PageSignalOptions): PageSignal {
  const view = doc.defaultView;
  const versionListeners = new Set<() => void>();
  const layoutListeners = new Set<() => void>();
  const scrollListeners = new Set<(scrollers: ReadonlySet<Element>) => void>();
  let published = registry().version;
  let holders = 0;
  let sleep: (() => void) | null = null;
  let versionFrame = 0;
  let layoutFrame = 0;
  let scrollFrame = 0;
  /** The scrollers that moved since the last scroll tick. */
  const scrolled = new Set<Element>();
  /** While a scroll runs, the timer that settles it, then the frame it settles in. */
  let settle: ReturnType<typeof setTimeout> | undefined;
  let settleFrame = 0;
  let scrolling = false;
  /** Whether the scroll's first tick is still to come. */
  let starting = false;

  const frame = (callback: () => void): number =>
    view?.requestAnimationFrame ? view.requestAnimationFrame(callback) : (setTimeout(callback, 16) as unknown as number);
  const cancel = (handle: number): void => {
    if (handle === 0) return;
    if (view?.cancelAnimationFrame) view.cancelAnimationFrame(handle);
    else clearTimeout(handle);
  };

  // Boxes are measured once per task: a layout tick, or a view's effect, reads them
  // for every view at once.
  let measured: Map<string, readonly NodeBox[]> | null = null;
  // Nodes whose size is watched, and those just added, whose first report is only the observer starting.
  let resize: ResizeObserver | null = null;
  const observed = new Set<Element>();
  const fresh = new Set<Element>();

  const own = (node: Node | null): boolean => {
    const toolbar = host();
    return toolbar !== null && node !== null && (toolbar === node || toolbar.contains(node) || node.getRootNode() === toolbar.shadowRoot);
  };

  const runLayout = () => {
    layoutFrame = 0;
    measured = null;
    for (const listener of [...layoutListeners]) listener();
    // A transition or an animation moves boxes with nothing resizing: every frame, until it ends.
    if (animating()) requestLayout();
  };
  const requestLayout = () => {
    if (sleep === null || layoutFrame !== 0 || layoutListeners.size === 0) return;
    layoutFrame = frame(runLayout);
  };

  /** Whether the page plays an animation or a transition now; the Toolbar's own don't count. */
  const animating = (): boolean => {
    if (typeof doc.getAnimations !== "function") return false;
    return doc.getAnimations().some((animation) => {
      if (animation.playState !== "running") return false;
      const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
      return !own(target);
    });
  };

  const publish = () => {
    versionFrame = 0;
    if (published === registry().version) return;
    published = registry().version;
    // The nodes watched were the last version's.
    resize?.disconnect();
    observed.clear();
    fresh.clear();
    if (resize) watchNode(doc.body);
    for (const listener of [...versionListeners]) listener();
    requestLayout();
  };
  const runScroll = () => {
    scrollFrame = 0;
    measured = null;
    const scrollers: ReadonlySet<Element> = new Set(scrolled);
    scrolled.clear();
    for (const listener of [...scrollListeners]) listener(scrollers);
    if (!starting) return;
    starting = false;
    // A script can start an animation as the scroll begins: then every frame is a layout tick, as on any.
    if (animating()) requestLayout();
  };
  const settled = () => {
    settle = undefined;
    settleFrame = frame(endScroll);
  };
  /** The scroll has settled, unless another started since its timer ran: one layout tick, in this frame. */
  const endScroll = () => {
    settleFrame = 0;
    scrolling = starting = false;
    scrolled.clear();
    if (layoutListeners.size === 0) return;
    cancel(layoutFrame);
    runLayout();
  };
  /** A scroll of the page: a tick for those that follow it, and its end held off until it settles. */
  const onScrollEvent = (event: Event) => {
    // The document's scroll comes from the document or the window.
    const target = event.target as Node | null;
    const scroller = target?.nodeType === 1 ? (target as Element) : (doc.scrollingElement ?? doc.documentElement);
    if (own(scroller)) return;
    cancel(settleFrame);
    settleFrame = 0;
    if (!scrolling) scrolling = starting = true;
    clearTimeout(settle);
    settle = setTimeout(settled, SCROLL_SETTLE.quietMs);
    if (scrollListeners.size === 0) return;
    scrolled.add(scroller);
    if (scrollFrame === 0) scrollFrame = frame(runScroll);
  };
  const onScrollEnd = () => {
    if (settle === undefined) return;
    clearTimeout(settle);
    settle = setTimeout(settled, SCROLL_SETTLE.endMs);
  };

  const requestVersion = () => {
    if (sleep === null || versionFrame !== 0) return;
    versionFrame = frame(publish);
  };

  const watchNode = (node: Element | null) => {
    if (!resize || !node || observed.has(node)) return;
    observed.add(node);
    fresh.add(node);
    resize.observe(node);
  };

  /**
   * Whether a change to the DOM can change which Instances are on the page: an
   * element came or went. A text or an attribute change can't (an animated counter,
   * a clock, a class toggled), though it can move a box.
   */
  const structural = (mutation: MutationRecord): boolean => {
    for (const node of mutation.addedNodes) if (node.nodeType === 1) return true;
    for (const node of mutation.removedNodes) if (node.nodeType === 1) return true;
    return false;
  };

  const start = (): (() => void) => {
    const unwatch = watchPage();
    const stopRegistry = onRegistryChange(requestVersion);
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            const page = records.filter((record) => !own(record.target));
            if (page.length === 0) return;
            if (page.some(structural)) {
              pageChanged();
              requestVersion();
            } else requestLayout();
          });
    if (doc.body) mutations?.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true });
    resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            let moved = false;
            for (const entry of entries) {
              if (fresh.delete(entry.target)) continue;
              moved = true;
            }
            if (moved) requestLayout();
          });
    watchNode(doc.body);
    const onEvent = (event: Event) => {
      if (event.type === "transitionrun" || event.type === "animationstart") {
        if (own(event.composedPath()[0] as Node | null)) return;
      }
      requestLayout();
    };
    const events = ["resize", "transitionrun", "animationstart"] as const;
    for (const type of events) view?.addEventListener(type, onEvent, { capture: true, passive: true });
    view?.addEventListener("scroll", onScrollEvent, { capture: true, passive: true });
    view?.addEventListener("scrollend", onScrollEnd, { capture: true, passive: true });
    return () => {
      unwatch();
      stopRegistry();
      mutations?.disconnect();
      resize?.disconnect();
      resize = null;
      observed.clear();
      fresh.clear();
      for (const type of events) view?.removeEventListener(type, onEvent, { capture: true });
      view?.removeEventListener("scroll", onScrollEvent, { capture: true });
      view?.removeEventListener("scrollend", onScrollEnd, { capture: true });
      clearTimeout(settle);
      settle = undefined;
      cancel(settleFrame);
      settleFrame = 0;
      scrolling = starting = false;
      scrolled.clear();
      cancel(versionFrame);
      cancel(layoutFrame);
      cancel(scrollFrame);
      versionFrame = layoutFrame = scrollFrame = 0;
    };
  };

  const signal: PageSignal = {
    version: () => published,
    subscribe(listener) {
      versionListeners.add(listener);
      return () => {
        versionListeners.delete(listener);
      };
    },
    onLayout(listener) {
      layoutListeners.add(listener);
      return () => {
        layoutListeners.delete(listener);
      };
    },
    onScroll(listener) {
      scrollListeners.add(listener);
      return () => {
        scrollListeners.delete(listener);
      };
    },
    boxes(id) {
      if (measured === null) {
        const fill = new Map<string, readonly NodeBox[]>();
        measured = fill;
        queueMicrotask(() => {
          if (measured === fill) measured = null;
        });
      }
      const known = measured.get(id);
      if (known) return known;
      let nodes: Element[];
      try {
        nodes = debug().nodes(id);
      } catch {
        nodes = [];
      }
      for (const node of nodes) watchNode(node);
      const found = boxesOf(nodes, view);
      measured.set(id, found);
      return found;
    },
    wake() {
      holders++;
      if (holders === 1) {
        sleep = start();
        // Whatever changed while it slept.
        if (published !== registry().version) requestVersion();
      }
      let holding = true;
      return () => {
        if (!holding) return;
        holding = false;
        holders--;
        if (holders > 0 || sleep === null) return;
        const stop = sleep;
        sleep = null;
        stop();
      };
    },
    get awake() {
      return sleep !== null;
    },
    get scrolling() {
      return scrolling;
    },
  };
  return signal;
}

/** The boxes worth outlining among nodes, largest first. */
export function boxesOf(nodes: readonly Element[], view: (Window & typeof globalThis) | null = typeof window === "undefined" ? null : window): NodeBox[] {
  const viewport = view ? view.innerWidth * view.innerHeight : 0;
  return nodes
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width * rect.height >= TINY_AREA && (viewport === 0 || rect.width * rect.height < viewport * BACKDROP))
    .map(({ node, rect: { top, left, width, height } }) => ({ node, top, left, width, height }))
    .sort((a, b) => b.width * b.height - a.width * a.height);
}

/**
 * Whether the Instance shows at its box's centre: an open menu or dialog of the
 * app's, or the panel, can cover it, and an outline drawn over the cover would
 * mark the wrong thing. A transparent layer, such as a menu's click-away
 * backdrop, covers nothing. Where nothing can be hit-tested (a test's DOM), it shows.
 */
export function inView(box: NodeBox, hostAttribute: string): boolean {
  const doc = box.node.ownerDocument;
  if (typeof doc.elementsFromPoint !== "function") return true;
  for (const hit of doc.elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)) {
    if (box.node.contains(hit) || hit.contains(box.node)) return true;
    if (hit.hasAttribute(hostAttribute) || covers(hit)) return false;
  }
  return true;
}

/** Whether an element paints over what is under it: a background, or an image or video. */
function covers(element: Element): boolean {
  if (element.localName === "img" || element.localName === "video" || element.localName === "canvas") return true;
  const color = getComputedStyle(element).backgroundColor;
  return color !== "" && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color);
}

/** Holds the signal awake while the calling component is mounted, and returns its version. */
export function usePageVersion(signal: PageSignal): number {
  useEffect(() => signal.wake(), [signal]);
  return useSyncExternalStore(signal.subscribe, signal.version, signal.version);
}

/** The open panel's signal, for views deep in it (`page-map.tsx`); null outside one. */
export const PageSignalContext = createContext<PageSignal | null>(null);

