// `@danarocha/loupe/runtime`: what a generated (or, in Stage 1, hand-written)
// Adapter module imports. Development only: the loader that swaps Adapters in
// never runs outside `next dev`, so nothing here reaches a production build.

import { installDebug } from "./debug.js";

export { type AdapterOptions, createAdapter } from "./adapter.js";
export type { Authorship } from "./authored.js";
export type { StateProp } from "./state.js";
export { STATE_SCOPE_REASON, stateScopeRefusal } from "./state.js";
export type { InstanceProps, InstanceRow, LoupeDebug, ServerInstance } from "./debug.js";
export type { Status } from "./registry.js";
export type { InstanceIdentity, OverrideRecord, Props, Resolved, Scope, ScopeTarget, Source } from "./store.js";

installDebug();
