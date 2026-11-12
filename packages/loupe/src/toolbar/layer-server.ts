"use server";

// The Product layer's status for the Toolbar's notices (PER-133). The browser
// can't hash files, so this Server Action does it on the dev server. `withLoupe`
// hands over the paths it already resolved, under `next dev` only.
//
// Only the Toolbar imports this module, and the Toolbar reaches the page through
// `<LoupeMount />`'s development-only import, so a production build holds neither.

import { type LayerStatus, readLayerStatus } from "../layer-status.js";

/** A string only this module holds: `loupe doctor --build` looks for it to prove the action stayed out. */
const MARKER = "loupe-layer-status";

/** Null when `withLoupe` isn't active, so there is no Product layer to read. */
export async function readProductLayerStatus(): Promise<LayerStatus | null> {
  const root = process.env.LOUPE_ROOT;
  const adaptList = process.env.LOUPE_ADAPT_LIST;
  const app = process.env.LOUPE_APP;
  if (!root || !adaptList || !app) return null;
  try {
    return readLayerStatus({ root, adaptList, app });
  } catch (error) {
    console.warn(`[loupe] ${MARKER}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
