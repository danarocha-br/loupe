// The words for an Instance's card-level note (PER-214). The runtime's `inspect()`
// says which note applies; its title and sentence are the Toolbar's. They live here
// until PER-214's panel view module takes every word the panel shows.

import type { NoteKind } from "../runtime/inspect.js";
import type { Status } from "../runtime/store.js";

/** ` (reason)` after the React self-check's sentence, or nothing when it gave none. */
function inParentheses(reason: string | undefined): string {
  return reason ? ` (${reason})` : "";
}

/** Each card-level note: a title that names its kind, and its sentence. Only `overrides-off` reads the status. */
export const NOTES: Record<NoteKind, { title: string; text(status: Status): string }> = {
  server: {
    title: "On the server",
    text: () => "Rendered on the server: it can't be previewed in the MVP.",
  },
  // The panel's banner says this instead (PER-184), so it reaches a card only while
  // the page and the inspection disagree about the status, for a frame.
  "overrides-off": {
    title: "Overrides are off",
    text: (status) =>
      `Overrides are off, everything is inspect-only: this React build isn't supported${inParentheses(status.overrides ? undefined : status.reason)}.`,
  },
  unadapted: {
    title: "Inspect only · No Adapter",
    text: () =>
      "No Adapter renders this Instance, so it is inspect-only: `loupe generate` writes Adapters only for components with a prop that can be Editable, and imports inside the design system are never swapped for one.",
  },
  spreads: {
    title: "Props spread here",
    text: () => "This call site spreads props, so library props can't be separated from the app's here.",
  },
  "no-meta": {
    title: "No prop metadata",
    text: () => "No prop metadata for this component: run `loupe generate` to see which props are editable.",
  },
};

/** The Overrides-off banner's sentence, under its "Overrides are off" title. */
export function overridesOffBanner(reason: string): string {
  return `Everything is inspect-only: this React build isn't supported${inParentheses(reason)}.`;
}
