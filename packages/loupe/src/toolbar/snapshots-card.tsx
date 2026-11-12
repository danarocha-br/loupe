// *Capture screen* and the Snapshot list (PER-138). Functional only, like the
// rest of the Toolbar; the visual pass is PER-140. The list redraws with the
// panel, which redraws on every registry change, so Outdated is re-read then.

import { useState } from "react";
import { captureScreen, isOutdated, removeSnapshot, type Snapshot, snapshots } from "./snapshots.js";

type Busy = { capturing: number | "new" | null; error: string | null };

function useCapture() {
  const [busy, setBusy] = useState<Busy>({ capturing: null, error: null });
  const run = (replace?: number) => {
    setBusy({ capturing: replace ?? "new", error: null });
    captureScreen(replace === undefined ? {} : { replace }).then(
      () => setBusy({ capturing: null, error: null }),
      (error: unknown) => {
        console.warn("[loupe] Capture screen failed:", error);
        setBusy({ capturing: null, error: error instanceof Error ? error.message : String(error) });
      },
    );
  };
  return { busy, run };
}

/** The header's *Capture screen*: a before/after pair of the screen in view. */
export function CaptureButton({ disabled }: { disabled: boolean }) {
  const { busy, run } = useCapture();
  return (
    <button
      type="button"
      disabled={disabled || busy.capturing !== null}
      title={busy.error ?? "A before/after Snapshot of the screen in view, for the Proposal"}
      onClick={() => run()}
    >
      {busy.capturing !== null ? "Capturing…" : busy.error !== null ? "Capture failed" : "Capture screen"}
    </button>
  );
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function summary(snapshot: Snapshot): string {
  const crops = snapshot.crops.length;
  const [w, h] = snapshot.size;
  return `${snapshot.route} · ${w}×${h} · ${crops} crop${crops === 1 ? "" : "s"} · ${megabytes(snapshot.bytes)}`;
}

/** Every Snapshot this page load, each with Retake and Remove; nothing while there are none. */
export function SnapshotsCard() {
  const { busy, run } = useCapture();
  const list = snapshots();
  if (list.length === 0) return null;
  return (
    <div className="card">
      <h3>Snapshots</h3>
      <ul className="list" aria-label="Snapshots">
        {list.map((snapshot) => {
          const outdated = isOutdated(snapshot);
          return (
            <li key={snapshot.id} className="row" data-snapshot={snapshot.id}>
              <div className="line">
                <img
                  src={snapshot.viewport.after}
                  alt={`Snapshot ${snapshot.id}, after`}
                  width={64}
                  style={{ flex: "none", borderRadius: 3, opacity: outdated ? 0.5 : 1 }}
                />
                <span className="value">
                  Snapshot {snapshot.id}
                  {snapshot.auto && <span className="muted"> (export)</span>}{" "}
                  {outdated && (
                    <span className="tag" title="An Override it showed has changed. It won't be exported.">
                      Outdated
                    </span>
                  )}
                  <br />
                  <span className="muted">{summary(snapshot)}</span>
                </span>
              </div>
              <div className="chips">
                <button type="button" disabled={busy.capturing !== null} onClick={() => run(snapshot.id)}>
                  {busy.capturing === snapshot.id ? "Retaking…" : "Retake"}
                </button>
                <button type="button" disabled={busy.capturing !== null} onClick={() => removeSnapshot(snapshot.id)}>
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {busy.error !== null && <div className="notice">{busy.error}</div>}
    </div>
  );
}
