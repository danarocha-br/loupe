// Copy Proposal's drawn parts (ADR 0002, ADR 0003; Paper's "Copy flow v2 · A"): the split
// button in the footer, its main half copying in one click and its chevron opening the
// details; the details' form, a title and a designer; a refused copy's body, why, the
// Proposal's text to copy by hand and another try; and the toast once a copy lands.
//
// They draw panel-view's words (`CopyWords`) and build none. They make no copy: each calls
// back, and the view runs the copy, keeps its state (which half opened the popover, the
// timers that turn the button back and take the toast away, the form's text), places the
// popovers and hands focus back, and says each copy and refusal. See copy-flow.md.

import { type Ref, type RefObject, useRef } from "react";
import type { CopyWords } from "../../panel-view/index.js";
import { AlertIcon, Button, CheckIcon, ChevronUpIcon, CopyIcon, ExclaimIcon, Field, ResetIcon } from "../../ui/index.js";

/** The split button's state: ready, a copy landed (green, for a moment), or the main half's copy refused (amber). */
export type CopyState = "idle" | "copied" | "failed";

/** The main half's icon in each state; its words are panel-view's. */
const ICONS = {
  idle: <CopyIcon size={16} />,
  copied: <CheckIcon size={16} />,
  failed: <AlertIcon />,
} as const;

export type CopySplitProps = {
  state: CopyState;
  /** A copy is out: said on the split, while the halves stay pressable. */
  busy: boolean;
  /** Nothing to copy: both halves off. */
  disabled: boolean;
  /** The details, or a refusal from the chevron, stand open over the footer. */
  expanded: boolean;
  words: CopyWords;
  /** The split, which a press on stays the popover's own; each half, for focus to go back to. */
  ref?: Ref<HTMLDivElement>;
  mainRef?: Ref<HTMLButtonElement>;
  chevronRef?: Ref<HTMLButtonElement>;
  /** The main half: copy now, under the title given so far or the suggested one. */
  onCopy(): void;
  /** The chevron: open the details, or close what stands open. */
  onDetails(): void;
};

export function CopySplit({ state, busy, disabled, expanded, words, ref, mainRef, chevronRef, onCopy, onDetails }: CopySplitProps) {
  return (
    <div ref={ref} data-copy-split="" data-state={state} aria-busy={busy || undefined}>
      <button ref={mainRef} type="button" data-copy="" disabled={disabled} title={words.mainTitle} onClick={onCopy}>
        {ICONS[state]}
        {words[state]}
      </button>
      <span data-copy-rule="" aria-hidden="true" />
      <button
        ref={chevronRef}
        type="button"
        data-copy-details=""
        disabled={disabled}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        title={words.detailsTitle}
        onClick={onDetails}
      >
        <ChevronUpIcon />
        <span className="sr-only">{words.details}</span>
      </button>
    </div>
  );
}

export type DetailsFormProps = {
  title: string;
  designer: string;
  /** Copied with no title: the field says so. */
  missing: boolean;
  busy: boolean;
  words: CopyWords;
  /** The title field, which takes focus as the popover opens and when a copy is refused for want of a title. */
  titleRef?: Ref<HTMLInputElement>;
  onTitle(title: string): void;
  onDesigner(designer: string): void;
  /** Copy with these details: the view checks the title. */
  onSubmit(): void;
};

/** The chevron's popover: a title and an optional designer, and the copy that takes them. */
export function DetailsForm({ title, designer, missing, busy, words, titleRef, onTitle, onDesigner, onSubmit }: DetailsFormProps) {
  return (
    // The title's error is the form's own, in the page: the browser's bubble would sit outside Loupe.
    <form
      data-copy-form=""
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field ref={titleRef} label={words.title} name="title" required error={missing ? words.titleMissing : undefined} value={title} onValueChange={onTitle} />
      <Field label={words.designer} optional={words.optional} name="designer" placeholder={words.designerHint} value={designer} onValueChange={onDesigner} />
      <Button type="submit" look="primary" data-copy-submit="" aria-disabled={busy || undefined}>
        <CopyIcon size={16} />
        {words.copyWith}
      </Button>
    </form>
  );
}

export type NotCopiedProps = {
  /** Why, as the popover says it (`CopyWords.notCopiedText`). */
  said: string;
  /** The Proposal's text to copy by hand; empty when it wasn't built. */
  text: string;
  busy: boolean;
  words: CopyWords;
  /** Try again, which takes focus as the popover opens. */
  retryRef?: RefObject<HTMLButtonElement | null>;
  onRetry(): void;
};

/** A refused copy: why, the Proposal's text to copy by hand when it was built, and another try. */
export function NotCopied({ said, text, busy, words, retryRef, onRetry }: NotCopiedProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const hasText = text !== "";
  // Said by the announcer as the refusal lands (the view's); here it is for the eye.
  return (
    <>
      <div data-not-copied="">
        <span data-not-copied-badge="" aria-hidden="true">
          <ExclaimIcon />
        </span>
        <div data-not-copied-why="">
          <h3>{words.notCopied}</h3>
          <p>{said}</p>
        </div>
      </div>
      {hasText && <Field ref={field} label={words.proposal} labelHidden look="well" multiline readOnly spellCheck={false} value={text} />}
      <div data-copy-actions="" data-alone={hasText ? undefined : ""}>
        {hasText && (
          <Button
            size="large"
            onClick={() => {
              field.current?.focus();
              field.current?.select();
            }}
          >
            {words.selectAll}
          </Button>
        )}
        <Button ref={retryRef} look="primary" aria-disabled={busy || undefined} onClick={onRetry}>
          <ResetIcon />
          {words.retry}
        </Button>
      </div>
    </>
  );
}

export type CopyToastProps = {
  /** The title the copy went under. */
  title: string;
  words: CopyWords;
};

/** Over the footer once a copy lands: what went, and what to do with it. For the eye: the announcer says it. */
export function CopyToast({ title, words }: CopyToastProps) {
  return (
    <div data-copy-toast="" aria-hidden="true">
      <span data-toast-badge="">
        <CheckIcon size={14} />
      </span>
      <span data-toast-what="">
        <span data-toast-line="">
          {words.copied}
          {words.quote.open}
          {/* `bdi`: the title is the app's words, whatever their direction. */}
          <bdi data-toast-title="">{title}</bdi>
          {words.quote.close}
        </span>
        <span data-toast-sub="">{words.pasteIt}</span>
      </span>
    </div>
  );
}
