// The Feature flags card's words and rows (PER-132, PER-216): what the flags store holds,
// as the card draws it. Feature flags are the MVP's only rule preview (PER-92). The
// card writes nothing: previewing and clearing are the store's, asked from the view.

import type { FlagOption } from "../flags-preview.js";
import { PREVIEW_HOURS } from "../flags-lifetime.js";
import { type FlagsView, sameFlagValue } from "../flags-store.js";
import { formatCurrent } from "../format.js";
import type { FlagRowView, FlagsCardView } from "./types.js";

/** A flag with no declared options is offered as on and off. */
const ON_OFF: FlagOption[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

/** The one fix the reader makes in a file, said with the file it goes in. */
const NO_SECRET = "FLAGS_SECRET isn't set";

/** The card for what the store holds now: reading, off and why, or the flags and their previews. */
export function flagsCard(view: FlagsView): FlagsCardView {
  const card: FlagsCardView = {
    title: "Feature flags",
    meta: null,
    loading: null,
    off: null,
    empty: null,
    rows: [],
    error: null,
    lasts: null,
    clearAll: null,
  };
  if (view.status === "loading") return { ...card, loading: "Reading the app’s flags…" };
  if (view.status === "unavailable") {
    return {
      ...card,
      meta: "Unavailable",
      off: {
        title: "Flag previews are off",
        why: " · why",
        reason: view.reason,
        fix: view.reason.startsWith(NO_SECRET) ? { text: "FLAGS_SECRET=… in .env.local", copy: "FLAGS_SECRET=" } : null,
      },
    };
  }
  const { definitions, overrides } = view;
  const previewing = Object.keys(overrides);
  // Overrides the cookie holds for flags the app doesn't declare: shown so they can be cleared.
  const undeclared = previewing.filter((key) => !definitions.some((definition) => definition.key === key));
  return {
    ...card,
    meta: `${definitions.length} declared · ${previewing.length} previewing`,
    empty: definitions.length === 0 ? "The app declares no flags." : null,
    rows: [
      ...definitions.map((definition) =>
        flagRow(definition.key, overrides, {
          description: definition.description ?? null,
          options: definition.options ?? ON_OFF,
          note: definition.options ? null : "No options declared: offered as on and off.",
        }),
      ),
      ...undeclared.map((key) => flagRow(key, overrides, { description: "Not declared by the app’s discovery endpoint.", options: [], note: null })),
    ],
    error: view.error,
    lasts: `A preview lasts ${PREVIEW_HOURS} hours, in a cookie every app on localhost shares. Clear it before switching projects.`,
    clearAll: { label: "Clear flag previews", enabled: previewing.length > 0 },
  };
}

function flagRow(
  key: string,
  overrides: Record<string, unknown>,
  { description, options, note }: { description: string | null; options: FlagOption[]; note: string | null },
): FlagRowView {
  const previewing = Object.hasOwn(overrides, key);
  const value = overrides[key];
  const checked = previewing ? options.findIndex((option) => sameFlagValue(option.value, value)) : -1;
  const shown = options[checked];
  return {
    key,
    previewing,
    description,
    note,
    options: options.map((option) => ({ label: option.label ?? formatCurrent(option.value), value: option.value })),
    checked,
    state: previewing ? `Previewing ${shown?.label ?? formatCurrent(value)}` : "App decides",
    clear: previewing ? "Clear" : null,
  };
}
