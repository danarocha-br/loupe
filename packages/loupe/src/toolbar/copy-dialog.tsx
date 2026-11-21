// The footer's Copy Proposal and its dialog (ADR 0002, after PER-99 §8 and PER-139),
// a modal centred on the page (PER-140). The counts inform and never block; only an
// empty title holds Copy back.

import { type KeyboardEvent, type SyntheticEvent, useEffect, useRef, useState } from "react";
import { copyProposal, type CopyPreview, copyForm, previewCopy } from "./copy.js";
import { plural } from "./format.js";
import { Key } from "./controls.js";
import { CopyIcon } from "./icons.js";

/** "3 changes · 1 held for review". */
export function countsLine(preview: CopyPreview): string {
  return [plural(preview.changes, "change"), `${preview.held} held for review`].join(" · ");
}

export function CopyProposalButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  /** The title of the Proposal last copied, while the button says so. */
  const [done, setDone] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (done === null) return;
    const timer = setTimeout(() => setDone(null), 2500);
    return () => clearTimeout(timer);
  }, [done]);
  // The modal held focus: hand it back once it has gone. While it is still open,
  // everything outside it is inert and refuses focus.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="btn primary"
        data-copy=""
        disabled={disabled}
        title={done === null ? "Copy the Proposal for your coding agent or an engineer" : `Copied "${done}"`}
        onClick={() => setOpen(true)}
      >
        <CopyIcon size={16} />
        {done === null ? "Copy Proposal" : "Copied"}
      </button>
      {open && (
        <CopyDialog
          onClose={(copied) => {
            setOpen(false);
            if (copied !== undefined) setDone(copied);
          }}
        />
      )}
    </>
  );
}

/** `onClose` gets the copied Proposal's title, or nothing when the dialog was cancelled. */
function CopyDialog({ onClose }: { onClose(copied?: string): void }) {
  const form = copyForm();
  const [preview, setPreview] = useState<CopyPreview | { failed: string } | null>(null);
  const [title, setTitle] = useState(form.title ?? "");
  const [designer, setDesigner] = useState(form.designer);
  const [notes, setNotes] = useState<Record<string, string>>({ ...form.notes });
  const [busy, setBusy] = useState(false);
  // State lags a second Enter in the same frame; the ref doesn't.
  const running = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const element = useRef<HTMLDialogElement>(null);

  // Modal where the browser can: the rest of the page goes inert and Tab stays inside.
  useEffect(() => {
    const dialog = element.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  useEffect(() => {
    let live = true;
    previewCopy().then(
      (result) => {
        if (!live) return;
        setPreview(result);
        // Prefilled from the first change until the designer writes their own.
        if (copyForm().title === null) setTitle(result.suggestedTitle);
      },
      (failure: unknown) => live && setPreview({ failed: failure instanceof Error ? failure.message : String(failure) }),
    );
    titleInput.current?.focus();
    return () => {
      live = false;
    };
  }, []);

  const ready = preview !== null && !("failed" in preview);
  const run = () => {
    if (title.trim() === "" || running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    copyProposal({ title, designer, notes }).then(
      () => onClose(title.trim()),
      (failure: unknown) => {
        console.warn("[loupe] Copy Proposal failed:", failure);
        running.current = false;
        setBusy(false);
        setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
  };
  const cancel = (event: KeyboardEvent | SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!running.current) onClose();
  };

  return (
    <dialog
      ref={element}
      className="dialog"
      aria-labelledby="loupe-copy-title"
      onCancel={cancel}
      onKeyDown={(event) => event.key === "Escape" && cancel(event)}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <div className="sec">
          <div className="head">
            <h2 id="loupe-copy-title">Copy Proposal</h2>
            <span className="meta">Markdown and JSON</span>
          </div>
          <label className="field">
            <span>Title</span>
            <input
              ref={titleInput}
              name="title"
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                copyForm().title = event.target.value;
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
                copyForm().designer = event.target.value;
              }}
            />
          </label>
        </div>
        <div className="sec">
          {preview === null && <p className="muted">Counting…</p>}
          {preview !== null && "failed" in preview && (
            <div className="warn" role="alert">
              <span className="dot" />
              {preview.failed}
            </div>
          )}
          {ready && (
            <>
              {/* The tiles are what the eye reads; the line is what a screen reader hears. */}
              <div className="tiles" aria-hidden="true">
                {[
                  [preview.changes, "Changes"],
                  [preview.held, "Held"],
                ].map(([count, label]) => (
                  <div key={label} className="tile">
                    <b>{count}</b>
                    <span className="meta">{label}</span>
                  </div>
                ))}
              </div>
              <p className="counts sr-only" role="status">
                {countsLine(preview)}
              </p>
            </>
          )}
        </div>
        {ready && preview.entries.length > 0 && (
          <div className="sec soft">
            <fieldset className="notes">
              <legend>
                Notes <span className="muted">optional, the why</span>
              </legend>
              {preview.entries.map((entry) => (
                <label key={entry.key} className="field" data-entry={entry.id}>
                  <span className="entry">
                    <Key n={Number(entry.id.slice(1))} />
                    <span className="sr-only">Change </span>
                    {entry.label}
                  </span>
                  <textarea
                    rows={2}
                    value={notes[entry.key] ?? ""}
                    onChange={(event) => {
                      const next = { ...notes, [entry.key]: event.target.value };
                      setNotes(next);
                      copyForm().notes = next;
                    }}
                  />
                </label>
              ))}
            </fieldset>
          </div>
        )}
        {error !== null && (
          <div className="sec">
            <div className="warn" role="alert">
              <span className="dot" />
              {error}
            </div>
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn" disabled={busy} onClick={() => onClose()}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={title.trim() === "" || busy}>
            <CopyIcon size={16} />
            {busy ? "Copying…" : "Copy"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
