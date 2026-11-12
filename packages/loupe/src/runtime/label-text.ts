// Label text (PER-113): `children` written as one plain literal at the call site.
// It is one line, and it is changed per Instance or per call site: a page-wide
// text would rename every Button on the page at once, which is no source edit.

import type { Scope } from "./store.js";

export const TEXT_SCOPE_REASON = "Change it per call site.";

/** Why `prop` can't be overridden at `scope` as label text, or null when it can. */
export function textScopeRefusal(scope: Scope, prop: string): string | null {
  return scope === "page" && prop === "children" ? TEXT_SCOPE_REASON : null;
}

/** Label text is one line: a line break, typed or pasted, becomes a space. */
export function singleLine(text: string): string {
  return text.replace(/\r\n|\r|\n/g, " ");
}
