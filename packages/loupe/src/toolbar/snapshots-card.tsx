// *Capture screen* and the Snapshot list (PER-138). The dock holds Capture screen
// (PER-140); this card lists what it took. The list redraws with the panel, which
// redraws on every registry change, so Outdated is re-read then.

import { useState } from "react";
import { currentRoute } from "../runtime/registry.js";
import { megabytes } from "./format.js";
import { captureScreen, isOutdated, removeSnapshot, type Snapshot, snapshots } from "./snapshots.js";

type Busy = { capturing: number | "new" | null; error: string | null };

/** Capture screen, or Retake of one Snapshot: what is under way and what last failed. */
export function useCapture() {
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
  const route = currentRoute();
  return (
    <div className="card list-card">
      <div className="head">
        <h3>Snapshots</h3>
        <span className="meta">{list.length} · this page load</span>
      </div>
      <ul className="snapshots" aria-label="Snapshots">
        {list.map((snapshot) => {
          const outdated = isOutdated(snapshot);
          const elsewhere = snapshot.route !== route;
          return (
            <li key={snapshot.id} data-snapshot={snapshot.id}>
              <img
                className={outdated ? "thumb outdated" : "thumb"}
                src={snapshot.viewport.after}
                alt={`Snapshot ${snapshot.id}, after`}
                width={64}
              />
              <div className="info">
                <div className="title">
                  Snapshot {snapshot.id}
                  {snapshot.auto && <span className="muted"> (export)</span>}
                </div>
                {outdated && (
                  <span>
                    <span className="tag status stale" title="An Override it showed has changed. It won't be exported.">
                      Outdated · won't export
                    </span>
                  </span>
                )}
                <div className="summary">{summary(snapshot)}</div>
                <div className="btns">
                  <button
                    type="button"
                    className="btn small"
                    disabled={busy.capturing !== null || elsewhere}
                    title={elsewhere ? `Taken on ${snapshot.route}: open that page to retake it` : undefined}
                    onClick={() => run(snapshot.id)}
                  >
                    {busy.capturing === snapshot.id ? "Retaking…" : "Retake"}
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    disabled={busy.capturing !== null}
                    onClick={() => removeSnapshot(snapshot.id)}
                  >
                    Remove
                  </button>
                </div>
                {elsewhere && <div className="elsewhere">Taken on {snapshot.route}: open that page to retake it.</div>}
              </div>
            </li>
          );
        })}
      </ul>
      {busy.error !== null && (
        <div className="warn" role="alert">
          <span className="dot" />
          {busy.error}
        </div>
      )}
    </div>
  );
}
