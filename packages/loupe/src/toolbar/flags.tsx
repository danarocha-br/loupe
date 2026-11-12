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
import { PREVIEW_HOURS } from "./flags-lifetime.js";
import { ClockIcon, ResetIcon } from "./icons.js";
import { Command } from "./command.js";

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

  const meta =
    current.status === "ready"
      ? `${current.definitions.length} declared · ${Object.keys(current.overrides).length} previewing`
      : current.status === "unavailable"
        ? "Unavailable"
        : null;
  return (
    <div className="card flags" aria-label="Feature flags">
      <div className="head">
        <h3>Feature flags</h3>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {current.status === "loading" && <div className="muted">Reading the app's flags…</div>}
      {current.status === "unavailable" && (
        <div className="row off" role="status">
          <div className="head">
            <div className="title">
              <span className="dot amber small" />
              Flag previews are off
            </div>
          </div>
          <div className="muted">{current.reason}</div>
          {/* The one fix the reader makes in a file: say which and where. */}
          {current.reason.startsWith("FLAGS_SECRET isn't set") && <Command text="FLAGS_SECRET=… in .env.local" copy="FLAGS_SECRET=" prompt={false} />}
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
            <div className="warn" role="alert">
              <span className="dot" />
              {current.error}
            </div>
          )}
          <div className="lasts">
            <ClockIcon />
            <span>
              A preview lasts {PREVIEW_HOURS} hours, in a cookie every app on localhost shares. Clear it before
              switching projects.
            </span>
          </div>
          <button
            type="button"
            className="btn clear"
            disabled={busy || Object.keys(current.overrides).length === 0}
            onClick={() => run({}, "all")}
          >
            <ResetIcon />
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
  const shown = options.find((option) => same(option.value, value));
  return (
    <div className={previewing ? "row flag overridden" : "row flag"} data-flag={definition.key}>
      <div className="line">
        <span className={previewing ? "dot small purple" : "dot small hollow"} />
        <span className="name">{definition.key}</span>
        {previewing && (
          <button type="button" className="btn small reset" disabled={busy} onClick={onClear}>
            <ResetIcon />
            Clear
          </button>
        )}
      </div>
      {definition.description && <div className="muted">{definition.description}</div>}
      {!definition.options && !undeclared && <div className="muted">No options declared: offered as on and off.</div>}
      <div className="foot">
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
        <div className="state">
          {previewing ? `PREVIEWING ${(shown?.label ?? formatCurrent(value)).toUpperCase()}` : "APP DECIDES"}
        </div>
      </div>
    </div>
  );
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
