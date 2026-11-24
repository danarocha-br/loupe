// Feature-flag preview (PER-132): the record of previewed flags that the Feature
// flags card shows and the Proposal builder reads. Feature flags are the MVP's only
// rule preview (PER-92). The overrides live in the app's own override cookie, so a
// preview survives a reload, and the record is read back from it.
//
// The store reads and writes through a FlagSource (PER-216): the two Server Actions
// on the page, the preview core over an in-memory request in tests
// (`flags.fixture.ts`). No React here: the card is `flags.tsx`.

import type { FlagDefinition, FlagOverrides, FlagsResult, FlagValue, OverridesResult } from "./flags-preview.js";
import { readFlags, writeFlagOverrides } from "./flags-server.js";
import { sameFlagValue } from "./flags-value.js";
import { warnOnce } from "./warn-once.js";

export type FlagsView =
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; definitions: FlagDefinition[]; overrides: FlagOverrides; error: string | null };

/** A flag the page is being previewed with, for the Proposal. */
export type PreviewedFlag = { key: string; value: FlagValue; label?: string; description?: string };

/** Where previews are read from and written to. */
export type FlagSource = {
  read(): Promise<FlagsResult>;
  write(set: FlagOverrides, clear: string[] | "all"): Promise<OverridesResult>;
};

let source: FlagSource = { read: readFlags, write: writeFlagOverrides };
let view: FlagsView = { status: "loading" };
const listeners = new Set<() => void>();

function publish(next: FlagsView): void {
  view = next;
  for (const listener of listeners) listener();
}

/**
 * Reads and writes previews through `next` from now on, starting over as a page
 * load does. Tests point the store at an in-memory request this way; the page
 * never calls it.
 */
export function setFlagSource(next: FlagSource): void {
  source = next;
  publish({ status: "loading" });
}

export function flagsView(): FlagsView {
  return view;
}

export function onFlagsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The Proposal's record: every override the cookie holds, declared by the app or
 * not, sorted by key. Read fresh, so it doesn't depend on the card having mounted.
 * When the read fails it gives the previews the store last read, or none if it never
 * did (PER-226).
 */
export async function previewedFlags(): Promise<PreviewedFlag[]> {
  await loadFlags();
  if (view.status !== "ready") return [];
  const { definitions, overrides } = view;
  return Object.keys(overrides)
    .sort()
    .map((key) => {
      const value = overrides[key] as FlagValue;
      const definition = definitions.find((entry) => entry.key === key);
      const label = definition?.options?.find((option) => sameFlagValue(option.value, value))?.label;
      return {
        key,
        value,
        ...(label ? { label } : {}),
        ...(definition?.description ? { description: definition.description } : {}),
      };
    });
}

/**
 * Reads the flags and publishes the answer, except a failure over a ready view (PER-226):
 * the source answered before, so a refused call or a bad discovery response is a dev
 * server restarting, not a reason to turn the card off. That view stays and the console
 * says so once. Any other view takes the failure, so a first load says why previews are off.
 */
export async function loadFlags(): Promise<void> {
  const result = await ask((from) => from.read());
  if (!result) return;
  if (!result.ok && view.status === "ready") {
    warnOnce(`[loupe] Couldn't re-read the flag previews: ${result.reason}`);
    return;
  }
  publish(
    result.ok
      ? { status: "ready", definitions: result.definitions, overrides: result.overrides, error: null }
      : { status: "unavailable", reason: result.reason },
  );
}

/** Previews `set` and stops previewing `clear`; the page re-renders with the new cookie. */
export async function previewFlags(set: FlagOverrides, clear: string[] | "all"): Promise<void> {
  if (view.status !== "ready") return;
  const result = await ask((from) => from.write(set, clear));
  if (!result || view.status !== "ready") return;
  publish(
    result.ok
      ? { ...view, overrides: result.overrides, error: null }
      : { ...view, error: result.reason },
  );
}

/**
 * The source's answer, a failure turned into a reason. Undefined when the store has
 * moved to another source meanwhile: that answer belongs to a page that's gone.
 */
async function ask<T extends object>(
  question: (from: FlagSource) => Promise<T>,
): Promise<T | { ok: false; reason: string } | undefined> {
  const from = source;
  const answer = await question(from).catch((error: unknown) => ({ ok: false as const, reason: messageOf(error) }));
  return from === source ? answer : undefined;
}

/** Flag values compare by value: an option and an override are the same if they serialise the same. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
