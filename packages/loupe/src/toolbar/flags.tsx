// Feature-flag preview (PER-132): the Feature flags card's view. Feature flags are the
// MVP's only rule preview (PER-92). What it shows, and what the Proposal reads, is
// `flags-store.ts`'s (PER-216); what it says is panel-view's (`flagsCard()`), and the card
// is patterns/flags-card/'s. This view asks the store to preview or clear, one write at a
// time, says a refused write, and keeps the keyboard in the card as Clear goes.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copyToClipboard } from "./clipboard.js";
import type { FlagOverrides } from "./flags-preview.js";
import { flagsView, loadFlags, onFlagsChange, previewFlags } from "./flags-store.js";
import { COMMAND_WORDS, flagsCard } from "./panel-view/index.js";
import { FlagsCard as FlagsCardPattern } from "./patterns/index.js";
import { useAnnounceChange } from "@loupe/ui";

/** A flag's options are one radio group, one Tab stop: the radio that holds it. */
const TAB_STOP = '[role="radio"][tabindex="0"]';

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
    const row = from.closest("[data-flag]");
    void done.then(() => {
      if (from.isConnected && !(from as HTMLButtonElement).disabled) return;
      // The cleared flag's options, at their tab stop (ChipGroup's roving one); else the card's first control.
      const next =
        (row?.isConnected ? row.querySelector<HTMLElement>(TAB_STOP) : null) ??
        card.current?.querySelector<HTMLElement>(`${TAB_STOP}, button:not(:disabled)`) ??
        null;
      next?.focus();
    });
  };

  return (
    <FlagsCardPattern
      ref={card}
      flags={flagsCard(current)}
      busy={busy}
      onPreview={(key, value) => void run({ [key]: value }, [])}
      onClear={(key, from) => clearing(from, run({}, [key]))}
      onClearAll={(from) => clearing(from, run({}, "all"))}
      words={COMMAND_WORDS}
      onCopy={copyToClipboard}
    />
  );
}
