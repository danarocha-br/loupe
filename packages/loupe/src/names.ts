// The names Loupe installs under (PER-220): the Product layer's package and
// directory, Loupe's own npm package, and the ledger's path. The commands and
// the dev server read them here. The installer plugin ships without this
// package, so it keeps its own copy in `plugins/loupe/scripts/pin.mjs`, and
// `plugins/loupe/test/plugin.test.mjs` imports this file to keep the two equal.
//
// So it imports nothing, which keeps the dev server from loading anything else
// with it, and it uses only syntax Node can strip (no enums, namespaces or
// parameter properties), so Node can run it as it is.

export const PRODUCT_LAYER = { name: "@repo/loupe", path: "packages/loupe" } as const;
export const NPM_PACKAGE = "@danarocha/loupe";

/** Repo-relative, POSIX. `init/ledger.ts` re-exports it with the rest of the ledger's interface. */
export const LEDGER_PATH = `${PRODUCT_LAYER.path}/loupe.ledger.json`;
