// Feature-flag preview (PER-132): the Feature flags card, and the record of
// previewed flags the Proposal builder reads. Feature flags are the MVP's only
// rule preview (PER-92). The overrides live in the app's own override cookie, so a
// preview survives a reload, and the record is read back from it.

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatCurrent } from "./format.js";
import {
  type FlagDefinition,
  type FlagOption,
  type FlagOverrides,
  type FlagValue,
  readFlags,
  writeFlagOverrides,
} from "./flags-server.js";

export type FlagsView =
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; definitions: FlagDefinition[]; overrides: FlagOverrides; error: string | null };

/** A flag the page is being previewed with, for the Proposal. */
export type PreviewedFlag = { key: string; value: FlagValue; label?: string; description?: string };

let view: FlagsView = { status: "loading" };
const listeners = new Set<() => void>();

function publish(next: FlagsView): void {
  view = next;
  for (const listener of listeners) listener();
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
      const label = definition?.options?.find((option) => same(option.value, value))?.label;
      return {
        key,
        value,
        ...(label ? { label } : {}),
        ...(definition?.description ? { description: definition.description } : {}),
      };
    });
}

export async function loadFlags(): Promise<void> {
  const result = await readFlags().catch((error: unknown) => ({ ok: false as const, reason: messageOf(error) }));
  publish(
    result.ok
      ? { status: "ready", definitions: result.definitions, overrides: result.overrides, error: null }
      : { status: "unavailable", reason: result.reason },
  );
}

/** Previews `set` and stops previewing `clear`; the page re-renders with the new cookie. */
export async function previewFlags(set: FlagOverrides, clear: string[] | "all"): Promise<void> {
  if (view.status !== "ready") return;
  const result = await writeFlagOverrides(set, clear).catch((error: unknown) => ({
    ok: false as const,
    reason: messageOf(error),
  }));
  if (view.status !== "ready") return;
  publish(
    result.ok
      ? { ...view, overrides: result.overrides, error: null }
      : { ...view, error: result.reason },
  );
}

/** A flag with no declared options is offered as on and off. */
const ON_OFF: FlagOption[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

export function FlagsCard() {
  const current = useSyncExternalStore(onFlagsChange, flagsView);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Once per page load, not on every return from the inspector.
    if (flagsView().status !== "ready") void loadFlags();
  }, []);

  const run = (set: FlagOverrides, clear: string[] | "all") => {
    setBusy(true);
    void previewFlags(set, clear).finally(() => setBusy(false));
  };

  return (
    <div className="card" aria-label="Feature flags">
      <h3>Feature flags</h3>
      {current.status === "loading" && <div className="muted">Reading the app's flags…</div>}
      {current.status === "unavailable" && (
        <div className="muted" role="status">
          {current.reason}
        </div>
      )}
      {current.status === "ready" && (
        <>
          {current.definitions.length === 0 && <div className="muted">The app declares no flags.</div>}
          {current.definitions.map((definition) => (
            <FlagRow
              key={definition.key}
              definition={definition}
              overrides={current.overrides}
              busy={busy}
              onPreview={(value) => run({ [definition.key]: value }, [])}
              onClear={() => run({}, [definition.key])}
            />
          ))}
          {Object.keys(current.overrides)
            .filter((key) => !current.definitions.some((definition) => definition.key === key))
            .map((key) => (
              <FlagRow
                key={key}
                definition={{ key, description: "Not declared by the app's discovery endpoint." }}
                overrides={current.overrides}
                busy={busy}
                undeclared
                onPreview={() => {}}
                onClear={() => run({}, [key])}
              />
            ))}
          {current.error && (
            <div className="notice" role="alert">
              {current.error}
            </div>
          )}
          <button
            type="button"
            disabled={busy || Object.keys(current.overrides).length === 0}
            onClick={() => run({}, "all")}
          >
            Clear flag previews
          </button>
        </>
      )}
    </div>
  );
}

function FlagRow({
  definition,
  overrides,
  busy,
  undeclared = false,
  onPreview,
  onClear,
}: {
  definition: FlagDefinition;
  overrides: FlagOverrides;
  busy: boolean;
  undeclared?: boolean;
  onPreview(value: FlagValue): void;
  onClear(): void;
}) {
  const previewing = Object.hasOwn(overrides, definition.key);
  const value = overrides[definition.key];
  const options = definition.options ?? (undeclared ? [] : ON_OFF);
  return (
    <div className={previewing ? "row overridden" : "row"} data-flag={definition.key}>
      <div className="line">
        <span className="name mono">{definition.key}</span>
        {previewing && (
          <button type="button" className="reset" disabled={busy} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {definition.description && <div className="muted">{definition.description}</div>}
      {options.length > 0 && (
        <div className="pills" role="group" aria-label={definition.key}>
          {options.map((option) => (
            <button
              key={JSON.stringify(option.value)}
              type="button"
              aria-pressed={previewing && same(option.value, value)}
              disabled={busy}
              onClick={() => onPreview(option.value)}
            >
              {option.label ?? formatCurrent(option.value)}
            </button>
          ))}
        </div>
      )}
      {!definition.options && !undeclared && <div className="muted">No options declared: offered as on and off.</div>}
      <div className="current">{previewing ? `Previewing ${formatCurrent(value)}` : "The app decides"}</div>
    </div>
  );
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
