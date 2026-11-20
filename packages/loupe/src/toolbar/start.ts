// What the Toolbar starts when it mounts (PER-218). That's the Proposal tracker,
// and the Toolbar's methods on `window.__loupe`, the acceptance surface, next to
// the runtime's (`debug.ts`):
//
//   __loupe.proposal(options?)          the Proposal JSON (`proposal.ts`)
//   __loupe.proposalMarkdown(options?)  its Copy as Markdown text
//   __loupe.report(options)             the HTML report, not downloaded (`export.ts`)
//   __loupe.exportProposal(options)     the report, downloaded as Export does
//
// Starting again changes nothing: the tracker is one per page, and the methods are
// the same module functions. `resetLoupe()` takes both away, and the next mount
// starts them again. The methods are assigned each time, not kept, so the latest
// code answers once it has run.

import { debugOf } from "../runtime/debug.js";
import { buildExport, exportProposal } from "./export.js";
import { collectProposal, collectProposalMarkdown, startTracking } from "./proposal.js";

export function startToolbar(): void {
  // From the moment the Toolbar loads, not from the first export: a record set on
  // another route, or an Instance that has since unmounted, is only known if seen.
  startTracking();
  Object.assign(debugOf(), {
    proposal: collectProposal,
    proposalMarkdown: collectProposalMarkdown,
    report: buildExport,
    exportProposal,
  });
}
