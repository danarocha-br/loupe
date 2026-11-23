/**
 * The app's language, for its own words inside Loupe's English (the host says `lang="en"`):
 * an Instance's visible name is read in the app's voice. Undefined when the app sets none.
 */
export const appLang = () => (typeof document === "undefined" ? undefined : document.documentElement.lang || undefined);
