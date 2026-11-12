// Export (PER-99 §8, PER-139): the footer's Export opens a dialog that asks for a
// title and an optional designer and note per entry. It shows what the file will
// hold, warns past 25 MB and blocks on nothing but an empty title. Export then
// takes its own Snapshot of the screen in view and downloads the HTML report.
//
// Exporting clears nothing. Overrides and Snapshots stay, and so does what was
// typed into the dialog, for the next export of the same session. A reload
// clears the form, as it clears Snapshots.

import { changeInWords } from "../proposal/build.js";
import { proposalReport, REPORT_WARN_BYTES, reportFileName } from "../proposal/report.js";
import type { Proposal } from "../proposal/types.js";
import { createDebug, type LoupeDebug } from "../runtime/debug.js";
import { collectProposalKeyed, suggestedTitle } from "./proposal.js";
import { captureScreen, isOutdated, removeSnapshot, type Snapshot, snapshots } from "./snapshots.js";

export { REPORT_WARN_BYTES };

/** What the designer typed; `title` stays null until they edit it, so it follows the suggestion. */
export type ExportForm = { title: string | null; designer: string; notes: Record<string, string> };

const GLOBAL_KEY = "__loupeExportForm";

/** One form per page load, kept on `globalThis` across a Fast Refresh. */
export function exportForm(): ExportForm {
  const host = globalThis as typeof globalThis & { [GLOBAL_KEY]?: ExportForm };
  host[GLOBAL_KEY] ??= { title: null, designer: "", notes: {} };
  return host[GLOBAL_KEY];
}

export type ExportEntry = { id: string; key: string; label: string };

/** What the dialog shows before anything is captured or downloaded. */
export type ExportPreview = {
  suggestedTitle: string;
  entries: ExportEntry[];
  changes: number;
  withoutScreenshot: number;
  held: number;
  outdatedSnapshots: number;
  /** The report's size as things stand, before the export's own Snapshot. */
  bytes: number;
  /** Roughly what the export's own Snapshot adds: the newest kept Snapshot's size. */
  captureBytes: number;
};

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Counts and entries for the dialog, from the store as it is now. Reads only. */
export async function previewExport(): Promise<ExportPreview> {
  const form = exportForm();
  const { proposal, keys } = await collectProposalKeyed({ notes: form.notes });
  const changes = proposal.routes.flatMap((route) => route.changes);
  const kept = snapshots().filter((snapshot) => !isOutdated(snapshot));
  return {
    suggestedTitle: suggestedTitle(proposal),
    entries: changes.map((change) => ({ id: change.id, key: keys[change.id] ?? change.id, label: changeInWords(change) })),
    changes: changes.length,
    withoutScreenshot: changes.filter((change) => change.screenshots.length === 0).length,
    held: proposal.heldForReview.length,
    outdatedSnapshots: snapshots().length - kept.length,
    bytes: utf8Bytes(proposalReport(proposal)),
    captureBytes: kept.at(-1)?.bytes ?? 0,
  };
}

/**
 * The manual Snapshot an export's own one repeats: same route, not Outdated, and
 * the same pixels. Then the report would show the same screen twice (PER-138).
 */
export function duplicateOf(taken: Snapshot, list: readonly Snapshot[]): Snapshot | undefined {
  return list.find(
    (other) =>
      other.id !== taken.id &&
      !other.auto &&
      other.route === taken.route &&
      !isOutdated(other) &&
      other.viewport.before === taken.viewport.before &&
      other.viewport.after === taken.viewport.after,
  );
}

export type ExportOptions = { title: string; designer?: string | null; notes?: Readonly<Record<string, string>> };

export type ExportResult = { fileName: string; html: string; bytes: number; proposal: Proposal };

/** Takes the export's Snapshot, then builds the report. Downloads nothing. */
export async function buildExport(options: ExportOptions): Promise<ExportResult> {
  const title = options.title.trim();
  if (title === "") throw new Error("A Proposal needs a title.");
  const taken = await captureScreen({ auto: true }).catch((error: unknown) => {
    console.warn("[loupe] The export's Snapshot failed; exporting without it.", error);
    return null;
  });
  if (taken && duplicateOf(taken, snapshots())) removeSnapshot(taken.id);
  const { proposal } = await collectProposalKeyed({ title, designer: options.designer ?? null, notes: options.notes ?? {} });
  const fileName = reportFileName(title, new Date(proposal.createdAt));
  const html = proposalReport(proposal, { fileName });
  return { fileName, html, bytes: utf8Bytes(html), proposal };
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export: the report, downloaded. Clears nothing. */
export async function exportProposal(options: ExportOptions): Promise<ExportResult> {
  const result = await buildExport(options);
  if (result.bytes > REPORT_WARN_BYTES) {
    console.warn(`[loupe] ${result.fileName} is ${megabytes(result.bytes)}, over 25 MB: some tools refuse attachments that size.`);
  }
  download(result.html, result.fileName, "text/html");
  return result;
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Adds `report` and `exportProposal` to `window.__loupe`, the acceptance surface. */
export function exposeExport(): void {
  if (typeof window === "undefined") return;
  const debug = ((window as typeof window & { __loupe?: LoupeDebug }).__loupe ?? createDebug()) as LoupeDebug & {
    report?: (options: ExportOptions) => Promise<ExportResult>;
    exportProposal?: (options: ExportOptions) => Promise<ExportResult>;
  };
  debug.report ??= buildExport;
  debug.exportProposal ??= exportProposal;
}

// With the Toolbar, like `__loupe.proposal()`.
if (typeof window !== "undefined") exposeExport();
