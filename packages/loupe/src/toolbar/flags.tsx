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
import { Button, Chip, ChipGroup, Dot, Fold, FoldChevron, FoldPanel, FoldTrigger, useAnnounceChange } from "./ui/index.js";

/** A flag with no declared options is offered as on and off. */
const ON_OFF: FlagOption[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

export function FlagsCard() {
  const current = useSyncExternalStore(onFlagsChange, flagsView);
  // A refused write, said as it lands, each time: the card shows it below.
  const error = current.status === "ready" ? (current.error ?? "") : "";
  useAnnounceChange(error, { politeness: "assertive", key: error === "" ? null : current });
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
      {current.status === "loading" && <div className="muted">Reading the app’s flags…</div>}
      {current.status === "unavailable" && (
        // One line until it's opened: the fix is an engineer's, and the list comes first.
        <Fold className="off">
          <FoldTrigger>
            <Dot tone="amber" small />
            Flag previews are off
            <span className="muted"> · why</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <div className="why">
              <div className="muted">{current.reason}</div>
              {/* The one fix the reader makes in a file: say which and where. */}
              {current.reason.startsWith("FLAGS_SECRET isn't set") && <Command text="FLAGS_SECRET=… in .env.local" copy="FLAGS_SECRET=" prompt={false} />}
            </div>
          </FoldPanel>
        </Fold>
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
              <Dot tone="amber" />
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
          <Button
            className="clear"
            disabled={busy || Object.keys(current.overrides).length === 0}
            onClick={(event) => clearing(event.currentTarget, run({}, "all"))}
          >
            <ResetIcon />
            Clear flag previews
          </Button>
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
  // Chips take string values: each option by its place in the list.
  const checked = previewing ? options.findIndex((option) => sameFlagValue(option.value, value)) : -1;
  const shown = options[checked];
  return (
    <div className={previewing ? "row flag overridden" : "row flag"} data-flag={definition.key}>
      <div className="line">
        <Dot tone={previewing ? "lilac" : "hollow"} small />
        <span className="name">{definition.key}</span>
        {previewing && (
          <Button size="small" className="reset" disabled={busy} onClick={(event) => onClear(event.currentTarget)}>
            <ResetIcon />
            Clear
          </Button>
        )}
      </div>
      {definition.description && <div className="muted">{definition.description}</div>}
      {!definition.options && !undeclared && <div className="muted">No options declared: offered as on and off.</div>}
      <div className="foot">
        {options.length > 0 && (
          // One of a flag's options, or none while the app decides: a radio group with nothing checked.
          <ChipGroup
            label={definition.key}
            value={checked === -1 ? null : String(checked)}
            busy={busy}
            onChoose={(index) => {
              const option = options[Number(index)];
              if (option) onPreview(option.value);
            }}
          >
            {options.map((option, index) => (
              <Chip key={JSON.stringify(option.value)} value={String(index)}>
                {option.label ?? formatCurrent(option.value)}
              </Chip>
            ))}
          </ChipGroup>
        )}
        <div className="state">
          {previewing ? `Previewing ${shown?.label ?? formatCurrent(value)}` : "App decides"}
        </div>
      </div>
    </div>
  );
}
