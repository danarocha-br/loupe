// Copy Proposal in the footer (ADR 0002; Paper's "Copy flow v2 · A", 2026-11-22): a
// split button. Its main half copies in one click, under the title given so far or the
// suggested one; its chevron opens a small popover over the footer for a title and a
// designer. Copied, the button turns green and a toast says what went; refused, a
// popover says why, holds the Proposal's text to copy by hand, and tries again. The
// popover points at what opened it: the chevron, or the button a one-click copy came from.
// It isn't modal: the page and the panel stay usable while it is open.
//
// What it draws is the Copy flow's patterns' (patterns/copy-flow/), in panel-view's words
// (`COPY_WORDS`). This keeps the state machine: running a copy, which half opened the
// popover and where focus goes back, the timers, the form's text and what is announced.

import { type RefObject, useEffect, useRef, useState } from "react";
import { useEscape } from "./escape.js";
import { type CopyDetails, CopyFailed, copyForm, copyProposal, formDetails, suggestTitle } from "./copy.js";
import { COPY_WORDS } from "./panel-view/index.js";
import { CopySplit, CopyToast, DetailsForm, NotCopied } from "@loupe/patterns";
import { focusField, Popover, PopoverPanel, useAnnounce } from "@loupe/ui";

/** How long the button says Copied, and the toast stays. */
const COPIED_MS = 2500;
const TOAST_MS = 4000;

type From = "copy" | "details";
type Failure = { reason: string; text: string; from: From };
/** The last copy that landed; `at` tells two copies of the same title apart, so each restarts the timers. */
type Landed = { title: string; at: number };

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
  const announce = useAnnounce();

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
        // Once per copy, the same title twice included: the toast itself is for the eye.
        announce(COPY_WORDS.copiedText(title));
      },
      (error: unknown) => {
        running.current = false;
        setBusy(false);
        console.warn("[loupe] Copy Proposal failed:", error);
        setDetails(false);
        setCopied(null);
        setToast(null);
        setFailedFrom(from);
        const failed = {
          reason: error instanceof Error ? error.message : String(error),
          text: error instanceof CopyFailed ? error.proposal : "",
          from,
        };
        setFailure(failed);
        // Focus goes to its Try again, which says nothing of why: the reason is said now.
        announce(notCopiedText(failed), { politeness: "assertive" });
      },
    );
  };
  const close = () => {
    setDetails(false);
    setFailure(null);
  };

  const state = failure?.from === "copy" ? "failed" : copied !== null ? "copied" : "idle";
  const detailsOpen = details || failure?.from === "details";
  return (
    <>
      <CopySplit
        ref={split}
        mainRef={main}
        chevronRef={chevron}
        state={state}
        busy={busy}
        disabled={disabled}
        expanded={detailsOpen}
        words={COPY_WORDS}
        onCopy={() => run("copy", formDetails())}
        onDetails={() => {
          if (!details && !failure) return setDetails(true);
          close();
          chevron.current?.focus();
        }}
      />
      {/* A press on the split is its own: the chevron toggles, the main half copies again. */}
      <Popover open={details} onOpenChange={(open) => !open && setDetails(false)} inside={split}>
        <PopoverPanel label={COPY_WORDS.details} anchor={frame} returnFocus={chevron} initialFocus={titleField} caret="end">
          <Details titleField={titleField} busy={busy} onCopy={(copyDetails) => run("details", copyDetails)} />
        </PopoverPanel>
      </Popover>
      <Popover open={failure !== null} onOpenChange={(open) => !open && setFailure(null)} inside={split}>
        <PopoverPanel
          label={COPY_WORDS.notCopied}
          anchor={frame}
          returnFocus={halfFor(failedFrom)}
          initialFocus={retry}
          caret={failedFrom === "copy" ? "center" : "end"}
        >
          {failure && (
            <NotCopied
              said={notCopiedText(failure)}
              text={failure.text}
              busy={busy}
              words={COPY_WORDS}
              retryRef={retry}
              onRetry={() => run(failure.from, formDetails())}
            />
          )}
        </PopoverPanel>
      </Popover>
      {toast !== null && failure === null && !details && <CopyToast title={toast.title} words={COPY_WORDS} />}
    </>
  );
}

/** Why a copy was refused, as the popover says it: with "Your Proposal is below." when it holds the text. */
const notCopiedText = (failure: Failure) => COPY_WORDS.notCopiedText(failure.reason, failure.text !== "");

/** The chevron's popover's state: a title, prefilled from the suggestion until edited, and an optional designer. */
function Details({ titleField, busy, onCopy }: { titleField: RefObject<HTMLInputElement | null>; busy: boolean; onCopy(details: CopyDetails): void }) {
  const announce = useAnnounce();
  const form = copyForm();
  const [title, setTitle] = useState(form.title ?? "");
  const [designer, setDesigner] = useState(form.designer);
  const [missing, setMissing] = useState(false);
  // Each refused submit from outside the field asks for focus once the error is rendered
  // and describes the field, so focus landing there reads it (Devin's review of #78).
  const [titleFocusRequests, setTitleFocusRequests] = useState(0);
  useEffect(() => {
    if (titleFocusRequests > 0) focusField(titleField.current);
  }, [titleFocusRequests, titleField]);
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
    <DetailsForm
      title={title}
      designer={designer}
      missing={missing}
      busy={busy}
      words={COPY_WORDS}
      titleRef={titleField}
      onTitle={(next) => {
        setTitle(next);
        if (next.trim() !== "") setMissing(false);
        copyForm().title = next;
      }}
      onDesigner={(next) => {
        setDesigner(next);
        copyForm().designer = next;
      }}
      onSubmit={() => {
        if (title.trim() === "") {
          setMissing(true);
          // Focus moving to the field reads its error with it, once the error is there (the
          // effect above). Already there (Enter in the field), nothing moves, so the error
          // is said: once either way (field.md).
          const field = titleField.current;
          if (field && (field.getRootNode() as ShadowRoot | Document).activeElement === field) announce(COPY_WORDS.titleMissing, { politeness: "assertive" });
          else setTitleFocusRequests((asked) => asked + 1);
          return;
        }
        onCopy({ title, designer });
      }}
    />
  );
}
