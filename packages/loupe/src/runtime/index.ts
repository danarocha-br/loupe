// `@danarocha/loupe/runtime`: what a generated (or, in Stage 1, hand-written)
// Adapter module imports. Development only: the loader that swaps Adapters in
// never runs outside `next dev`, so nothing here reaches a production build.

import { debugOf } from "./debug.js";

export { type AdapterOptions, createAdapter } from "./adapter.js";
export type { Authorship } from "./authored.js";
export type { StateProp } from "./state.js";
export { STATE_SCOPE_REASON, stateScopeRefusal } from "./state.js";
export { TEXT_SCOPE_REASON, textScopeRefusal } from "./label-text.js";
export type { InstanceProps, InstanceRow, LoupeDebug, RecordRow, ServerInstance } from "./debug.js";
export type { LastSeen } from "./registry.js";
export type {
  InstanceIdentity,
  OverrideRecord,
  Props,
  Resolved,
  Scope,
  ScopeTarget,
  Source,
  Status,
  Suspension,
} from "./store.js";

// `window.__loupe` from the first Adapter on, so the console reaches the page
// before the Toolbar loads. Not under `LOUPE=0 next dev` (`withLoupe` sets
// LOUPE_SWITCH "off"), where an Adapter imported directly, not through the
// loader, renders its component as it is (`createAdapter`).
if (typeof window !== "undefined" && process.env.LOUPE_SWITCH !== "off") debugOf();
