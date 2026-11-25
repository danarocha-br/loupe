// The Toolbar's host: the attribute that marks it, and where the reader's theme is kept.
// The stylesheet's `tokens` layer, the ground every layer stands on, is the design
// system's (`@loupe/ui/surface`, ADR 0010); every view's look lives in a pattern or a
// primitive (ADR 0003; patterns waves 1 to 5).

export const HOST_ATTRIBUTE = "data-loupe-toolbar";

/** Where the reader's choice of light or dark is kept; absent, the OS preference decides. */
export const THEME_KEY = "loupe:theme";
