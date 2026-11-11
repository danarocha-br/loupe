// The one Loupe release this plugin release installs. A product pins Loupe
// exactly, and its CLI writes the Product layer, so the plugin never installs
// "latest". `test/pin.test.mjs` keeps this equal to packages/loupe's version.

export const LOUPE_PACKAGE = "@danarocha/loupe";
export const LOUPE_VERSION = "0.0.2";

/** Where `loupe init` writes the Product layer and its ledger, relative to the repo root. */
export const PRODUCT_LAYER = "packages/loupe";
export const LEDGER = `${PRODUCT_LAYER}/loupe.ledger.json`;
