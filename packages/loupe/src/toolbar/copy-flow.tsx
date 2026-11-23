// Copy Proposal in the footer (ADR 0002; Paper's "Copy flow v2 · A", 2026-11-22): a
// split button. Its main half copies in one click, under the title given so far or the
// suggested one; its chevron opens a small popover over the footer for a title and a
// designer. Copied, the button turns green and a toast says what went; refused, a
// popover says why, holds the Proposal's text to copy by hand, and tries again. The
// popover points at what opened it: the chevron, or the button a one-click copy came from.
// It isn't modal: the page and the panel stay usable while it is open.

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useEscape } from "./escape.js";
import { type CopyDetails, CopyFailed, copyForm, copyProposal, formDetails, suggestTitle } from "./copy.js";
import { AlertIcon, CheckIcon, ChevronUpIcon, CopyIcon, ExclaimIcon, ResetIcon } from "./icons.js";

/** Every word the flow shows, beside the component that shows it. */
export const COPY = {
  idle: "Copy Proposal",
  copied: "Copied",
  failed: "Not copied",
  mainTitle: "Copy the Proposal for your coding agent or an engineer",
  detailsTitle: "Copy with a title and a designer",
  details: "Copy with details",
  title: "Title",
  designer: "Designer",
  optional: "optional",
  designerHint: "Who is asking for this?",
  copyWith: "Copy with these details",
  notCopied: "Couldn’t copy automatically",
  below: "Your Proposal is below.",
  selectAll: "Select all",
  retry: "Try again",
  pasteIt: "Paste it into your coding agent",
} as const;

/** Under the title field when the details' copy is pressed with none. */
export const TITLE_MISSING = "Give the Proposal a title: it heads the text your coding agent reads.";

/** What a screen reader hears once a copy lands: the toast's words. */
export const copiedText = (title: string) => `Copied “${title}”. ${COPY.pasteIt}.`;

/** How long the button says Copied, and the toast stays. */
const COPIED_MS = 2500;
const TOAST_MS = 4000;

type From = "copy" | "details";
type Failure = { reason: string; text: string; from: From };
/** The last copy that landed; `at` tells two copies of the same title apart, so each restarts the timers. */
type Landed = { title: string; at: number };

/** The split button's look and words in each state. */
const STATES = {
  idle: { icon: <CopyIcon size={16} />, text: COPY.idle },
  copied: { icon: <CheckIcon size={16} />, text: COPY.copied },
  failed: { icon: <AlertIcon />, text: COPY.failed },
} as const;

/** `disabled` while there is nothing to copy. */
export function CopyFlow({ disabled }: { disabled: boolean }) {
  const [details, setDetails] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [copied, setCopied] = useState<Landed | null>(null);
  const [toast, setToast] = useState<Landed | null>(null);
  const [busy, setBusy] = useState(false);
  // State lags a second click in the same frame; the ref doesn't.
  const running = useRef(false);
  const chevron = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const halfFor = (from: From) => (from === "copy" ? main : chevron);
  const run = (from: From, copyDetails: CopyDetails) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    copyProposal(copyDetails).then(
      ({ title }) => {
        running.current = false;
        setBusy(false);
        setFailure(null);
        setDetails(false);
        const landed = { title, at: Date.now() };
        setCopied(landed);
        setToast(landed);
        // The popover held focus: hand it back to the half that opened it.
        halfFor(from).current?.focus();
      },
      (error: unknown) => {
        running.current = false;
        setBusy(false);
        console.warn("[loupe] Copy Proposal failed:", error);
        setDetails(false);
        setCopied(null);
        setToast(null);
        setFailure({
          reason: error instanceof Error ? error.message : String(error),
          text: error instanceof CopyFailed ? error.proposal : "",
          from,
        });
      },
    );
  };
  /** Closes the popover; `returnFocus` when closed from the keyboard or a button, not by a press elsewhere. */
  const close = (returnFocus: boolean) => {
    const from = failure?.from ?? "details";
    setDetails(false);
    setFailure(null);
    if (returnFocus) halfFor(from).current?.focus();
  };

  const state = failure?.from === "copy" ? "failed" : copied !== null ? "copied" : "idle";
  const look = STATES[state];
  const detailsOpen = details || failure?.from === "details";
  return (
    <>
      <div className="split" data-state={state} aria-busy={busy || undefined}>
        <button
          ref={main}
          type="button"
          className="split-main"
          data-copy=""
          disabled={disabled}
          title={COPY.mainTitle}
          onClick={() => run("copy", formDetails())}
        >
          {look.icon}
          {look.text}
        </button>
        <span className="split-rule" aria-hidden="true" />
        <button
          ref={chevron}
          type="button"
          className="split-more"
          data-copy-details=""
          disabled={disabled}
          aria-expanded={detailsOpen}
          aria-haspopup="dialog"
          title={COPY.detailsTitle}
          onClick={() => (details || failure ? close(true) : setDetails(true))}
        >
          <ChevronUpIcon />
          <span className="sr-only">{COPY.details}</span>
        </button>
      </div>
      {details && <Details busy={busy} onCopy={(copyDetails) => run("details", copyDetails)} onClose={close} />}
      {failure && <NotCopied failure={failure} busy={busy} onRetry={() => run(failure.from, formDetails())} onClose={close} />}
      {toast !== null && failure === null && !details && (
        <div className="copy-toast" aria-hidden="true">
          <span className="badge">
            <CheckIcon size={14} />
          </span>
          <span className="what">
            <span className="line">
              {/* `bdi`: the title is the app's words, whatever their direction. */}
              {COPY.copied} “<bdi className="copied-title">{toast.title}</bdi>”
            </span>
            <span className="sub">{COPY.pasteIt}</span>
          </span>
        </div>
      )}
      {/* Always there, so what lands in it is announced; the toast itself is for the eye. */}
      <p className="sr-only" role="status" data-testid="copy-status">
        {toast === null ? "" : copiedText(toast.title)}
      </p>
    </>
  );
}

