// What the Toolbar starts when it mounts (PER-218), kept small, since the collapsed
// pill loads it (2026-11-23): the Toolbar's methods on `window.__loupe`, the
// acceptance surface, next to the runtime's (`debug.ts`):
//
//   __loupe.proposal(options?)      the Proposal JSON (`proposal.ts`)
//   __loupe.proposalText(options?)  its Copy Proposal text, not copied (`text.ts`)
//
// Both load the open panel's module (`open.tsx`) to answer, as the panel does. What
// the Proposal reads from the page as it goes, the tracker (`tracker.ts`) and the
// change numbering (`numbers.ts`), is light and stays here: it starts on the panel's
// first open, or as soon as the store holds a record, in the same task as the change
// that made it. A record set through `__loupe` with the panel closed is then known on
// its route, with the Instance it was set on, and in the order it was made, however
// soon that Instance unmounts and whether or not the panel's module has loaded.
//
// Starting again changes nothing: the trackers are one per page, and the methods
// load the same module. `resetLoupe()` takes both away, and the next mount starts
// them again. The methods are assigned each time, not kept, so the latest code
// answers once it has run.

import { debugOf } from "../runtime/debug.js";
import { registry } from "../runtime/registry.js";
import { pageNumbering } from "./numbers.js";
import type { ProposalOptions } from "./proposal.js";
import { startTracking } from "./tracker.js";

/**
 * Starts what the Proposal reads from the page: the tracker and the change numbering.
 * Once per page: starting again changes nothing, and `resetLoupe()` stops both.
 */
export function startTrackers(): void {
  // From the first change on, not from the first copy: a record set on another route,
  // or an Instance that has since unmounted, is only known if seen.
  startTracking();
  // So changes number in the order they are made, even several made at once.
  pageNumbering();
}

type PanelModule = typeof import("./open.js");

let loading: Promise<PanelModule> | null = null;
let loaded: PanelModule | null = null;

/** The open panel's module: loaded once, on the first call; every call after gets the same. */
export function loadPanel(): Promise<PanelModule> {
  loading ??= import("./open.js").then(
    (panel) => (loaded = panel),
    (error: unknown) => {
      // A failed load (the dev server restarting) is tried again on the next call.
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** The open panel's module if it has loaded, so the panel can render without waiting. */
export function loadedPanel(): PanelModule | null {
  return loaded;
}

/** Loads the panel's module when the page has nothing better to do, so a first open doesn't wait for it. */
export function preloadPanelWhenIdle(): () => void {
  const preload = () => void loadPanel().catch(() => {});
  const idle = globalThis as { requestIdleCallback?(run: () => void, options: { timeout: number }): number; cancelIdleCallback?(id: number): void };
  if (typeof idle.requestIdleCallback === "function") {
    const id = idle.requestIdleCallback(preload, { timeout: 4000 });
    return () => idle.cancelIdleCallback?.(id);
  }
  const timer = setTimeout(preload, 2000);
  return () => clearTimeout(timer);
}

export function startToolbar(): () => void {
  Object.assign(debugOf(), {
    proposal: (options?: ProposalOptions) => loadPanel().then((panel) => panel.collectProposal(options)),
    proposalText: (options?: ProposalOptions) => loadPanel().then((panel) => panel.collectProposalText(options)),
  });
  const { store } = registry();
  if (store.records().length > 0) {
    startTrackers();
    return () => {};
  }
  let watching = true;
  const unsubscribe = store.subscribe(() => {
    if (!watching) return;
    watching = false;
    unsubscribe();
    // In the store's own notice of the first change: the tracker and the numbering take
    // it as made now, on this route, and see every change after it as it is made.
    startTrackers();
  });
  return () => {
    watching = false;
    unsubscribe();
  };
}
