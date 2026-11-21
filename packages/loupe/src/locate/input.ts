// What `loupe locate` reads: the Copy Proposal text as the designer pasted it, or the
// Proposal's JSON alone. The text ends in a fenced JSON block (`proposal/text.ts`);
// the last one wins, so a pasted note can't stand in for the Proposal.

import { FORMAT_VERSION, type Proposal } from "../proposal/types.js";

/** The fenced ```json blocks in a text, last first. A fence closes only on its own length. */
function jsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /^(`{3,})json[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gm;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) blocks.push(match[2] ?? "");
  return blocks.reverse();
}

/** The Proposal in a pasted text, or a sentence saying why there isn't one Loupe can read. */
export function readProposal(text: string): Proposal | string {
  const trimmed = text.trim();
  if (trimmed === "") return "Nothing to read: pass the copied Proposal as a file, or pipe it on standard input.";
  const candidates = trimmed.startsWith("{") ? [trimmed] : jsonBlocks(text);
  if (candidates.length === 0) return "No Proposal JSON in this text. Copy it again with Copy Proposal in the Loupe panel and pass the whole text.";
  let data: unknown;
  try {
    data = JSON.parse(candidates[0] ?? "");
  } catch (error) {
    return `The Proposal JSON doesn't parse: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (typeof data !== "object" || data === null || !("formatVersion" in data)) return "That JSON isn't a Loupe Proposal.";
  const version = (data as { formatVersion: unknown }).formatVersion;
  if (version !== FORMAT_VERSION) {
    return `This Proposal is format ${String(version)}; this Loupe reads format ${FORMAT_VERSION}. Copy it again with Copy Proposal in the Loupe panel.`;
  }
  const { routes, heldForReview } = data as { routes?: unknown; heldForReview?: unknown };
  if (!Array.isArray(routes) || !Array.isArray(heldForReview)) return "That JSON isn't a Loupe Proposal.";
  return data as Proposal;
}
