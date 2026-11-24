// The toolbar's store (ADR 0009): what the open panel's views share, one store per
// Toolbar. The selection and its tool, Hide marks, the Instances a row names and the
// component a row or the page map points at. Each was state in one component, threaded
// as props and callbacks through `ToolbarOpen` and `Panel` to the views that read it,
// and a change re-rendered everything in between. A view reads the slice it draws
// (`useToolbar`), so a row's hover renders the rows whose light changes and the
// outlines, not the list.
//
// Built as `undo.ts`, `picker.ts`'s hover and the page signal are: `useSyncExternalStore`
// on a plain object. It is created in `ToolbarBody` and lives as long as the Toolbar, so
// a selection survives closing and reopening the panel. The shell's open and close, the
// peek, the pill's drag and the page's boxes stay in the components that own them.
//
// Patterns read no store (DESIGN.md, Layers): a view reads it and passes props down, and
// its writes, whose identities never change, as the patterns' callbacks.

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Scope } from "../runtime/store.js";
import type { SelectMode } from "./picker.js";

export type ToolbarState = {
  /** The Instance the panel inspects, or null for the list. */
  selected: string | null;
  /** The header's select tool (2026-11-20): one Instance, or every one from its call site, as Figma selects. Kept across selections for the page load. */
  mode: SelectMode;
  /** Select multiple, widened to every Instance of the component on the page. A new selection starts at its call site again. */
  widened: boolean;
  /** Hide marks (2026-11-20): the selection's outlines and the revision clouds are off the page. Kept for the page load. */
  marksHidden: boolean;
  /** The Instances a row of the panel names, while the pointer or focus is on it. */
  hovered: readonly string[];
  /** The component a row or a block of the page map points at: both light it. */
  lit: string | null;
};

export type ToolbarStore = {
  get(): ToolbarState;
  subscribe(listener: () => void): () => void;
  /** Inspect an Instance, or go back to the list (null); a select tool may come with it. */
  select(id: string | null, mode?: SelectMode): void;
  /** The scope the select tool and the widen link choose. */
  setScope(scope: Scope): void;
  toggleMarks(): void;
  /** Outline these Instances; the same ids again change nothing, as the pointer crosses a row's children. */
  hover(ids: readonly string[]): void;
  /** A row or a block pointed at, or left (null): it lights, and its Instances are outlined. */
  point(group: { component: string; outlineIds: readonly string[] } | null): void;
  /** Light a component, or none, and outline nothing new: the list going clears its light. */
  light(component: string | null): void;
};

const INITIAL: ToolbarState = { selected: null, mode: "one", widened: false, marksHidden: false, hovered: [], lit: null };

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** The scope a selection is inspected at, from the select tool and the widen link. */
export function scopeOf(state: Pick<ToolbarState, "mode" | "widened">): Scope {
  return state.mode === "one" ? "instance" : state.widened ? "page" : "group";
}

export function createToolbarStore(initial: Partial<ToolbarState> = {}): ToolbarStore {
  let state: ToolbarState = { ...INITIAL, ...initial };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<ToolbarState>) => {
    const next = { ...state, ...patch };
    if ((Object.keys(patch) as (keyof ToolbarState)[]).every((key) => Object.is(next[key], state[key]))) return;
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select: (id, mode) => set({ selected: id, widened: false, ...(mode ? { mode } : {}) }),
    setScope: (scope) => set({ mode: scope === "instance" ? "one" : "many", widened: scope === "page" }),
    toggleMarks: () => set({ marksHidden: !state.marksHidden }),
    hover: (ids) => {
      if (!sameIds(state.hovered, ids)) set({ hovered: ids });
    },
    point: (group) => {
      const ids = group ? group.outlineIds : [];
      set({ lit: group?.component ?? null, ...(sameIds(state.hovered, ids) ? {} : { hovered: ids }) });
    },
    light: (component) => set({ lit: component }),
  };
}

/** The Toolbar's store, for the views in it; null outside a Toolbar. */
export const ToolbarStoreContext = createContext<ToolbarStore | null>(null);

/** The store, for its writes. */
export function useToolbarStore(): ToolbarStore {
  const store = useContext(ToolbarStoreContext);
  if (!store) throw new Error("[loupe] A toolbar view rendered outside its Toolbar's store.");
  return store;
}

/**
 * One slice of the store: the component renders again only when the slice changes
 * (`Object.is`). The selector returns a value from the state, or a primitive made of it,
 * never a new object or array.
 */
export function useToolbar<T>(selector: (state: ToolbarState) => T): T {
  const store = useToolbarStore();
  const read = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