/**
 * A popover over the footer, pointing at what opened it. Escape anywhere, or a press
 * outside it and its split button, closes it; Escape while it is open is its alone
 * (escape.ts: the popover's layer is above the selection's), so the selection stays.
 */
function Popover({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: From;
  label: string;
  onClose(returnFocus: boolean): void;
  children: ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  // Read when the key or press comes, so the listeners stay put across renders.
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const path = event.composedPath();
      const inside = path.some((node) => node === element.current || (node instanceof HTMLElement && node.classList.contains("split")));
      if (!inside) latest.current(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, []);
  useEscape("popover", true, () => latest.current(true));
  return (
    <div ref={element} className="copy-popover" role="dialog" aria-label={label} data-anchor={anchor}>
      {children}
      <svg className="caret" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
        <path className="fill" d="M0 0H22L11 11Z" />
        <path className="edge" d="M0.5 0L11 10.5L21.5 0" />
      </svg>
    </div>
  );
}

/** The chevron's popover: a title, prefilled from the suggestion until edited, and an optional designer. */
function Details({ busy, onCopy, onClose }: { busy: boolean; onCopy(details: CopyDetails): void; onClose(returnFocus: boolean): void }) {
  const form = copyForm();
  const [title, setTitle] = useState(form.title ?? "");
  const [designer, setDesigner] = useState(form.designer);
  const [missing, setMissing] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleInput.current?.focus();
    let live = true;
    // Prefilled from the first change until the designer writes their own.
    if (copyForm().title === null) {
      suggestTitle().then(
        (suggested) => live && copyForm().title === null && setTitle(suggested),
        () => {},
      );
    }
    return () => {
      live = false;
    };
  }, []);
  return (
    <Popover anchor="details" label={COPY.details} onClose={onClose}>
      <form
        className="details"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() === "") {
            setMissing(true);
            titleInput.current?.focus();
            return;
          }
          onCopy({ title, designer });
        }}
      >
        {/* The error sits outside the label, so it describes the field without joining its name. */}
        <div className="field">
          <label htmlFor="loupe-copy-title-field">{COPY.title}</label>
          <input
            id="loupe-copy-title-field"
            ref={titleInput}
            name="title"
            required
            aria-invalid={missing || undefined}
            aria-describedby={missing ? "loupe-title-missing" : undefined}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (event.target.value.trim() !== "") setMissing(false);
              copyForm().title = event.target.value;
            }}
          />
          {missing && (
            <span className="field-error" id="loupe-title-missing">
              {TITLE_MISSING}
            </span>
          )}
        </div>
        <label className="field">
          <span>
            {COPY.designer} <span className="optional">{COPY.optional}</span>
          </span>
          <input
            name="designer"
            placeholder={COPY.designerHint}
            value={designer}
            onChange={(event) => {
              setDesigner(event.target.value);
              copyForm().designer = event.target.value;
            }}
          />
        </label>
        <button type="submit" className="btn primary" aria-disabled={busy || undefined}>
          <CopyIcon size={16} />
          {COPY.copyWith}
        </button>
      </form>
    </Popover>
  );
}

/** A refused copy: why, the Proposal's text to copy by hand when it was built, and another try. */
function NotCopied({ failure, busy, onRetry, onClose }: { failure: Failure; busy: boolean; onRetry(): void; onClose(returnFocus: boolean): void }) {
  const text = useRef<HTMLTextAreaElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => retry.current?.focus(), []);
  const hasText = failure.text !== "";
  return (
    <Popover anchor={failure.from} label={COPY.notCopied} onClose={onClose}>
      <div className="not-copied">
        <span className="badge" aria-hidden="true">
          <ExclaimIcon />
        </span>
        <div className="why">
          <h3>{COPY.notCopied}</h3>
          <p role="alert">{hasText ? `${failure.reason} ${COPY.below}` : failure.reason}</p>
        </div>
      </div>
      {hasText && (
        <div className="proposal-text">
          <textarea ref={text} readOnly value={failure.text} aria-label="The Proposal" spellCheck={false} />
        </div>
      )}
      <div className={hasText ? "popover-actions" : "popover-actions alone"}>
        {hasText && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              text.current?.focus();
              text.current?.select();
            }}
          >
            {COPY.selectAll}
          </button>
        )}
        <button ref={retry} type="button" className="btn primary" aria-disabled={busy || undefined} onClick={onRetry}>
          <ResetIcon />
          {COPY.retry}
        </button>
      </div>
    </Popover>
  );
}
