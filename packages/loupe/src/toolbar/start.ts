// What the Toolbar starts when it mounts (PER-218), kept small, since the collapsed
// pill loads it (2026-11-23): the Toolbar's methods on `window.__loupe`, the
// acceptance surface, next to the runtime's (`debug.ts`):
//
//   __loupe.proposal(options?)      the Proposal JSON (`proposal.ts`)
//   __loupe.proposalText(options?)  its Copy Proposal text, not copied (`text.ts`)
//
// Both load the open panel's module (`open.tsx`) to answer, as the panel does. The
// trackers the Proposal reads start on the panel's first open (`startTrackers()`),
// or here, as soon as the store holds a record: one set through `__loupe` with the
// panel closed is then known on the route it was set on, as if it were open.
//
// Starting again changes nothing: the trackers are one per page, and the methods
// load the same module. `resetLoupe()` takes both away, and the next mount starts
// them again. The methods are assigned each time, not kept, so the latest code
// answers once it has run.

import { debugOf } from "../runtime/debug.js";
import { currentRoute, registry } from "../runtime/registry.js";
import type { ScopeTarget } from "../runtime/store.js";
import type { ProposalOptions } from "./proposal.js";

type PanelModule = typeof import("./open.js");

/** The change that started the trackers, and the route it was made on. */
export type FirstChange = { target: ScopeTarget; route: string };

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
  const startTrackers = (first?: FirstChange) => void loadPanel().then((panel) => panel.startTrackers(first), () => {});
  if (store.records().length > 0) {
    startTrackers();
    return () => {};
  }
  // From the first change, not from the first copy: a record set on another route,
  // or an Instance that has since unmounted, is only known if seen.
  let watching = true;
  const unsubscribe = store.subscribe((target) => {
    if (!watching) return;
    watching = false;
    unsubscribe();
    // The trackers load after this change: it keeps the route it was made on.
    startTrackers(target.scope === "page" ? undefined : { target, route: currentRoute() });
  });
  return () => {
    watching = false;
    unsubscribe();
  };
}
