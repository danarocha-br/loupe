// Feature-flag preview (PER-132): the Feature flags card. Feature flags are the
// MVP's only rule preview (PER-92). What it shows, and what the Proposal reads, is
// `flags-store.ts`'s (PER-216); the card only renders the store and asks it to
// preview or clear.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatCurrent } from "./format.js";
import type { FlagDefinition, FlagOption, FlagOverrides, FlagValue } from "./flags-preview.js";
import { PREVIEW_HOURS } from "./flags-lifetime.js";
import { flagsView, loadFlags, onFlagsChange, previewFlags, sameFlagValue } from "./flags-store.js";
import { ClockIcon, ResetIcon } from "./icons.js";
import { Command } from "./command.js";

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

  // While a preview is written, another click waits its turn. The options stay enabled:
  // disabling the one that has focus would drop the keyboard out of the card.
  const busyNow = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const run = (set: FlagOverrides, clear: string[] | "all"): Promise<void> => {
    if (busyNow.current) return Promise.resolve();
    busyNow.current = true;
    setBusy(true);
    return previewFlags(set, clear).finally(() => {
      busyNow.current = false;
      setBusy(false);
    });
  };
  /** A Clear that had focus goes (its row stops previewing) or turns off: focus moves to what's left. */
  const clearing = (from: HTMLElement, done: Promise<void>) => {
    const root = from.getRootNode() as Document | ShadowRoot;
    if (root.activeElement !== from) return;
    const row = from.closest(".flag");
    void done.then(() => {
      if (from.isConnected && !(from as HTMLButtonElement).disabled) return;
      const next =
        (row?.isConnected ? row.querySelector<HTMLElement>(".pills button") : null) ??
        card.current?.querySelector<HTMLElement>(".pills button, button:not(:disabled)") ??
        null;
      next?.focus();
    });
  };

  const meta =
    current.status === "ready"
      ? `${current.definitions.length} declared · ${Object.keys(current.overrides).length} previewing`
      : current.status === "unavailable"
        ? "Unavailable"
        : null;
  return (
    <div className="card flags" ref={card}>
      <div className="head">
        <h3>Feature flags</h3>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {/* Always there, so an error is announced when its text lands; the card shows it below. */}
      <p className="sr-only" role="alert">
        {current.status === "ready" ? (current.error ?? "") : ""}
      </p>
      {current.status === "loading" && <div className="muted">Reading the app’s flags…</div>}
      {current.status === "unavailable" && (
        // One line until it's opened: the fix is an engineer's, and the list comes first.
        <details className="row off">
          <summary>
            <span className="dot amber small" />
            Flag previews are off
            <span className="muted"> · why</span>
          </summary>
          <div className="muted">{current.reason}</div>
          {/* The one fix the reader makes in a file: say which and where. */}
          {current.reason.startsWith("FLAGS_SECRET isn't set") && <Command text="FLAGS_SECRET=… in .env.local" copy="FLAGS_SECRET=" prompt={false} />}
        </details>
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
              onPreview={(value) => void run({ [definition.key]: value }, [])}
              onClear={(from) => clearing(from, run({}, [definition.key]))}
            />
          ))}
          {Object.keys(current.overrides)
            .filter((key) => !current.definitions.some((definition) => definition.key === key))
            .map((key) => (
              <FlagRow
                key={key}
                definition={{ key, description: "Not declared by the app’s discovery endpoint." }}
                overrides={current.overrides}
                busy={busy}
                undeclared
                onPreview={() => {}}
                onClear={(from) => clearing(from, run({}, [key]))}
              />
            ))}
          {current.error && (
            <div className="warn">
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
            onClick={(event) => clearing(event.currentTarget, run({}, "all"))}
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
  /** Given the Clear button, so focus can move on once it has gone. */
  onClear(from: HTMLElement): void;
}) {
  const previewing = Object.hasOwn(overrides, definition.key);
  const value = overrides[definition.key];
  const options = definition.options ?? (undeclared ? [] : ON_OFF);
  const shown = options.find((option) => sameFlagValue(option.value, value));
  return (
    <div className={previewing ? "row flag overridden" : "row flag"} data-flag={definition.key}>
      <div className="line">
        <span className={previewing ? "dot small purple" : "dot small hollow"} />
        <span className="name">{definition.key}</span>
        {previewing && (
          <button type="button" className="btn small reset" disabled={busy} onClick={(event) => onClear(event.currentTarget)}>
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
                aria-pressed={previewing && sameFlagValue(option.value, value)}
                aria-busy={busy || undefined}
                onClick={() => onPreview(option.value)}
              >
                {option.label ?? formatCurrent(option.value)}
              </button>
            ))}
          </div>
        )}
        <div className="state">
          {previewing ? `Previewing ${shown?.label ?? formatCurrent(value)}` : "App decides"}
        </div>
      </div>
    </div>
  );
}
