// The one Loupe release this plugin release installs, never "latest": the CLI
// that writes the Product layer must match the runtime that reads it.
// `test/plugin.test.mjs` keeps these equal to the CLI's own constants.

export const LOUPE_PACKAGE = "@danarocha/loupe";
export const LOUPE_VERSION = "0.0.2";

/** Where `loupe init` writes the Product layer and its ledger, relative to the repo root. */
export const PRODUCT_LAYER = "packages/loupe";
export const PRODUCT_LAYER_PACKAGE = "@repo/loupe";
export const LEDGER = `${PRODUCT_LAYER}/loupe.ledger.json`;
