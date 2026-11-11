// `@danarocha/loupe/runtime`: what a generated (or, in Stage 1, hand-written)
// Adapter module imports. Development only: the loader that swaps Adapters in
// never runs outside `next dev`, so nothing here reaches a production build.

import { installDebug } from "./debug.js";

export { createAdapter } from "./adapter.js";
export type { InstanceProps, InstanceRow, LoupeDebug, ServerInstance } from "./debug.js";
export type { Status } from "./registry.js";
export type { Props, Resolved, Source } from "./store.js";

installDebug();
