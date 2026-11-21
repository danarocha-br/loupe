// Copy Proposal (ADR 0002, after PER-99 §8 and PER-139): the footer's Copy Proposal
// opens a dialog that asks for a title and an optional designer and note per entry.
// It shows what the text will hold and blocks on nothing but an empty title. Copy
// then puts the Proposal on the clipboard, as the text a coding agent reads.
//
// Copying clears nothing. Overrides stay, and so does what was typed into the
// dialog, for the next copy of the same session. A reload clears the form.

import { changeInWords } from "../proposal/words.js";
import { perPage } from "../runtime/slot.js";
import { collectProposalKeyed, collectProposalText, type ProposalOptions, suggestedTitle } from "./proposal.js";

/** What the designer typed; `title` stays null until they edit it, so it follows the suggestion. */
export type CopyForm = { title: string | null; designer: string; notes: Record<string, string> };

/** One form per page load, kept in the page's slot across a Fast Refresh. */
export function copyForm(): CopyForm {
  return perPage("copyForm", () => ({ title: null, designer: "", notes: {} }));
}

export type CopyEntry = { id: string; key: string; label: string };

/** What the dialog shows before anything is copied. */
export type CopyPreview = {
  suggestedTitle: string;
  entries: CopyEntry[];
  changes: number;
  held: number;
};

/** Counts and entries for the dialog, from the store as it is now. Copies nothing. */
export async function previewCopy(): Promise<CopyPreview> {
  const form = copyForm();
  const { proposal, keys } = await collectProposalKeyed({ notes: form.notes });
  const changes = proposal.routes.flatMap((route) => route.changes);
  return {
    suggestedTitle: suggestedTitle(proposal),
    entries: changes.map((change) => ({ id: change.id, key: keys[change.id] ?? change.id, label: changeInWords(change) })),
    changes: changes.length,
    held: proposal.heldForReview.length,
  };
}

/**
 * Copies the Proposal's text. The clipboard gets a promise, so the write is claimed
 * during the click even though building the Proposal awaits the server. A browser
 * that refuses the clipboard still leaves the text in the console to copy from.
 */
export async function copyProposal(options: ProposalOptions = {}): Promise<string> {
  if (options.title !== undefined && options.title.trim() === "") throw new Error("A Proposal needs a title.");
  const text = collectProposalText(options);
  try {
    if (typeof navigator.clipboard === "undefined") {
      throw new Error("The clipboard is only available on a secure origin, localhost or HTTPS.");
    }
    if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": text.then((proposal) => new Blob([proposal], { type: "text/plain" })) }),
      ]);
    } else {
      await navigator.clipboard.writeText(await text);
    }
  } catch (error) {
    const proposal = await text;
    console.info(`[loupe] Proposal:\n\n${proposal}`);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason} The Proposal is in the console.`);
  }
  return text;
}
