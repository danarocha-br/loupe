// Export (PER-99 §8, PER-139): the footer's Export opens a dialog that asks for a
// title and an optional designer and note per entry. It shows what the file will
// hold and blocks on nothing but an empty title. Export then downloads the HTML
// report.
//
// Exporting clears nothing. Overrides stay, and so does what was typed into the
// dialog, for the next export of the same session. A reload clears the form.

import { proposalReport, reportFileName } from "../proposal/report.js";
import type { Proposal } from "../proposal/types.js";
import { changeInWords } from "../proposal/words.js";
import { perPage } from "../runtime/slot.js";
import { collectProposalKeyed, suggestedTitle } from "./proposal.js";

/** What the designer typed; `title` stays null until they edit it, so it follows the suggestion. */
export type ExportForm = { title: string | null; designer: string; notes: Record<string, string> };

/** One form per page load, kept in the page's slot across a Fast Refresh. */
export function exportForm(): ExportForm {
  return perPage("exportForm", () => ({ title: null, designer: "", notes: {} }));
}

export type ExportEntry = { id: string; key: string; label: string };

/** What the dialog shows before anything is downloaded. */
export type ExportPreview = {
  suggestedTitle: string;
  entries: ExportEntry[];
  changes: number;
  held: number;
};

/** Counts and entries for the dialog, from the store as it is now. Downloads nothing. */
export async function previewExport(): Promise<ExportPreview> {
  const form = exportForm();
  const { proposal, keys } = await collectProposalKeyed({ notes: form.notes });
  const changes = proposal.routes.flatMap((route) => route.changes);
  return {
    suggestedTitle: suggestedTitle(proposal),
    entries: changes.map((change) => ({ id: change.id, key: keys[change.id] ?? change.id, label: changeInWords(change) })),
    changes: changes.length,
    held: proposal.heldForReview.length,
  };
}

export type ExportOptions = { title: string; designer?: string | null; notes?: Readonly<Record<string, string>> };

export type ExportResult = { fileName: string; html: string; proposal: Proposal };

/** Builds the report. Downloads nothing. */
export async function buildExport(options: ExportOptions): Promise<ExportResult> {
  const title = options.title.trim();
  if (title === "") throw new Error("A Proposal needs a title.");
  const { proposal } = await collectProposalKeyed({ title, designer: options.designer ?? null, notes: options.notes ?? {} });
  const fileName = reportFileName(title, new Date(proposal.createdAt));
  const html = proposalReport(proposal, { fileName });
  return { fileName, html, proposal };
}

/** Hands a file to the browser's downloads. */
export function download(text: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // A large file can still be streaming to disk after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Export: the report, downloaded. Clears nothing. */
export async function exportProposal(options: ExportOptions): Promise<ExportResult> {
  const result = await buildExport(options);
  download(result.html, result.fileName, "text/html");
  return result;
}
