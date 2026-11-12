// The footer's Export and its dialog (PER-99 §8, PER-139). Functional only, like
// the rest of the Toolbar; the visual pass is PER-140. The counts and the size
// warning inform and never block; only an empty title holds Export back.

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { type ExportPreview, exportForm, exportProposal, megabytes, previewExport, REPORT_WARN_BYTES } from "./export.js";

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "3 changes · 1 without a screenshot · 1 held for review · 0 outdated Snapshots". */
export function countsLine(preview: ExportPreview): string {
  return [
    plural(preview.changes, "change"),
    `${preview.withoutScreenshot} without a screenshot`,
    `${preview.held} held for review`,
    plural(preview.outdatedSnapshots, "outdated Snapshot"),
  ].join(" · ");
}

export function ExportButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  useEffect(() => {
    if (exported === null) return;
    const timer = setTimeout(() => setExported(null), 2500);
    return () => clearTimeout(timer);
  }, [exported]);
  return (
    <>
      <button
        type="button"
        data-export=""
        disabled={disabled || open}
        title={exported ?? "Download the HTML report for engineering"}
        onClick={() => setOpen(true)}
      >
        {exported !== null ? "Exported" : "Export…"}
      </button>
      {open && (
        <ExportDialog
          onClose={(fileName) => {
            setOpen(false);
            if (fileName) setExported(`Downloaded ${fileName}`);
          }}
        />
      )}
    </>
  );
}

function ExportDialog({ onClose }: { onClose(fileName?: string): void }) {
  const form = exportForm();
  const [preview, setPreview] = useState<ExportPreview | { failed: string } | null>(null);
  const [title, setTitle] = useState(form.title ?? "");
  const [designer, setDesigner] = useState(form.designer);
  const [notes, setNotes] = useState<Record<string, string>>({ ...form.notes });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    previewExport().then(
      (result) => {
        if (!live) return;
        setPreview(result);
        // Prefilled from the first change until the designer writes their own.
        if (exportForm().title === null) setTitle(result.suggestedTitle);
      },
      (failure: unknown) => live && setPreview({ failed: failure instanceof Error ? failure.message : String(failure) }),
    );
    titleInput.current?.focus();
    return () => {
      live = false;
    };
  }, []);

  const ready = preview !== null && !("failed" in preview);
  const estimate = ready ? preview.bytes + preview.captureBytes : 0;
  const run = () => {
    if (title.trim() === "" || busy) return;
    setBusy(true);
    setError(null);
    exportProposal({ title, designer, notes }).then(
      (result) => onClose(result.fileName),
      (failure: unknown) => {
        console.warn("[loupe] Export failed:", failure);
        setBusy(false);
        setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || busy) return;
    event.stopPropagation();
    onClose();
  };

  return (
    <div className="dialog-backdrop">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loupe-export-title"
        onKeyDown={onKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <h2 id="loupe-export-title">Export Proposal</h2>
        <label className="field">
          <span>Title</span>
          <input
            ref={titleInput}
            name="title"
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              exportForm().title = event.target.value;
            }}
          />
        </label>
        <label className="field">
          <span>
            Designer <span className="muted">(optional)</span>
          </span>
          <input
            name="designer"
            value={designer}
            onChange={(event) => {
              setDesigner(event.target.value);
              exportForm().designer = event.target.value;
            }}
          />
        </label>
        {preview === null && <p className="muted">Counting…</p>}
        {preview !== null && "failed" in preview && <div className="notice">{preview.failed}</div>}
        {ready && (
          <>
            <p className="counts" role="status">
              {countsLine(preview)}
            </p>
            <p className="muted">
              Export captures the screen in view first. Changes without a screenshot read "No screenshot" in the report.
            </p>
            {estimate > REPORT_WARN_BYTES && (
              <div className="banner" role="alert">
                The report will be about {megabytes(estimate)}, over 25 MB: some mail and ticket tools refuse files that size.
                Removing Snapshots makes it smaller.
              </div>
            )}
            {preview.entries.length > 0 && (
              <fieldset className="notes">
                <legend>
                  Notes <span className="muted">(optional, the why)</span>
                </legend>
                {preview.entries.map((entry) => (
                  <label key={entry.key} className="field" data-entry={entry.id}>
                    <span>
                      {entry.id} · {entry.label}
                    </span>
                    <textarea
                      rows={2}
                      value={notes[entry.key] ?? ""}
                      onChange={(event) => {
                        const next = { ...notes, [entry.key]: event.target.value };
                        setNotes(next);
                        exportForm().notes = next;
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}
        {error !== null && <div className="notice">{error}</div>}
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => onClose()}>
            Cancel
          </button>
          <button type="submit" disabled={title.trim() === "" || busy}>
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </form>
    </div>
  );
}
