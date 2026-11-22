// Copy Proposal (ADR 0002, after PER-99 §8 and PER-139; Copy flow v2 since 2026-11-22):
// the footer's split button copies in one click under the title given so far, or the
// suggested one; its chevron opens a small popover for a title and a designer. Either
// puts the Proposal on the clipboard, as the text a coding agent reads.
//
// Copying clears nothing. Overrides stay, and so does what was typed into the
// popover, for the next copy of the same session. A reload clears the form.

import { proposalText } from "../proposal/text.js";
import { perPage } from "../runtime/slot.js";
import { collectProposal, suggestedTitle } from "./proposal.js";

/** What the designer typed; `title` stays null until they edit it, so it follows the suggestion. */
export type CopyForm = { title: string | null; designer: string };

/** What a copy is made with: a title (none follows the suggestion) and a designer. */
export type CopyDetails = { title?: string; designer?: string };

/** One form per page load, kept in the page's slot across a Fast Refresh. */
export function copyForm(): CopyForm {
  return perPage("copyForm", () => ({ title: null, designer: "" }));
}

/** What the form holds, as a copy takes it: a title left blank follows the suggestion. */
export function formDetails(): CopyDetails {
  const { title, designer } = copyForm();
  return { title: title === null || title.trim() === "" ? undefined : title, designer };
}

/** The title a copy would get with none given: from the first change. Copies nothing. */
export async function suggestTitle(): Promise<string> {
  return suggestedTitle(await collectProposal());
}

/** Why a copy fails on a page that has no clipboard: it is only there on a secure origin. */
export const BLOCKED = "The clipboard needs localhost or HTTPS.";

/** A copy that didn't reach the clipboard: why, and the Proposal's text to copy by hand when it was built. */
export class CopyFailed extends Error {
  constructor(
    readonly reason: string,
    readonly proposal: string,
  ) {
    super(reason);
    this.name = "CopyFailed";
  }
}

/**
 * Copies the Proposal's text, and says under what title. The clipboard gets a
 * promise, so the write is claimed during the click even though building the
 * Proposal awaits the server. A browser that refuses the clipboard throws
 * `CopyFailed` with the text, which also goes to the console.
 */
export async function copyProposal(details: CopyDetails = {}): Promise<{ title: string; text: string }> {
  if (details.title !== undefined && details.title.trim() === "") throw new Error("A Proposal needs a title.");
  const built = collectProposal(details);
  const text = built.then(proposalText);
  try {
    if (typeof navigator.clipboard === "undefined") {
      throw new Error(BLOCKED);
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
    throw new CopyFailed(error instanceof Error ? error.message : String(error), proposal);
  }
  return { title: (await built).title, text: await text };
}
