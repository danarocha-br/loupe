"use server";

// Feature-flag preview (PER-132): the two Server Actions behind the Toolbar's
// Feature flags card. They run on the dev server because both need the app's
// `FLAGS_SECRET`. Setting a cookie in a Server Action re-renders the page, so it
// reflects the flag. What they do is `flags-preview.ts`'s; this module only hands
// it Next's request (PER-216).
//
// Only the Toolbar imports this module, and the Toolbar reaches the page through
// `<LoupeMount />`'s development-only import, so a production build holds neither.

import {
  type FlagOverrides,
  type FlagRequest,
  type FlagsResult,
  type OverridesResult,
  readPreview,
  writePreview,
} from "./flags-preview.js";

/** `readPreview`, over the request this action runs in. */
export async function readFlags(): Promise<FlagsResult> {
  return readPreview(nextRequest());
}

/** `writePreview`, over the request this action runs in. */
export async function writeFlagOverrides(set: FlagOverrides, clear: string[] | "all"): Promise<OverridesResult> {
  return writePreview(nextRequest(), set, clear);
}

/** This request, through Next. Read lazily: with no secret, the preview never asks Next for it. */
function nextRequest(): FlagRequest {
  return {
    secret: process.env.FLAGS_SECRET,
    cookies: async () => (await import("next/headers")).cookies(),
    headers: async () => (await import("next/headers")).headers(),
    fetch: (url, init) => fetch(url, init),
  };
}
