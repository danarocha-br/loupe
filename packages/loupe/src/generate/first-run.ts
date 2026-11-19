// The flags `generate` can't read from `adapt-list.json` the first time, or once
// that file is gone (PER-227): the CLI's refusal names them, and so does the
// command that writes a missing one again, in the Toolbar, `withLoupe` and
// `loupe doctor`. One spelling for both.
// Imports nothing, so the browser can import it through `format-notice.ts`.

/** The design-system and app roots `generate` reads from `adapt-list.json` once it exists. */
export const ROOT_FLAGS = "--design-system <dir> --app <dir>";

/** The Product layer's import specifier, which `generate` reads from the layer's package.json `name`. */
export const SPECIFIER_FLAG = "--specifier <name>";
