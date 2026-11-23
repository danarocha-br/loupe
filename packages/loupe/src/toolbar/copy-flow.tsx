// Copy Proposal in the footer (ADR 0002; Paper's "Copy flow v2 · A", 2026-11-22): a
// split button. Its main half copies in one click, under the title given so far or the
// suggested one; its chevron opens a small popover over the footer for a title and a
// designer. Copied, the button turns green and a toast says what went; refused, a
// popover says why, holds the Proposal's text to copy by hand, and tries again. The
// popover points at what opened it: the chevron, or the button a one-click copy came from.
// It isn't modal: the page and the panel stay usable while it is open.

import { type RefObject, useEffect, useRef, useState } from "react";
import { useEscape } from "./escape.js";
import { type CopyDetails, CopyFailed, copyForm, copyProposal, formDetails, suggestTitle } from "./copy.js";
import { AlertIcon, CheckIcon, ChevronUpIcon, CopyIcon, ExclaimIcon, ResetIcon } from "./icons.js";
import { Button, Field, Popover, PopoverPanel } from "./ui/index.js";

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
  proposal: "The Proposal",
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

/** `disabled` while there is nothing to copy; `frame`, the footer the popovers stand over. */
export function CopyFlow({ disabled, frame }: { disabled: boolean; frame: RefObject<HTMLElement | null> }) {
  const [details, setDetails] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  // Which half the last refusal came from. Kept apart from `failure`, which closing clears
  // before the popover has handed focus back: it is where that focus goes.
  const [failedFrom, setFailedFrom] = useState<From>("details");
  const [copied, setCopied] = useState<Landed | null>(null);
  const [toast, setToast] = useState<Landed | null>(null);
  const [busy, setBusy] = useState(false);
  // State lags a second click in the same frame; the ref doesn't.
  const running = useRef(false);
  const split = useRef<HTMLDivElement>(null);
  const chevron = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLButtonElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const retry = useRef<HTMLButtonElement>(null);

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
  // The popover takes Escape itself (ui/popover) and hands focus back. Claiming its layer
  // while it is up keeps the key from the selection beneath (escape.ts), so that stays.
  useEscape("popover", details || failure !== null, () => {});

  const halfFor = (from: From) => (from === "copy" ? main : chevron);
  const run = (from: From, copyDetails: CopyDetails) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    copyProposal(copyDetails).then(
      ({ title }) => {
        running.current = false;
        setBusy(false);
        // Closing with focus inside hands it back to the half that opened the popover.
        setFailure(null);
        setDetails(false);
        const landed = { title, at: Date.now() };
        setCopied(landed);
        setToast(landed);
      },
      (error: unknown) => {
        running.current = false;
        setBusy(false);
        console.warn("[loupe] Copy Proposal failed:", error);
        setDetails(false);
        setCopied(null);
        setToast(null);
        setFailedFrom(from);
        setFailure({
          reason: error instanceof Error ? error.message : String(error),
          text: error instanceof CopyFailed ? error.proposal : "",
          from,
        });
      },
    );
  };
  const close = () => {
    setDetails(false);
    setFailure(null);
  };

  const state = failure?.from === "copy" ? "failed" : copied !== null ? "copied" : "idle";
  const look = STATES[state];
  const detailsOpen = details || failure?.from === "details";
  return (
    <>
      <div ref={split} className="split" data-state={state} aria-busy={busy || undefined}>
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
          onClick={() => {
            if (!details && !failure) return setDetails(true);
            close();
            chevron.current?.focus();
          }}
        >
          <ChevronUpIcon />
          <span className="sr-only">{COPY.details}</span>
        </button>
      </div>
      {/* A press on the split is its own: the chevron toggles, the main half copies again. */}
      <Popover open={details} onOpenChange={(open) => !open && setDetails(false)} inside={split}>
        <PopoverPanel label={COPY.details} anchor={frame} returnFocus={chevron} initialFocus={titleField} caret="end" className="copy-popover">
          <Details titleField={titleField} busy={busy} onCopy={(copyDetails) => run("details", copyDetails)} />
        </PopoverPanel>
      </Popover>
      <Popover open={failure !== null} onOpenChange={(open) => !open && setFailure(null)} inside={split}>
        <PopoverPanel
          label={COPY.notCopied}
          anchor={frame}
          returnFocus={halfFor(failedFrom)}
          initialFocus={retry}
          caret={failedFrom === "copy" ? "center" : "end"}
          className="copy-popover"
        >
          {failure && <NotCopied failure={failure} busy={busy} retry={retry} onRetry={() => run(failure.from, formDetails())} />}
        </PopoverPanel>
      </Popover>
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

/** The chevron's popover: a title, prefilled from the suggestion until edited, and an optional designer. */
function Details({ titleField, busy, onCopy }: { titleField: RefObject<HTMLInputElement | null>; busy: boolean; onCopy(details: CopyDetails): void }) {
  const form = copyForm();
  const [title, setTitle] = useState(form.title ?? "");
  const [designer, setDesigner] = useState(form.designer);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
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
    // The title's error is the form's own, in the page: the browser's bubble would sit outside Loupe.
    <form
      className="details"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") {
          setMissing(true);
          titleField.current?.focus();
          return;
        }
        onCopy({ title, designer });
      }}
    >
      <Field
        ref={titleField}
        label={COPY.title}
        name="title"
        required
        error={missing ? TITLE_MISSING : undefined}
        value={title}
        onValueChange={(next) => {
          setTitle(next);
          if (next.trim() !== "") setMissing(false);
          copyForm().title = next;
        }}
      />
      <Field
        label={COPY.designer}
        optional={COPY.optional}
        name="designer"
        placeholder={COPY.designerHint}
        value={designer}
        onValueChange={(next) => {
          setDesigner(next);
          copyForm().designer = next;
        }}
      />
      <Button type="submit" look="primary" className="submit" aria-disabled={busy || undefined}>
        <CopyIcon size={16} />
        {COPY.copyWith}
      </Button>
    </form>
  );
}

/** A refused copy: why, the Proposal's text to copy by hand when it was built, and another try. */
function NotCopied({ failure, busy, retry, onRetry }: { failure: Failure; busy: boolean; retry: RefObject<HTMLButtonElement | null>; onRetry(): void }) {
  const text = useRef<HTMLTextAreaElement>(null);
  const hasText = failure.text !== "";
  return (
    <>
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
        <Field ref={text} className="proposal-text" label={COPY.proposal} labelHidden look="well" multiline readOnly spellCheck={false} value={failure.text} />
      )}
      <div className={hasText ? "popover-actions" : "popover-actions alone"}>
        {hasText && (
          <Button
            size="large"
            onClick={() => {
              text.current?.focus();
              text.current?.select();
            }}
          >
            {COPY.selectAll}
          </Button>
        )}
        <Button ref={retry} look="primary" aria-disabled={busy || undefined} onClick={onRetry}>
          <ResetIcon />
          {COPY.retry}
        </Button>
      </div>
    </>
  );
}
